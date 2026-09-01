import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@medisync/shared';
import { theme } from '../styles/theme';

interface AlertBadgeProps {
  count: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const AlertBadge: React.FC<AlertBadgeProps> = ({
  count,
  label = 'Pending',
  size = 'md',
}) => {
  const sizeStyles = {
    sm: { paddingHorizontal: 8, paddingVertical: 2, fontSize: 10, labelSize: 10 },
    md: { paddingHorizontal: 12, paddingVertical: 4, fontSize: 12, labelSize: 11 },
    lg: { paddingHorizontal: 16, paddingVertical: 6, fontSize: 14, labelSize: 12 },
  };

  const s = sizeStyles[size];

  return (
    <View style={[styles.container, { paddingHorizontal: s.paddingHorizontal, paddingVertical: s.paddingVertical }]}>
      <Text style={[styles.count, { fontSize: s.fontSize }]}>{count}</Text>
      <Text style={[styles.label, { fontSize: s.labelSize }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.emergency,
    borderRadius: theme.borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    ...theme.shadows.sm,
  },
  count: {
    color: COLORS.textOnPrimary,
    fontWeight: theme.typography.fontWeight.bold,
  },
  label: {
    color: COLORS.textOnPrimary,
    fontWeight: theme.typography.fontWeight.medium,
  },
});