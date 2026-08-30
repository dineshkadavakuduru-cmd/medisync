import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { COLORS } from '@arogyasetu/shared';
import { theme } from '../styles/theme';
import { Emergency } from '../types/emergency';

const LEVEL_COLORS: Record<string, string> = {
  LEVEL_1: COLORS.emergency,
  LEVEL_2: COLORS.warning,
  LEVEL_3: COLORS.info,
};

const STATUS_COLORS: Record<string, string> = {
  INITIATED: COLORS.emergency,
  ACKNOWLEDGED: COLORS.warning,
  AMBULANCE_DISPATCHED: COLORS.info,
  AMBULANCE_EN_ROUTE: COLORS.info,
  PATIENT_PICKED_UP: COLORS.primary,
  EN_ROUTE_TO_HOSPITAL: COLORS.primary,
  ARRIVED: COLORS.primary,
  UNDER_TREATMENT: COLORS.primary,
  RESOLVED: COLORS.success,
  ESCALATED: COLORS.emergency,
};

interface EmergencyCardProps {
  emergency: Emergency;
  onPress: () => void;
}

export const EmergencyCard: React.FC<EmergencyCardProps> = ({ emergency, onPress }) => {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const isLevel1 = emergency.protocolLevel === 'LEVEL_1';

  React.useEffect(() => {
    if (isLevel1) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isLevel1, pulseAnim]);

  const levelColor = LEVEL_COLORS[emergency.protocolLevel] || COLORS.info;
  const statusColor = STATUS_COLORS[emergency.status] || COLORS.textSecondary;
  const timeAgo = getTimeAgo(emergency.createdAt);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { borderLeftColor: levelColor },
        isLevel1 && styles.level1Container,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View style={styles.leftHeader}>
          <View style={[styles.levelBadge, { backgroundColor: levelColor }]}>
            <Text style={styles.levelBadgeText}>{emergency.protocolLevel.replace('LEVEL_', 'L')}</Text>
          </View>
          <Text style={styles.timeAgo}>{timeAgo}</Text>
        </View>
        {isLevel1 && (
          <Animated.View style={[styles.pulsingDot, { transform: [{ scale: pulseAnim }] }]} />
        )}
      </View>

      <Text style={styles.condition}>{formatCondition(emergency.condition)}</Text>
      <Text style={styles.patient}>{emergency.patientName}, {emergency.patientAge}{emergency.patientGender}</Text>
      <Text style={styles.facility}>📍 {emergency.originFacilityId}</Text>

      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{formatStatus(emergency.status)}</Text>
        </View>
        {emergency.estimatedArrivalMinutes && emergency.status !== 'RESOLVED' && (
          <Text style={styles.eta}>🚑 ETA: {emergency.estimatedArrivalMinutes} min</Text>
        )}
      </View>

      {emergency.timeline.length > 0 && (
        <View style={styles.miniTimeline}>
          <Text style={styles.miniTimelineTitle}>Last events:</Text>
          {emergency.timeline.slice(-2).map((event) => (
            <Text key={event.id} style={styles.miniTimelineEvent}>
              {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {event.description.substring(0, 50)}...
            </Text>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
};

function getTimeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatCondition(condition: string): string {
  return condition.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ');
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderLeftWidth: 4,
    ...theme.shadows.md,
  },
  level1Container: {
    backgroundColor: COLORS.emergencyLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  leftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  levelBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  levelBadgeText: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
  },
  timeAgo: {
    fontSize: theme.typography.fontSize.xs,
    color: COLORS.textSecondary,
  },
  pulsingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.emergency,
  },
  condition: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: COLORS.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  patient: {
    fontSize: theme.typography.fontSize.sm,
    color: COLORS.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  facility: {
    fontSize: theme.typography.fontSize.sm,
    color: COLORS.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  statusText: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  eta: {
    fontSize: theme.typography.fontSize.sm,
    color: COLORS.info,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  miniTimeline: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: theme.spacing.xs,
  },
  miniTimelineTitle: {
    fontSize: theme.typography.fontSize.xs,
    color: COLORS.textSecondary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  miniTimelineEvent: {
    fontSize: theme.typography.fontSize.xs,
    color: COLORS.textSecondary,
  },
});
