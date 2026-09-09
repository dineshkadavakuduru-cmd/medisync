import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Modal,
  Switch,
} from 'react-native';
import { COLORS, TriageSeverity, Alert } from '@medisync/shared';
import { theme } from '../styles/theme';
import { EmergencyBanner } from '../components/EmergencyBanner';
import { StatCard } from '../components/StatCard';
import { QueueCard } from '../components/QueueCard';
import { AlertCard } from '../components/AlertCard';
import { ReferralCard } from '../components/ReferralCard';
import { api, MOCK_ACTIVE_REFERRALS, MOCK_ALERTS } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useTranslation } from '../i18n';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useCountUp } from '../hooks/useCountUp';
import { isDemoActive, onDemoModeChange, toggleDemoMode } from '../services/demoMode';
import {
  UserRole,
  PERSONAS,
  getActivePersona,
  setActivePersona,
  onPersonaChange,
} from '../services/personas';

const PROFILE_COPY = {
  en: {
    switchRole: 'Switch demo persona',
    roles: { DOCTOR: 'Doctor', ASHA: 'ASHA', PATIENT: 'Patient', ADMIN: 'Admin', PHARMACIST: 'Pharmacist' },
    demo: 'Demo persona - synthetic data', patientDemo: 'Demo persona - PHR not connected',
    data: 'Data source', facility: 'Demo facility', id: 'Demo staff / ABHA ID', status: 'Demo shift / status',
    abha: 'Demo ABHA - not verified', close: 'Close profile', toggle: 'Toggle demo mode',
    pharmacy: 'Pharmacy workspace', inventoryHint: 'Review stock, dispensing and orders in Inventory.',
    availability: 'Medicine availability', stock: 'Stock details', openInventory: 'Open Inventory',
  },
  hi: {
    switchRole: 'डेमो भूमिका चुनें',
    roles: { DOCTOR: 'डॉक्टर', ASHA: 'आशा', PATIENT: 'मरीज़', ADMIN: 'प्रशासक', PHARMACIST: 'फार्मासिस्ट' },
    demo: 'डेमो भूमिका - कृत्रिम डेटा', patientDemo: 'डेमो भूमिका - PHR जुड़ा नहीं है',
    data: 'डेटा स्रोत', facility: 'डेमो सुविधा', id: 'डेमो कर्मचारी / ABHA ID', status: 'डेमो शिफ्ट / स्थिति',
    abha: 'डेमो ABHA - सत्यापित नहीं', close: 'प्रोफ़ाइल बंद करें', toggle: 'डेमो मोड बदलें',
    pharmacy: 'फार्मेसी कार्यक्षेत्र', inventoryHint: 'इन्वेंटरी में स्टॉक, दवा वितरण और ऑर्डर देखें।',
    availability: 'दवा उपलब्धता', stock: 'स्टॉक विवरण', openInventory: 'इन्वेंटरी खोलें',
  },
  mr: {
    switchRole: 'डेमो भूमिका निवडा',
    roles: { DOCTOR: 'डॉक्टर', ASHA: 'आशा', PATIENT: 'रुग्ण', ADMIN: 'प्रशासक', PHARMACIST: 'फार्मासिस्ट' },
    demo: 'डेमो भूमिका - कृत्रिम डेटा', patientDemo: 'डेमो भूमिका - PHR जोडलेले नाही',
    data: 'डेटा स्रोत', facility: 'डेमो सुविधा', id: 'डेमो कर्मचारी / ABHA ID', status: 'डेमो पाळी / स्थिती',
    abha: 'डेमो ABHA - पडताळलेले नाही', close: 'प्रोफाइल बंद करा', toggle: 'डेमो मोड बदला',
    pharmacy: 'फार्मसी कार्यक्षेत्र', inventoryHint: 'इन्व्हेंटरीमध्ये साठा, औषध वितरण आणि मागण्या पहा.',
    availability: 'औषध उपलब्धता', stock: 'साठ्याचा तपशील', openInventory: 'इन्व्हेंटरी उघडा',
  },
};

