import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, AlertPriority } from '@medisync/shared';
import { theme } from '../styles/theme';

interface Alert {
  id: string;
  type: string;
  priority: AlertPriority;
  title: string;
  message: string;
  facilityId: string;
  patientId?: string;
  isResolved: boolean;
  createdAt: Date | string;
}

interface AlertCardProps {
  alert: Alert;
  onPress?: () => void;
}

const priorityConfig = {
  [AlertPriority.CRITICAL]: { border: COLORS.severityRed, bg: '#FFF5F5', icon: '⚠️' },
  [AlertPriority.HIGH]: { border: COLORS.warning, bg: COLORS.surface, icon: '📦' },
  [AlertPriority.MEDIUM]: { border: COLORS.info, bg: COLORS.surface, icon: 'ℹ️' },
  [AlertPriority.LOW]: { border: COLORS.border, bg: COLORS.surface, icon: 'ℹ️' },
};

export const AlertCard: React.FC<AlertCardProps> = ({ alert, onPress }) => {
  const config = priorityConfig[alert.priority] || priorityConfig[AlertPriority.LOW];
  const timeAgo = getTimeAgo(new Date(alert.createdAt));

  return (
    <TouchableOpacity
      style={[styles.container, { borderLeftColor: config.border, backgroundColor: config.bg }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>{config.icon}</Text>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{alert.title}</Text>
        <Text style={styles.message} numberOfLines={2}>{alert.message}</Text>
        <Text style={styles.time}>{timeAgo}</Text>
      </View>
    </TouchableOpacity>
  );
};

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

const styles = StyleSheet.create({
  container: {
    borderLeftWidth: 4,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    flexDirection: 'row',
    gap: theme.spacing.md,
    ...theme.shadows.sm,
  },
  icon: {
    fontSize: theme.typography.fontSize.xl,
    marginTop: 2,
  },
  content: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  title: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
  message: {
    fontSize: theme.typography.fontSize.sm,
    color: COLORS.textSecondary,
  },
  time: {
    fontSize: theme.typography.fontSize.xs,
    color: COLORS.textSecondary,
  },
});
