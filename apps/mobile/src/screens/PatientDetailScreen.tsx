import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { COLORS, Patient as PatientType, HealthRecord, FacilityType } from '@medisync/shared';
import { theme } from '../styles/theme';
import { SeverityBadge } from '../components/SeverityBadge';
import { api } from '../services/api';
import { useTranslation } from '../i18n';

const facilityTypeColors: Record<string, string> = {
  [FacilityType.SUB_CENTRE]: COLORS.success,
  [FacilityType.PHC]: COLORS.info,
  [FacilityType.CHC]: COLORS.warning,
  [FacilityType.DISTRICT_HOSPITAL]: COLORS.emergency,
};

export const PatientDetailScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { t } = useTranslation();
  const [patient, setPatient] = useState<PatientType | null>(null);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [diagnostics, setDiagnostics] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'timeline' | 'diagnostics'>('timeline');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const p = await api.getPatient('patient-1');
      setPatient(p.data);
      const r = await api.getPatientRecords('patient-1');
      setRecords(r.data || []);
      const dx = await fetch('http://localhost:3001/api/diagnostics/orders?patientId=patient-1');
      const dxData = await dx.json();
      setDiagnostics(dxData.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loading}>{t('common.loading')}</Text>
      </SafeAreaView>
    );
  }

  if (!patient) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loading}>{t('common.noData')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.patientHeader}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarTextLarge}>{patient.name.charAt(0)}</Text>
          </View>
          <View style={styles.patientHeaderInfo}>
            <Text style={styles.patientNameLarge}>{patient.name}</Text>
            <Text style={styles.patientMetaLarge}>
              {patient.age} yrs • {patient.gender} • {patient.village}, {patient.district}
            </Text>
            <Text style={styles.abhaIdLarge}>ABHA: {patient.abhaId}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('facility.callFacility')}</Text>
            <Text style={styles.infoValue}>{patient.phone}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('settings.language')}</Text>
            <Text style={styles.infoValue}>{patient.languagePreference}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('facility.districtSummary')}</Text>
            <Text style={styles.infoValue}>{patient.district}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'timeline' && styles.tabButtonActive]}
              onPress={() => setActiveTab('timeline')}
            >
              <Text style={[styles.tabText, activeTab === 'timeline' && styles.tabTextActive]}>Health Timeline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'diagnostics' && styles.tabButtonActive]}
              onPress={() => setActiveTab('diagnostics')}
            >
              <Text style={[styles.tabText, activeTab === 'diagnostics' && styles.tabTextActive]}>Diagnostics</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'timeline' ? (
            <View style={styles.timeline}>
              {records.map((record) => (
                <View key={record.id} style={styles.timelineItem}>
                  <View style={[
                    styles.timelineDot,
                    { backgroundColor: facilityTypeColors[record.facilityId] || COLORS.primary },
                  ]} />
                  <View style={styles.timelineContent}>
                    <View style={styles.timelineHeader}>
                      <Text style={styles.timelineDate}>
                        {new Date(record.visitDate).toLocaleDateString()}
                      </Text>
                      <Text style={styles.timelineDoctor}>{record.doctorName}</Text>
                    </View>
                    <Text style={styles.timelineDiagnosis}>{record.diagnosis}</Text>
                    <Text style={styles.timelinePrescription}>{record.prescription}</Text>
                  </View>
                </View>
              ))}
              {records.length === 0 && (
                <Text style={styles.noRecords}>{t('common.noData')}</Text>
              )}
            </View>
          ) : (
            <View style={styles.diagnosticsList}>
              {diagnostics.map((order) => (
                <View key={order.id} style={styles.diagnosticCard}>
                  <View style={styles.dxHeader}>
                    <Text style={styles.dxDate}>{new Date(order.createdAt).toLocaleDateString()}</Text>
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
                      {order.results.map((result: any) => (
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
                <Text style={styles.noRecords}>No diagnostic orders</Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('common.home')}</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionButtonIcon}>📝</Text>
              <Text style={styles.actionButtonLabel}>{t('patients.newVisit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Feedback', { facilityId: 'facility-1' })}>
              <Text style={styles.actionButtonIcon}>📝</Text>
              <Text style={styles.actionButtonLabel}>{t('feedback.title')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionButtonIcon}>📄</Text>
              <Text style={styles.actionButtonLabel}>PDF</Text>
            </TouchableOpacity>
          </View>
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