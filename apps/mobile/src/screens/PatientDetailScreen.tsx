import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  Share,
} from 'react-native';
import { useNavigation, useRoute, NavigationProp, RouteProp } from '@react-navigation/native';
import { COLORS, HealthRecord, DiagnosticOrder, Referral } from '@medisync/shared';
import { theme } from '../styles/theme';
import { patientClient } from '../services/patientClient';
import { JourneyPatient, PatientPrescription, prescriptionHtml, prescriptionText } from '../services/patientHelpers';
import { initDemoMode, isDemoActive, onDemoModeChange } from '../services/demoMode';
import { useTranslation } from '../i18n';
import { patientJourney, patientJourneyError, PatientJourneyError, PatientJourneyKey } from '../i18n/patientJourney';

type PatientRoutes = {
  PatientDetail: { patientId?: string; facilityId?: string } | undefined;
  TriageFlow: { patientId: string; facilityId?: string };
  Feedback: { patientId: string; facilityId: string };
  TeleconsultJoin: { sessionId: string };
};

export const PatientDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<PatientRoutes>>();
  const route = useRoute<RouteProp<PatientRoutes, 'PatientDetail'>>();
  const patientId = route.params?.patientId?.trim();
  const facilityId = route.params?.facilityId?.trim();
  const { t, language } = useTranslation();
  const copy = patientJourney[language];
  const [patient, setPatient] = useState<JourneyPatient | null>(null);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticOrder[]>([]);
  const [prescriptions, setPrescriptions] = useState<PatientPrescription[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [demo, setDemo] = useState(isDemoActive);
  const [ready, setReady] = useState(false);
  const [exportError, setExportError] = useState<unknown>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'diagnostics'>('timeline');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [sectionErrors, setSectionErrors] = useState<{ key: PatientJourneyKey; error: unknown }[]>([]);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    void initDemoMode().then(() => { if (active) { setDemo(isDemoActive()); setReady(true); } }).catch(e => { if (active) { setError(e); setLoading(false); } });
    const stopMode = onDemoModeChange(() => setDemo(isDemoActive()));
    const stopFocus = navigation.addListener('focus', () => setRetry(value => value + 1));
    return () => { active = false; stopMode(); stopFocus(); };
  }, [navigation]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoading(true);
    setPatient(null);
    setRecords([]);
    setDiagnostics([]);
    setPrescriptions([]);
    setReferrals([]);
    setExportError('');
    setError(null);
    setSectionErrors([]);
    setActiveTab('timeline');
    const loadData = async () => {
      try {
        if (!patientId) throw new PatientJourneyError('selectPatient');
        const mode = demo ? 'demo' : 'live';
        const p = await patientClient.getPatient(patientId, mode);
        if (!active) return;
        setPatient(p);
        // A failed diagnostics/referral endpoint must not hide an available prescription.
        const results = await Promise.allSettled([
          patientClient.getRecords(patientId, mode),
          patientClient.getDiagnostics(patientId, mode),
          patientClient.getPrescriptions(patientId, mode),
          patientClient.getReferrals(patientId, mode),
        ]);
        if (active) {
          const [r, dx, rx, ref] = results;
          if (r.status === 'fulfilled') setRecords(r.value);
          if (dx.status === 'fulfilled') setDiagnostics(dx.value);
          if (rx.status === 'fulfilled') setPrescriptions(rx.value);
          if (ref.status === 'fulfilled') setReferrals(ref.value);
          const names = ['records', 'diagnostics', 'prescriptions', 'referrals'] as const;
          setSectionErrors(results.flatMap((result, i) => result.status === 'rejected' ? [{ key: names[i], error: result.reason }] : []));
        }
      } catch (e) {
        if (active) setError(e);
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadData();
    return () => { active = false; };
  }, [patientId, retry, ready, demo]);

  const handoff = async (rx: PatientPrescription) => {
    setExportError('');
    try {
      if (!patient || patient.id !== patientId || demo !== isDemoActive()) throw new PatientJourneyError('refreshShare');
      if (Platform.OS === 'web') {
        // Open synchronously in the user gesture; never send PHI to an external renderer.
        const popup = window.open('', '_blank');
        if (!popup) throw new PatientJourneyError('popupError');
        popup.opener = null;
        popup.document.open();
        popup.document.write(prescriptionHtml(patient, rx, language));
        popup.document.close();
        popup.focus();
        popup.print();
      } else {
        await Share.share({ message: prescriptionText(patient, rx, language), title: copy.savedPrescription });
      }
    } catch (e) { setExportError(e); }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loading}>{t('common.loading')}</Text>
      </SafeAreaView>
    );
  }

  if (!patient || patient.id !== patientId) {
    return (
      <SafeAreaView style={styles.container}>
        <Text accessibilityRole="alert" style={styles.loading}>{error ? patientJourneyError(error, language, 'loadError') : t('common.noData')}</Text>
        <TouchableOpacity style={styles.tabButton} onPress={() => setRetry(value => value + 1)}>
          <Text style={styles.tabText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {demo && <Text style={styles.noRecords}>{copy.demoSource}{'\n'}{copy.demoHistory}</Text>}
        {!!error && <Text accessibilityRole="alert" style={styles.noRecords}>{patientJourneyError(error, language, 'loadError')}</Text>}
        {sectionErrors.map(section => <Text key={section.key} accessibilityRole="alert" style={styles.noRecords}>{copy[section.key]}: {patientJourneyError(section.error, language, 'loadError')}{'\n'}{copy.incomplete}</Text>)}
        <TouchableOpacity style={styles.tabButton} onPress={() => setRetry(value => value + 1)}><Text style={styles.tabText}>{copy.refreshJourney}</Text></TouchableOpacity>
        <View style={styles.patientHeader}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarTextLarge}>{patient.name.charAt(0)}</Text>
          </View>
          <View style={styles.patientHeaderInfo}>
            <Text style={styles.patientNameLarge}>{patient.name}</Text>
            <Text style={styles.patientMetaLarge}>
              {patient.age} {copy.years} • {copy[patient.gender]} • {patient.village}, {patient.district}
            </Text>
            <Text style={styles.abhaIdLarge}>{copy.localId}: {patient.id}</Text>
            {!!patient.abhaId && <Text style={styles.abhaIdLarge}>{copy.abha}: {patient.abhaId}</Text>}
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{copy.phone}</Text>
            <Text style={styles.infoValue}>{patient.phone}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('settings.language')}</Text>
            <Text style={styles.infoValue}>{patient.languagePreference === 'en' || patient.languagePreference === 'hi' || patient.languagePreference === 'mr' ? copy[patient.languagePreference] : patient.languagePreference}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{copy.district}</Text>
            <Text style={styles.infoValue}>{patient.district}</Text>
          </View>
          {patient.trimester !== undefined && <View style={styles.infoRow}><Text style={styles.infoLabel}>{copy.trimester}</Text><Text style={styles.infoValue}>{patient.trimester}</Text></View>}
          {patient.lastVisit && <View style={styles.infoRow}><Text style={styles.infoLabel}>{copy.lastVisit}</Text><Text style={styles.infoValue}>{patient.lastVisit}</Text></View>}
          {patient.nextVisitDate && <View style={styles.infoRow}><Text style={styles.infoLabel}>{copy.nextVisit}</Text><Text style={styles.infoValue}>{patient.nextVisitDate}</Text></View>}
        </View>

        <View style={styles.section}>
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'timeline' && styles.tabButtonActive]}
              onPress={() => setActiveTab('timeline')}
            >
              <Text style={[styles.tabText, activeTab === 'timeline' && styles.tabTextActive]}>{copy.timeline}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'diagnostics' && styles.tabButtonActive]}
              onPress={() => setActiveTab('diagnostics')}
            >
              <Text style={[styles.tabText, activeTab === 'diagnostics' && styles.tabTextActive]}>{copy.diagnostics}</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'timeline' ? (
            <View style={styles.timeline}>
              {[
                ...records.map((record) => ({ date: record.visitDate, node: (
                <View key={record.id} style={styles.timelineItem}>
                  <View style={[
                    styles.timelineDot,
                    { backgroundColor: COLORS.primary },
                  ]} />
                  <View style={styles.timelineContent}>
                    <View style={styles.timelineHeader}>
                      <Text style={styles.timelineDate}>
                        {new Date(record.visitDate).toLocaleDateString(language)}
                      </Text>
                      <Text style={styles.timelineDoctor}>{record.doctorName}</Text>
                    </View>
                    <Text style={styles.timelineDiagnosis}>{record.diagnosis}</Text>
                    <Text style={styles.timelinePrescription}>{record.prescription}</Text>
                  </View>
                </View>
                ) })),
                ...prescriptions.map(rx => ({ date: rx.createdAt, node: <View key={rx.id} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineDate}>{new Date(rx.createdAt).toLocaleString(language)} - {copy.savedPrescription}</Text>
                  <Text style={styles.timelineDoctor}>{rx.doctorName}</Text>
                  <Text style={styles.timelinePrescription}>{copy.consultationStatus}: {rx.sessionStatus} | {copy.prescription}: {rx.id}</Text>
                  {rx.medications.map((medication, index) => <View key={index}>
                    <Text style={styles.timelineDiagnosis}>{medication.name}</Text>
                    <Text style={styles.timelinePrescription}>{copy.dosage}: {medication.dosage} | {copy.frequency}: {medication.frequency} | {copy.duration}: {medication.duration}</Text>
                    {!!medication.instructions && <Text style={styles.timelinePrescription}>{copy.instructions}: {medication.instructions}</Text>}
                  </View>)}
                  {!!rx.notes && <Text style={styles.timelinePrescription}>{copy.notes}: {rx.notes}</Text>}
                  <TouchableOpacity style={styles.tabButton} onPress={() => navigation.navigate('TeleconsultJoin', { sessionId: rx.sessionId })}>
                    <Text style={styles.tabText}>{copy.openConsultation}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.tabButton} onPress={() => { void handoff(rx); }}>
                    <Text style={styles.tabText}>{Platform.OS === 'web' ? copy.printPdf : copy.shareText}</Text>
                  </TouchableOpacity>
                </View>
                </View> })),
                ...referrals.map(referral => ({ date: referral.createdAt, node: <View key={referral.id} style={styles.timelineContent}>
                <Text style={styles.timelineDate}>{new Date(referral.createdAt).toLocaleString(language)} - {copy.referrals}</Text>
                <Text style={styles.timelineDiagnosis}>{referral.reason}</Text>
                <Text style={styles.timelinePrescription}>{referral.id} | {referral.status} | {referral.fromFacilityId} / {referral.toFacilityId}</Text>
                </View> })),
                ...diagnostics.map(order => ({ date: order.createdAt, node: <TouchableOpacity key={order.id} style={styles.timelineContent} onPress={() => setActiveTab('diagnostics')}>
                <Text style={styles.timelineDate}>{new Date(order.createdAt).toLocaleString(language)} - {copy.diagnostics}</Text>
                <Text style={styles.timelinePrescription}>{order.id} | {order.status} | {order.tests.join(', ')}</Text>
                <Text style={styles.tabText}>{copy.viewResults}</Text>
                </TouchableOpacity> })),
              ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(entry => entry.node)}
              {records.length + prescriptions.length + referrals.length + diagnostics.length === 0 && (
                <Text style={styles.noRecords}>{t('common.noData')}</Text>
              )}
            </View>
          ) : (
            <View style={styles.diagnosticsList}>
              {diagnostics.map((order) => (
                <View key={order.id} style={styles.diagnosticCard}>
                  <View style={styles.dxHeader}>
                    <Text style={styles.dxDate}>{new Date(order.createdAt).toLocaleDateString(language)}</Text>
                    <View style={[styles.dxStatusBadge, { backgroundColor: order.status === 'COMPLETED' ? COLORS.success : order.status === 'IN_PROGRESS' ? COLORS.info : COLORS.warning }]}>
                      <Text style={styles.dxStatusText}>{order.status}</Text>
                    </View>
                  </View>
                  <View style={styles.dxTests}>
                    {order.tests.map((test: string) => (
                      <Text key={test} style={styles.dxTest}>{test}</Text>
                    ))}
                  </View>
                  {order.results && order.results.length > 0 && (
                    <View style={styles.dxResults}>
                      {order.results.map((result) => (
                        <View key={result.testCode} style={styles.dxResultRow}>
                          <Text style={styles.dxResultName}>{result.testName}</Text>
                          <Text style={[styles.dxResultValue, { color: result.flag === 'NORMAL' ? COLORS.success : result.flag === 'CRITICAL' ? COLORS.danger : COLORS.warning }]}>
                            {result.value} {result.unit}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
              {diagnostics.length === 0 && (
                <Text style={styles.noRecords}>{copy.noDiagnostics}</Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{copy.actions}</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionButton} disabled={demo} onPress={() => navigation.navigate('TriageFlow', { patientId: patient.id, facilityId })}>
              <Text style={styles.actionButtonIcon}>📝</Text>
              <Text style={styles.actionButtonLabel}>{t('patients.newVisit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} disabled={demo || !facilityId} onPress={() => { if (facilityId && !demo) navigation.navigate('Feedback', { patientId: patient.id, facilityId }); }}>
              <Text style={styles.actionButtonIcon}>📝</Text>
              <Text style={styles.actionButtonLabel}>{t('feedback.title')}</Text>
            </TouchableOpacity>
          </View>
          {!facilityId && <Text style={styles.noRecords}>{copy.feedbackFacility}</Text>}
          {!!exportError && <Text accessibilityRole="alert" style={styles.noRecords}>{patientJourneyError(exportError, language, 'handoffError')}</Text>}
          <Text style={styles.noRecords}>{Platform.OS === 'web' ? copy.printHint : copy.nativeHint}</Text>
          <Text style={styles.noRecords}>{copy.shareHint}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingBottom: theme.layout.tabBarHeight + theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  loading: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingTop: theme.spacing.md,
    backgroundColor: COLORS.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.sm,
    ...theme.shadows.sm,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: theme.borderRadius.full,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextLarge: {
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: COLORS.primary,
  },
  patientHeaderInfo: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  patientNameLarge: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  patientMetaLarge: {
    fontSize: theme.typography.fontSize.md,
    color: COLORS.textSecondary,
  },
  abhaIdLarge: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: COLORS.primary,
    fontFamily: 'monospace',
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: COLORS.textPrimary,
  },
  section: {
    gap: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
  timeline: {
    gap: theme.spacing.md,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: theme.borderRadius.full,
    marginTop: 4,
    flexShrink: 0,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: COLORS.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    ...theme.shadows.sm,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  timelineDate: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
  timelineDoctor: {
    fontSize: theme.typography.fontSize.sm,
    color: COLORS.textSecondary,
  },
  timelineDiagnosis: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.medium,
    color: COLORS.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  timelinePrescription: {
    fontSize: theme.typography.fontSize.sm,
    color: COLORS.textSecondary,
  },
  noRecords: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: theme.spacing.lg,
  },
  tabRow: { flexDirection: 'row', gap: theme.spacing.xs, marginBottom: theme.spacing.md },
  tabButton: { flex: 1, paddingVertical: theme.spacing.sm, borderRadius: theme.borderRadius.sm, backgroundColor: COLORS.background, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  tabButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary, fontWeight: '600' },
  tabTextActive: { color: COLORS.textOnPrimary },
  diagnosticsList: { gap: theme.spacing.md },
  diagnosticCard: { backgroundColor: COLORS.background, borderRadius: theme.borderRadius.sm, padding: theme.spacing.md, borderWidth: 1, borderColor: COLORS.border },
  dxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm },
  dxDate: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary },
  dxStatusBadge: { paddingHorizontal: theme.spacing.sm, paddingVertical: 2, borderRadius: theme.borderRadius.full },
  dxStatusText: { color: COLORS.textOnPrimary, fontSize: theme.typography.fontSize.xs, fontWeight: '600' },
  dxTests: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, marginBottom: theme.spacing.sm },
  dxTest: { paddingHorizontal: theme.spacing.sm, paddingVertical: 2, backgroundColor: COLORS.surface, borderRadius: theme.borderRadius.full, fontSize: theme.typography.fontSize.xs, color: COLORS.textPrimary },
  dxResults: { gap: theme.spacing.xs },
  dxResultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  dxResultName: { fontSize: theme.typography.fontSize.sm, color: COLORS.textPrimary },
  dxResultValue: { fontSize: theme.typography.fontSize.sm, fontWeight: '600' },
  actionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  actionButtonIcon: {
    fontSize: theme.typography.fontSize.xl,
  },
  actionButtonLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: COLORS.textPrimary,
  },
});
