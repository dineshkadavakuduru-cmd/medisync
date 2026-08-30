import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@arogyasetu/shared';
import { theme } from '../styles/theme';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; direction: 'up' | 'down' };
  progressBar?: { value: number; max: number };
  style?: Record<string, any>;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  progressBar,
  style,
}) => {
  const progressPercent = progressBar ? Math.round((progressBar.value / progressBar.max) * 100) : 0;

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.value}>{value}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {trend && (
        <Text style={[
          styles.trend,
          trend.direction === 'up' ? styles.trendUp : styles.trendDown,
        ]}>
          {trend.direction === 'up' ? '↑' : '↓'}{trend.value}
        </Text>
      )}
      {progressBar && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.progressLabel}>{progressPercent}%</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    flex: 1,
    minWidth: 140,
    ...theme.shadows.sm,
  },
  title: {
    color: COLORS.textSecondary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  value: {
    color: COLORS.textPrimary,
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: theme.typography.fontWeight.bold,
    lineHeight: theme.typography.lineHeight.tight,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: theme.typography.fontSize.xs,
  },
  trend: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
    marginTop: theme.spacing.xs,
  },
  trendUp: {
    color: COLORS.success,
  },
  trendDown: {
    color: COLORS.danger,
  },
  progressContainer: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: theme.borderRadius.full,
  },
  progressLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: COLORS.textSecondary,
  },
});
