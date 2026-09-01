import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '@medisync/shared';
import { theme } from '../styles/theme';

interface QueueCardProps {
  count: number;
  label?: string;
  subtitle?: string;
  onPress?: () => void;
}

export const QueueCard: React.FC<QueueCardProps> = ({
  count,
  label = 'Patients Waiting',
  subtitle,
  onPress,
}) => {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.mainContent}>
        <View style={styles.textContent}>
          <Text style={styles.count}>{count}</Text>
          <Text style={styles.label}>{label}</Text>
        </View>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>👥</Text>
        </View>
      </View>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.primary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.md,
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContent: {
    flex: 1,
  },
  count: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize['4xl'],
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: 2,
  },
  label: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.medium,
    marginTop: theme.spacing.xs,
  },
  iconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: theme.borderRadius.full,
    padding: theme.spacing.md,
  },
  icon: {
    fontSize: theme.typography.fontSize['2xl'],
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: theme.typography.fontSize.sm,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
});
