import React, { useEffect, useRef, useState } from 'react';
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
import { toggleDemoMode } from '../services/demoMode';
import {
  Persona,
  UserRole,
  PERSONAS,
  initActivePersona,
  getActivePersona,
  setActivePersona,
  onPersonaChange,
} from '../services/personas';

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
  const { t } = useTranslation();
  const { data, loading, refetch } = useApi(() => api.getDashboardStats());
  const { data: alertsData, refetch: refetchAlerts } = useApi(() => api.getAlerts());
  const { data: referralsData } = useApi(() => api.getActiveReferrals());

  const [persona, setPersona] = useState<Persona>(getActivePersona());
  const [showProfileModal, setShowProfileModal] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const sosScale = useRef(new Animated.Value(1)).current;

  const tapCount = useRef(0);
  const lastTap = useRef(0);

  useEffect(() => {
    initActivePersona().then((p) => setPersona(p));
    const unsubscribe = onPersonaChange((newP) => setPersona(newP));
    return () => unsubscribe();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (persona.role === 'DOCTOR') {
      if (hour >= 5 && hour < 12) return { text: 'Good Morning, Dr. Sharma', emoji: '🌅' };
      if (hour >= 12 && hour < 17) return { text: 'Good Afternoon, Dr. Sharma', emoji: '☀️' };
      if (hour >= 17 && hour < 21) return { text: 'Good Evening, Dr. Sharma', emoji: '🌆' };
      return { text: 'On Night Duty, Dr. Sharma', emoji: '🌙' };
    }
    return { text: persona.greetingTitle, emoji: '' };
  };

  const greeting = getGreeting();

  const dateString = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleTitlePress = () => {
    const now = Date.now();
    if (now - lastTap.current < 500) {
      tapCount.current += 1;
    } else {
      tapCount.current = 1;
    }
    lastTap.current = now;

    if (tapCount.current >= 5) {
      tapCount.current = 0;
      toggleDemoMode();
    }
  };

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(sosScale, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        Animated.timing(sosScale, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [sosScale]);

  const stats = data || DEFAULT_STATS;

  const alerts = ((alertsData?.data as Alert[] | undefined) || MOCK_ALERTS.data) as Alert[];
  const highRiskAlerts = alerts.filter(a => a.priority === 'CRITICAL' || a.priority === 'HIGH');

  const activeReferrals = ((referralsData?.data as any[] | undefined) || MOCK_ACTIVE_REFERRALS) as any[];
  const redReferrals = activeReferrals.filter(r => r.severity === TriageSeverity.RED);
  const otherReferrals = activeReferrals.filter(r => r.severity !== TriageSeverity.RED);
  const sortedReferrals = [...redReferrals, ...otherReferrals];

  const animatedReferrals = useCountUp(stats.todaysReferrals, 1000);
  const animatedMedicine = useCountUp(stats.medicineAvailability, 1000);

  const handleRoleSelect = async (role: UserRole) => {
    const updated = await setActivePersona(role);
    setPersona(updated);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => { refetch(); refetchAlerts(); }} />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={handleTitlePress} activeOpacity={0.8}>
                <Text style={styles.headerTitle}>{greeting.text} {greeting.emoji}</Text>
              </TouchableOpacity>
              <Text style={styles.headerDate}>{dateString}</Text>
            </View>
            <View style={styles.headerRight}>
              <LanguageSwitcher />
              <TouchableOpacity
                style={[styles.avatar, { backgroundColor: persona.avatarColor }]}
                onPress={() => setShowProfileModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.avatarText}>{persona.initials}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Emergency Escalation Banner */}
          <View style={styles.emergencyBannerWrap}>
            <EmergencyBanner
              onPress={() => navigation.navigate('Emergency')}
              alertCount={persona.role === 'PATIENT' ? 1 : stats.pendingHighRiskAlerts}
            />
          </View>

          {/* Stat Cards */}
          <View style={styles.statCardsRow}>
            {persona.role === 'DOCTOR' && (
              <>
                <StatCard title={t('dashboard.todayReferrals')} value={animatedReferrals} trend={{ value: stats.referralTrend, direction: 'up' }} />
                <StatCard title={t('dashboard.medicineAvail')} value={`${animatedMedicine}%`} progressBar={{ value: animatedMedicine, max: 100 }} />
              </>
            )}
            {persona.role === 'ASHA' && (
              <>
                <StatCard title="Field Screenings" value="18" trend={{ value: 5, direction: 'up' }} />
                <StatCard title="ANC Care Monitored" value="94%" progressBar={{ value: 94, max: 100 }} />
              </>
            )}
            {persona.role === 'PATIENT' && (
              <>
                <StatCard title="Active Medicines" value="2 Rx" />
                <StatCard title="Health Index" value="88%" progressBar={{ value: 88, max: 100 }} />
              </>
            )}
            {persona.role === 'ADMIN' && (
              <>
                <StatCard title="PHCs Monitored" value="10/10" />
                <StatCard title="Bed Occupancy" value="74%" progressBar={{ value: 74, max: 100 }} />
              </>
            )}
          </View>

          <View style={styles.divider} />

          {/* Queue Management */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('dashboard.queueManagement')}</Text>
            {persona.role === 'DOCTOR' && (
              <QueueCard count={stats.patientsWaiting} label={t('dashboard.patientsWaiting')} />
            )}
            {persona.role === 'ASHA' && (
              <QueueCard count={3} label="Mothers Due for Home Visit" />
            )}
            {persona.role === 'PATIENT' && (
              <QueueCard count={4} label="Token #04 • Approx 15 min wait at OPD" />
            )}
            {persona.role === 'ADMIN' && (
              <QueueCard count={74} label="Patients Waiting Across District PHCs" />
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {sortedReferrals.length === 0 ? (
                <Text style={styles.noAlerts}>{t('common.noData')}</Text>
              ) : (
                sortedReferrals.map((referral) => (
                  <View key={referral.id} style={referral.severity === TriageSeverity.RED ? styles.redCardWrapper : styles.cardWrapper}>
                    <ReferralCard referral={referral} onPress={() => {}} />
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
            <View style={styles.alertsList}>
              {highRiskAlerts.slice(0, 3).map((alert) => (
                <AlertCard key={alert.id} alert={alert} onPress={() => {}} />
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

      {/* Floating SOS button */}
      <TouchableOpacity
        style={styles.sosFab}
        onPress={() => navigation.navigate('EmergencyCreate')}
        activeOpacity={0.9}
      >
        <Animated.View style={[styles.sosFabInner, { transform: [{ scale: sosScale }] }]}>
          <Text style={styles.sosFabText}>SOS</Text>
        </Animated.View>
      </TouchableOpacity>

      {/* Profile Modal */}
      <Modal visible={showProfileModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={[styles.profileAvatar, { backgroundColor: persona.avatarColor }]}>
                <Text style={styles.profileAvatarText}>{persona.initials}</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowProfileModal(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.profileName}>{persona.name}</Text>
            <Text style={styles.profileRole}>{persona.title}</Text>

            {/* Persona Switcher Buttons in Modal */}
            <View style={styles.roleSwitcherContainer}>
              <Text style={styles.roleSwitcherTitle}>Switch Persona / Role:</Text>
              <View style={styles.roleSwitcherGrid}>
                {(['DOCTOR', 'ASHA', 'PATIENT', 'ADMIN'] as UserRole[]).map((r) => {
                  const isSelected = persona.role === r;
                  const item = PERSONAS[r];
                  return (
                    <TouchableOpacity
                      key={r}
                      onPress={() => handleRoleSelect(r)}
                      style={[
                        styles.roleButton,
                        isSelected && { borderColor: item.accent, backgroundColor: `${item.accent}15` },
                      ]}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.roleButtonText, isSelected && { color: item.accent, fontWeight: '700' }]}>
                        {r === 'DOCTOR' && '👨‍⚕️ Doctor'}
                        {r === 'ASHA' && '👩‍⚕️ ASHA'}
                        {r === 'PATIENT' && '👨‍🌾 Patient'}
                        {r === 'ADMIN' && '🏛️ Admin'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Meta Details Box */}
            <View style={styles.profileMetaBox}>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>🏥 Facility</Text>
                <Text style={styles.profileValue}>{persona.facility}</Text>
              </View>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>🆔 Staff / ABHA ID</Text>
                <Text style={styles.profileValue}>{persona.staffId}</Text>
              </View>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>⏰ Shift / Status</Text>
                <Text style={styles.profileValue}>{persona.shiftOrAbha}</Text>
              </View>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>📶 Offline Sync</Text>
                <Text style={[styles.profileValue, { color: COLORS.success, fontWeight: '700' }]}>
                  {persona.syncStatus}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.profileActions}>
              <TouchableOpacity
                style={styles.demoModeBtn}
                onPress={() => {
                  toggleDemoMode();
                  setShowProfileModal(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.demoModeBtnText}>🎮 Toggle Demo Mode</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.logoutBtn}
                onPress={() => setShowProfileModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.logoutText}>Close Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: theme.layout.screenPadding, paddingTop: 8, paddingBottom: 120 },
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
  sosFab: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(198,40,40,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
    elevation: 8,
  },
  sosFabInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.emergency,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.emergency,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  sosFabText: {
    color: COLORS.textOnPrimary,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  profileAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { color: '#FFF', fontSize: 24, fontWeight: '800' },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { fontSize: 16, color: '#666', fontWeight: '700' },
  profileName: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  profileRole: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 16 },
  roleSwitcherContainer: { marginBottom: 18 },
  roleSwitcherTitle: { fontSize: 12, fontWeight: '700', color: '#757575', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  roleSwitcherGrid: { flexDirection: 'row', gap: 8 },
  roleButton: {
    flex: 1,
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
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profileLabel: { fontSize: 14, color: COLORS.textSecondary },
  profileValue: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  profileActions: { gap: 10 },
  demoModeBtn: { backgroundColor: '#E0F2F1', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  demoModeBtnText: { color: '#00695C', fontWeight: '700', fontSize: 15 },
  logoutBtn: { backgroundColor: '#F5F5F5', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  logoutText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 15 },
});
