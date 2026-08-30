import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Linking,
  Animated,
} from 'react-native';
import { COLORS } from '@arogyasetu/shared';
import { theme } from '../styles/theme';
import { api } from '../services/api';
import { useTranslation } from '../i18n';

const STATUS_FLOW = ['INITIATED', 'ACKNOWLEDGED', 'AMBULANCE_DISPATCHED', 'AMBULANCE_EN_ROUTE', 'PATIENT_PICKED_UP', 'EN_ROUTE_TO_HOSPITAL', 'ARRIVED', 'UNDER_TREATMENT', 'RESOLVED'];
const LEVEL_COLORS: Record<string, string> = { LEVEL_1: COLORS.emergency, LEVEL_2: COLORS.warning, LEVEL_3: COLORS.info };

interface EmergencyDetailScreenProps {
  navigation: any;
  route: any;
}

export const EmergencyDetailScreen: React.FC<EmergencyDetailScreenProps> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { emergencyId } = route.params;
  const [emergency, setEmergency] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState('0m 0s');
  const elapsedInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadEmergency = useCallback(async () => {
    try {
      const [emgRes, tlRes] = await Promise.all([
        api.getEmergency(emergencyId),
        api.getEmergencyTimeline(emergencyId),
      ]);
      if (emgRes.success) {
        setEmergency(emgRes.data);
        setTimeline(tlRes.data?.timeline || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [emergencyId]);

  useEffect(() => {
    loadEmergency();
    const interval = setInterval(loadEmergency, 5000);
    return () => clearInterval(interval);
  }, [loadEmergency]);

  useEffect(() => {
    if (!emergency) return;
    elapsedInterval.current = setInterval(() => {
      const diff = Date.now() - new Date(emergency.createdAt).getTime();
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setElapsed(`${minutes}m ${seconds}s`);
    }, 1000);
    return () => {
      if (elapsedInterval.current) clearInterval(elapsedInterval.current);
    };
  }, [emergency]);

  useEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: COLORS.emergency },
      headerTintColor: COLORS.textOnPrimary,
    });
  }, [navigation]);

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleAcknowledge = async () => {
    await api.acknowledgeEmergency(emergencyId, 'user-current');
    loadEmergency();
  };

  const handleResolve = async () => {
    await api.updateEmergencyStatus(emergencyId, 'RESOLVED', 'user-current', 'Patient stabilized and resolved');
    loadEmergency();
  };

  const handleEscalate = async () => {
    await api.updateEmergencyStatus(emergencyId, 'ESCALATED', 'user-current', 'Manually escalated to district');
    loadEmergency();
  };

  const toggleStep = (index: number) => {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!emergency) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{t('common.noData')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentStatusIndex = STATUS_FLOW.indexOf(emergency.status);
  const levelColor = LEVEL_COLORS[emergency.protocolLevel] || COLORS.info;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { backgroundColor: levelColor }]}>
          <Text style={styles.headerId}>{emergency.id}</Text>
          <View style={[styles.levelBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={styles.levelBadgeText}>{emergency.protocolLevel}</Text>
          </View>
          <Text style={styles.elapsedText}>⏱ {elapsed}</Text>
        </View>

        <View style={styles.statusSection}>
          <Text style={styles.sectionTitle}>{t('emergency.statusProgress')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusFlow}>
            {STATUS_FLOW.map((status, index) => {
              const isCompleted = index <= currentStatusIndex && emergency.status !== 'ESCALATED' || (status === 'RESOLVED' && emergency.status === 'RESOLVED');
              const isCurrent = status === emergency.status;
              return (
                <View key={status} style={styles.statusItem}>
                  <View style={[styles.statusCircle, isCurrent && { backgroundColor: COLORS.emergency, transform: [{ scale: 1.2 }] }, isCompleted && !isCurrent && { backgroundColor: COLORS.success }]} />
                  {index < STATUS_FLOW.length - 1 && <View style={[styles.statusLine, index < currentStatusIndex && { backgroundColor: COLORS.success }]} />}
                  <Text style={[styles.statusLabel, isCurrent && styles.statusLabelCurrent]}>{status.replace(/_/g, ' ')}</Text>
                </View>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('emergency.statusProgress')}</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>👤 {emergency.patientName}, {emergency.patientAge}{emergency.patientGender}</Text>
            <Text style={styles.infoText}>🏥 {emergency.originFacilityId}</Text>
            <Text style={styles.infoText}>🩺 {formatCondition(emergency.condition)}</Text>
            {emergency.ambulanceId && <Text style={styles.infoText}>🚑 Ambulance: {emergency.ambulanceId}</Text>}
            {emergency.estimatedArrivalMinutes && <Text style={styles.infoText}>⏱ {t('emergency.eta')}: {emergency.estimatedArrivalMinutes} {t('emergency.minutes')}</Text>}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('emergency.recentHistory')}</Text>
          <View style={styles.timeline}>
            {timeline.map((event, index) => (
              <View key={event.id || index} style={styles.timelineItem}>
                <View style={[styles.timelineDot, event.automated ? styles.timelineDotAuto : event.event.includes('ESCALATED') || event.event.includes('AMBULANCE') ? styles.timelineDotRed : styles.timelineDotTeal]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineEvent}>{event.description}</Text>
                  <Text style={styles.timelineTime}>{new Date(event.timestamp).toLocaleTimeString()}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('emergency.firstAidSteps')}</Text>
          {emergency.firstAidSteps.map((step: string, index: number) => (
            <TouchableOpacity key={index} style={styles.checkItem} onPress={() => toggleStep(index)}>
              <View style={[styles.checkbox, checkedSteps.has(index) && styles.checkboxChecked]}>
                {checkedSteps.has(index) && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={[styles.checkText, checkedSteps.has(index) && styles.checkTextChecked]}>{step}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actionSection}>
          {emergency.status === 'INITIATED' && (
            <TouchableOpacity style={styles.acknowledgeButton} onPress={handleAcknowledge}>
              <Text style={styles.acknowledgeButtonText}>✅ Acknowledge</Text>
            </TouchableOpacity>
          )}
          {['ACKNOWLEDGED', 'AMBULANCE_DISPATCHED'].includes(emergency.status) && (
            <TouchableOpacity style={styles.resolveButton} onPress={handleResolve}>
              <Text style={styles.resolveButtonText}>✅ {t('emergency.markResolved')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.escalateButton} onPress={handleEscalate}>
            <Text style={styles.escalateButtonText}>⬆️ {t('emergency.escalateToDistrict')}</Text>
          </TouchableOpacity>
          {emergency.ambulanceId && (
            <TouchableOpacity style={styles.callButton} onPress={() => handleCall('108')}>
              <Text style={styles.callButtonText}>📞 {t('emergency.callHospital')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

function formatCondition(condition: string): string {
  return condition.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: theme.typography.fontSize.md,
  },
  errorText: {
    color: COLORS.emergency,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  scrollContent: {
    paddingBottom: theme.layout.tabBarHeight + theme.spacing.lg,
  },
  header: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  headerId: {
    fontSize: theme.typography.fontSize.sm,
    color: COLORS.textOnPrimary,
    opacity: 0.9,
    fontFamily: 'monospace',
  },
  levelBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  levelBadgeText: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
  },
  elapsedText: {
    fontSize: theme.typography.fontSize.md,
    color: COLORS.textOnPrimary,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  statusSection: {
    padding: theme.layout.screenPadding,
    gap: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: COLORS.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  statusFlow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusItem: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  statusCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.border,
  },
  statusLine: {
    width: 30,
    height: 3,
    backgroundColor: COLORS.border,
    marginHorizontal: theme.spacing.xs,
  },
  statusLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  statusLabelCurrent: {
    color: COLORS.emergency,
    fontWeight: theme.typography.fontWeight.bold,
  },
  section: {
    paddingHorizontal: theme.layout.screenPadding,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  infoText: {
    fontSize: theme.typography.fontSize.md,
    color: COLORS.textPrimary,
  },
  timeline: {
    gap: theme.spacing.md,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'flex-start',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.border,
    marginTop: 4,
  },
  timelineDotAuto: {
    backgroundColor: COLORS.textSecondary,
  },
  timelineDotRed: {
    backgroundColor: COLORS.emergency,
  },
  timelineDotTeal: {
    backgroundColor: COLORS.primary,
  },
  timelineContent: {
    flex: 1,
  },
  timelineEvent: {
    fontSize: theme.typography.fontSize.sm,
    color: COLORS.textPrimary,
  },
  timelineTime: {
    fontSize: theme.typography.fontSize.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  checkmark: {
    color: COLORS.textOnPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  checkText: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  checkTextChecked: {
    color: COLORS.textSecondary,
    textDecorationLine: 'line-through',
  },
  actionSection: {
    paddingHorizontal: theme.layout.screenPadding,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  acknowledgeButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  acknowledgeButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
  resolveButton: {
    backgroundColor: COLORS.success,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  resolveButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
  escalateButton: {
    borderWidth: 2,
    borderColor: COLORS.emergency,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  escalateButtonText: {
    color: COLORS.emergency,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
  callButton: {
    backgroundColor: COLORS.info,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  callButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
});