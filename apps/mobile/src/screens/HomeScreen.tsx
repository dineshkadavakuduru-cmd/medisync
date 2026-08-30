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
  Dimensions,
} from 'react-native';
import { COLORS, TriageSeverity, Alert } from '@arogyasetu/shared';
import { theme } from '../styles/theme';
import { EmergencyBanner } from '../components/EmergencyBanner';
import { StatCard } from '../components/StatCard';
import { QueueCard } from '../components/QueueCard';
import { AlertCard } from '../components/AlertCard';
import { ReferralCard } from '../components/ReferralCard';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useTranslation } from '../i18n';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useCountUp } from '../hooks/useCountUp';
import { isDemoActive, toggleDemoMode } from '../services/demoMode';

export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { t } = useTranslation();
  const { data, loading, refetch } = useApi(() => api.getDashboardStats());
  const { data: alertsData, refetch: refetchAlerts } = useApi(() => api.getAlerts());
  const { data: referralsData } = useApi(() => api.getActiveReferrals());

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const sosScale = useRef(new Animated.Value(1)).current;

  const tapCount = useRef(0);
  const lastTap = useRef(0);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: 'Good Morning, Dr. Sharma', emoji: '🌅' };
    if (hour >= 12 && hour < 17) return { text: 'Good Afternoon, Dr. Sharma', emoji: '☀️' };
    if (hour >= 17 && hour < 21) return { text: 'Good Evening, Dr. Sharma', emoji: '🌆' };
    return { text: 'On Night Duty, Dr. Sharma', emoji: '🌙' };
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

  const stats = data || {
    todaysReferrals: 0,
    referralTrend: 0,
    medicineAvailability: 0,
    patientsWaiting: 0,
    pendingHighRiskAlerts: 0,
    totalPatients: 0,
    facilitiesActive: 0,
    avgResponseTimeMinutes: 0,
    referralCompletionRate: 0,
    topConditions: [],
  };

  const alerts = (alertsData?.data || []) as Alert[];
  const highRiskAlerts = alerts.filter(a => a.priority === 'CRITICAL' || a.priority === 'HIGH');

  const activeReferrals = (referralsData?.data || []) as any[];
  const redReferrals = activeReferrals.filter(r => r.severity === TriageSeverity.RED);
  const otherReferrals = activeReferrals.filter(r => r.severity !== TriageSeverity.RED);
  const sortedReferrals = [...redReferrals, ...otherReferrals];

  const animatedReferrals = useCountUp(stats.todaysReferrals, 1000);
  const animatedMedicine = useCountUp(stats.medicineAvailability, 1000);

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
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={handleTitlePress} activeOpacity={0.8}>
                <Text style={styles.headerTitle}>{greeting.text} {greeting.emoji}</Text>
              </TouchableOpacity>
              <Text style={styles.headerDate}>{dateString}</Text>
            </View>
            <View style={styles.headerRight}>
              <LanguageSwitcher />
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>AD</Text>
              </View>
            </View>
          </View>

          <EmergencyBanner onPress={() => navigation.navigate('Emergency')} alertCount={stats.pendingHighRiskAlerts} />

          <View style={styles.statCardsRow}>
            <StatCard title={t('dashboard.todayReferrals')} value={animatedReferrals} trend={{ value: stats.referralTrend, direction: 'up' }} />
            <StatCard title={t('dashboard.medicineAvail')} value={`${animatedMedicine}%`} progressBar={{ value: animatedMedicine, max: 100 }} />
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('dashboard.queueManagement')}</Text>
            <QueueCard count={stats.patientsWaiting} label={t('dashboard.patientsWaiting')} />
          </View>

          <View style={styles.divider} />

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

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('dashboard.recentReferrals')}</Text>
            <Text style={styles.comingSoon}>{t('common.noData')}</Text>
          </View>
        </Animated.View>
      </ScrollView>

      <TouchableOpacity
        style={styles.sosFab}
        onPress={() => navigation.navigate('EmergencyCreate')}
        activeOpacity={0.9}
      >
        <Animated.View style={[styles.sosFabInner, { transform: [{ scale: sosScale }] }]}>
          <Text style={styles.sosFabText}>SOS</Text>
        </Animated.View>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: theme.layout.tabBarHeight + theme.spacing.lg, gap: 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  headerTitle: { fontSize: theme.typography.fontSize['2xl'], fontWeight: theme.typography.fontWeight.bold, color: COLORS.textPrimary },
  headerDate: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary, marginTop: 2 },
  avatar: { width: 40, height: 40, borderRadius: theme.borderRadius.full, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.textOnPrimary, fontSize: theme.typography.fontSize.md, fontWeight: theme.typography.fontWeight.bold },
  statCardsRow: { flexDirection: 'row', gap: theme.spacing.md },
  section: { gap: theme.spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, color: COLORS.textPrimary, marginBottom: theme.spacing.sm },
  alertBadge: { backgroundColor: COLORS.emergency, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderRadius: theme.borderRadius.full },
  alertBadgeText: { color: COLORS.textOnPrimary, fontSize: theme.typography.fontSize.xs, fontWeight: theme.typography.fontWeight.semibold },
  alertsList: { gap: theme.spacing.sm },
  noAlerts: { color: COLORS.textSecondary, fontSize: theme.typography.fontSize.sm, textAlign: 'center', paddingVertical: theme.spacing.lg },
  comingSoon: { color: COLORS.textSecondary, fontSize: theme.typography.fontSize.sm, textAlign: 'center', paddingVertical: theme.spacing.lg },
  horizontalScroll: { flexDirection: 'row' },
  cardWrapper: { marginRight: theme.spacing.md, width: 280 },
  redCardWrapper: { marginRight: theme.spacing.md, width: 280, borderLeftWidth: 4, borderLeftColor: COLORS.severityRed },
  divider: { height: 1, backgroundColor: COLORS.border },
  sosFab: {
    position: 'absolute',
    bottom: theme.layout.tabBarHeight + 16,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(198,40,40,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  sosFabInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.emergency,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.emergency,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  sosFabText: {
    color: COLORS.textOnPrimary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
});