const DEFAULT_STATS = {
  todaysReferrals: 14,
  referralTrend: 3,
  medicineAvailability: 82,
  patientsWaiting: 8,
  pendingHighRiskAlerts: 2,
  totalPatients: 248,
  facilitiesActive: 10,
  avgResponseTimeMinutes: 12,
  referralCompletionRate: 87,
  topConditions: ['Fever', 'Respiratory', 'Gastroenteritis'],
};

export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { t, language } = useTranslation();
  const copy = PROFILE_COPY[language];
  const { data, loading, error, refetch } = useApi(api.getDashboardStats);
  const { data: alertsData, error: alertsError, refetch: refetchAlerts } = useApi(api.getAlerts);
  const { data: referralsData, error: referralsError, refetch: refetchReferrals } = useApi(api.getActiveReferrals);
  const demoActive = useSyncExternalStore(onDemoModeChange, isDemoActive, isDemoActive);
  const [togglingDemo, setTogglingDemo] = useState(false);
  const [demoError, setDemoError] = useState(false);
  const demoToggleLock = useRef(false);

  const persona = useSyncExternalStore(onPersonaChange, getActivePersona, getActivePersona);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (persona.role === 'DOCTOR') {
      if (hour >= 5 && hour < 12) return { text: t('dashboard.goodMorning'), emoji: '🌅' };
      if (hour >= 12 && hour < 17) return { text: t('dashboard.goodAfternoon'), emoji: '☀️' };
      if (hour >= 17 && hour < 21) return { text: t('dashboard.goodEvening'), emoji: '🌆' };
      return { text: t('dashboard.nightDuty'), emoji: '🌙' };
    }
    return { text: `${t('dashboard.welcome')}, ${copy.roles[persona.role]}`, emoji: '' };
  };

  const greeting = getGreeting();

  const dateString = new Date().toLocaleDateString({ en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' }[language], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleDemoToggle = async () => {
    if (demoToggleLock.current) return;
    demoToggleLock.current = true;
    setTogglingDemo(true);
    setDemoError(false);
    try {
      await toggleDemoMode();
    } catch {
      setDemoError(true);
    } finally {
      demoToggleLock.current = false;
      setTogglingDemo(false);
    }
  };

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const stats = data || DEFAULT_STATS;
  const statsSample = !data || data.source === 'sample';
  const roleSample = persona.role !== 'DOCTOR' && persona.role !== 'PHARMACIST';
  const sourceText = (sample: boolean, stale: boolean) => t(sample || demoActive ? 'dashboard.sampleSource' : stale ? 'dashboard.staleSource' : 'dashboard.serverSource');

  const alerts = ((alertsData?.data as Alert[] | undefined) || MOCK_ALERTS.data) as Alert[];
  const highRiskAlerts = alerts.filter(a => a.priority === 'CRITICAL' || a.priority === 'HIGH');

  const activeReferrals = ((referralsData?.data as any[] | undefined) || MOCK_ACTIVE_REFERRALS) as any[];
  const redReferrals = activeReferrals.filter(r => r.severity === TriageSeverity.RED);
  const otherReferrals = activeReferrals.filter(r => r.severity !== TriageSeverity.RED);
  const sortedReferrals = [...redReferrals, ...otherReferrals];

  const animatedReferrals = useCountUp(stats.todaysReferrals, 1000);
  const animatedMedicine = useCountUp(stats.medicineAvailability, 1000);

  const handleRoleSelect = (role: UserRole) => {
    void setActivePersona(role);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => { void refetch(); void refetchAlerts(); void refetchReferrals(); }} />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>{greeting.text} {greeting.emoji}</Text>
              <Text style={styles.headerDate}>{dateString}</Text>
            </View>
            <View style={styles.headerRight}>
              <LanguageSwitcher />
              <TouchableOpacity
                style={[styles.avatar, { backgroundColor: persona.avatarColor }]}
                onPress={() => setShowProfileModal(true)}
                accessibilityRole="button"
                accessibilityLabel={t('dashboard.openProfile')}
                testID="home-profile"
                activeOpacity={0.8}
              >
                <Text style={styles.avatarText}>{persona.initials}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Emergency Escalation Banner */}
          <View style={styles.emergencyBannerWrap}>
            <Text style={styles.sourceNotice}>{sourceText(statsSample || persona.role === 'PATIENT', !!error)}</Text>
            <EmergencyBanner
              onPress={() => navigation.navigate('Emergency')}
              alertCount={persona.role === 'PATIENT' ? 1 : stats.pendingHighRiskAlerts}
            />
          </View>

          {/* Stat Cards */}
          <Text style={styles.sourceNotice}>{sourceText(statsSample || roleSample, !!error)}</Text>
          <View style={styles.statCardsRow}>
            {persona.role === 'DOCTOR' && (
              <>
                <StatCard title={t('dashboard.todayReferrals')} value={statsSample ? stats.todaysReferrals : animatedReferrals} trend={{ value: stats.referralTrend, direction: 'up' }} />
                <StatCard title={t('dashboard.medicineAvail')} value={`${statsSample ? stats.medicineAvailability : animatedMedicine}%`} progressBar={{ value: statsSample ? stats.medicineAvailability : animatedMedicine, max: 100 }} />
              </>
            )}
            {persona.role === 'ASHA' && (
              <>
                <StatCard title={t('dashboard.fieldScreenings')} value="18" trend={{ value: 5, direction: 'up' }} />
                <StatCard title={t('dashboard.ancMonitored')} value="94%" progressBar={{ value: 94, max: 100 }} />
              </>
            )}
            {persona.role === 'PATIENT' && (
              <>
                <StatCard title={t('dashboard.activeMedicines')} value="2 Rx" />
                <StatCard title={t('dashboard.healthIndex')} value="88%" progressBar={{ value: 88, max: 100 }} />
              </>
            )}
            {persona.role === 'ADMIN' && (
              <>
                <StatCard title={t('dashboard.phcsMonitored')} value="10/10" />
                <StatCard title={t('dashboard.bedOccupancy')} value="74%" progressBar={{ value: 74, max: 100 }} />
              </>
            )}
            {persona.role === 'PHARMACIST' && (
              <>
                <StatCard title={copy.availability} value={`${statsSample ? stats.medicineAvailability : animatedMedicine}%`} progressBar={{ value: statsSample ? stats.medicineAvailability : animatedMedicine, max: 100 }} />
                <StatCard title={copy.stock} value={t('common.inventory')} />
              </>
            )}
          </View>

          <View style={styles.divider} />

          {/* Queue Management */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{persona.role === 'PHARMACIST' ? copy.pharmacy : t('dashboard.queueManagement')}</Text>
            <Text style={styles.sourceNotice}>{sourceText(statsSample || roleSample, !!error)}</Text>
            {persona.role === 'PHARMACIST' && (
              <>
                <Text style={styles.inventoryHint}>{copy.inventoryHint}</Text>
                <TouchableOpacity style={styles.demoModeBtn} accessibilityRole="button" onPress={() => navigation.navigate('Inventory')}>
                  <Text style={styles.demoModeBtnText}>{copy.openInventory}</Text>
                </TouchableOpacity>
              </>
            )}
            {persona.role === 'DOCTOR' && (
              <QueueCard count={stats.patientsWaiting} label={t('dashboard.patientsWaiting')} />
            )}
            {persona.role === 'ASHA' && (
              <QueueCard count={3} label={t('dashboard.mothersDue')} />
            )}
            {persona.role === 'PATIENT' && (
              <QueueCard count={4} label={t('dashboard.sampleToken')} />
            )}
            {persona.role === 'ADMIN' && (
              <QueueCard count={74} label={t('dashboard.districtWaiting')} />
            )}
          </View>

          <View style={styles.divider} />

          {/* Active Referrals */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('dashboard.activeReferrals')}</Text>
              <View style={styles.alertBadge}>
                <Text style={styles.alertBadgeText}>{sortedReferrals.length} {t('dashboard.activeReferrals')}</Text>
              </View>
            </View>
            <Text style={styles.sourceNotice}>{sourceText(!referralsData?.data || referralsData.source === 'sample', !!referralsError)}</Text>
            <Text style={styles.viewOnly}>{t('dashboard.viewOnly')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {sortedReferrals.length === 0 ? (
                <Text style={styles.noAlerts}>{t('common.noData')}</Text>
              ) : (
                sortedReferrals.map((referral) => (
                  <View key={referral.id} pointerEvents="none" style={referral.severity === TriageSeverity.RED ? styles.redCardWrapper : styles.cardWrapper}>
                    <ReferralCard referral={referral} />
                  </View>
                ))
              )}
            </ScrollView>
          </View>

          <View style={styles.divider} />

          {/* High-Risk Alerts */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('dashboard.highRiskAlerts')}</Text>
              <View style={styles.alertBadge}>
                <Text style={styles.alertBadgeText}>{highRiskAlerts.length} {t('dashboard.pending')}</Text>
              </View>
            </View>
            <Text style={styles.sourceNotice}>{sourceText(!alertsData?.data || alertsData.source === 'sample', !!alertsError)}</Text>
            <Text style={styles.viewOnly}>{t('dashboard.viewOnly')}</Text>
            <View style={styles.alertsList} pointerEvents="none">
              {highRiskAlerts.slice(0, 3).map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
              {highRiskAlerts.length === 0 && (
                <Text style={styles.noAlerts}>{t('common.noData')}</Text>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Recent Referrals */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('dashboard.recentReferrals')}</Text>
            <Text style={styles.comingSoon}>{t('common.noData')}</Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Profile Modal */}
      <Modal visible={showProfileModal} animationType="slide" transparent={true} onRequestClose={() => setShowProfileModal(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalCard} contentContainerStyle={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={[styles.profileAvatar, { backgroundColor: persona.avatarColor }]}>
                <Text style={styles.profileAvatarText}>{persona.initials}</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} accessibilityRole="button" accessibilityLabel={copy.close} onPress={() => setShowProfileModal(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.profileName}>{persona.name}</Text>
            <Text style={styles.profileRole}>{persona.title}</Text>

            {/* Persona Switcher Buttons in Modal */}
            <View style={styles.roleSwitcherContainer}>
              <Text style={styles.roleSwitcherTitle}>{copy.switchRole}</Text>
              <View style={styles.roleSwitcherGrid}>
                {(Object.keys(PERSONAS) as UserRole[]).map((r) => {
                  const isSelected = persona.role === r;
                  const item = PERSONAS[r];
                  return (
                    <TouchableOpacity
                      key={r}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => handleRoleSelect(r)}
                      style={[
                        styles.roleButton,
                        isSelected && { borderColor: item.accent, backgroundColor: `${item.accent}15` },
                      ]}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.roleButtonText, isSelected && { color: item.accent, fontWeight: '700' }]}>
                        {copy.roles[r]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Meta Details Box */}
            <View style={styles.profileMetaBox}>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>{copy.facility}</Text>
                <Text style={styles.profileValue}>{persona.facility}</Text>
              </View>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>{copy.id}</Text>
                <Text style={styles.profileValue}>{persona.staffId}</Text>
              </View>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>{copy.status}</Text>
                <Text style={styles.profileValue}>{persona.role === 'PATIENT' ? copy.abha : persona.shiftOrAbha}</Text>
              </View>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>{copy.data}</Text>
                <Text style={styles.profileValue}>
                  {language === 'en' ? persona.dataLabel : persona.role === 'PATIENT' ? copy.patientDemo : copy.demo}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.profileActions}>
              <View style={[styles.demoModeBtn, styles.demoModeRow]}>
                <Text style={styles.demoModeBtnText}>{t('dashboard.demoMode')}</Text>
                <Switch testID="demo-mode-switch" accessibilityLabel={t('dashboard.demoMode')} value={demoActive} disabled={togglingDemo} onValueChange={() => void handleDemoToggle()} />
              </View>
              {demoError && <Text accessibilityRole="alert" style={styles.viewOnly}>{t('common.error')}</Text>}
              <TouchableOpacity
                style={styles.logoutBtn}
                onPress={() => setShowProfileModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.logoutText}>{copy.close}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: theme.layout.screenPadding, paddingTop: 8, paddingBottom: 24 },
  sourceNotice: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 8 },
  viewOnly: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18 },
  demoModeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  headerTitle: { fontSize: theme.typography.fontSize['2xl'], fontWeight: theme.typography.fontWeight.bold, color: COLORS.textPrimary },
  headerDate: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary, marginTop: 2 },
  avatar: { width: 40, height: 40, borderRadius: theme.borderRadius.full, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.textOnPrimary, fontSize: theme.typography.fontSize.md, fontWeight: theme.typography.fontWeight.bold },
  emergencyBannerWrap: { marginBottom: 4 },
  statCardsRow: { flexDirection: 'row', gap: 12, marginTop: 14, marginBottom: 6 },
  section: { gap: theme.spacing.md, marginTop: 16, marginBottom: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 20, marginBottom: 12, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  alertBadge: { backgroundColor: COLORS.emergency, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderRadius: theme.borderRadius.full },
  alertBadgeText: { color: COLORS.textOnPrimary, fontSize: theme.typography.fontSize.xs, fontWeight: theme.typography.fontWeight.semibold },
  alertsList: { gap: 10 },
  alertCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  noAlerts: { color: COLORS.textSecondary, fontSize: theme.typography.fontSize.sm, textAlign: 'center', paddingVertical: theme.spacing.lg },
  comingSoon: { color: COLORS.textSecondary, fontSize: theme.typography.fontSize.sm, textAlign: 'center', paddingVertical: theme.spacing.lg },
  horizontalScroll: { flexDirection: 'row', marginTop: 8, marginBottom: 4 },
  cardWrapper: { marginRight: theme.spacing.md, width: 280 },
  redCardWrapper: { marginRight: theme.spacing.md, width: 280, borderLeftWidth: 4, borderLeftColor: COLORS.severityRed },
  divider: { height: 1, backgroundColor: COLORS.border },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalContent: { padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  profileAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { color: '#FFF', fontSize: 24, fontWeight: '800' },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { fontSize: 16, color: '#666', fontWeight: '700' },
  profileName: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  profileRole: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 16 },
  roleSwitcherContainer: { marginBottom: 18 },
  roleSwitcherTitle: { fontSize: 12, fontWeight: '700', color: '#757575', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  roleSwitcherGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleButton: {
    flexGrow: 1,
    flexBasis: '30%',
    paddingHorizontal: 8,
    minHeight: 44,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleButtonText: { fontSize: 12, fontWeight: '600', color: '#616161' },
  profileMetaBox: { backgroundColor: '#F8F9FA', borderRadius: 16, padding: 16, gap: 12, marginBottom: 20 },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  profileLabel: { flex: 1, fontSize: 14, color: COLORS.textSecondary },
  profileValue: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  inventoryHint: { fontSize: 14, color: COLORS.textSecondary },
  profileActions: { gap: 10 },
  demoModeBtn: { backgroundColor: '#E0F2F1', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  demoModeBtnText: { color: '#00695C', fontWeight: '700', fontSize: 15 },
  logoutBtn: { backgroundColor: '#F5F5F5', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  logoutText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 15 },
});
