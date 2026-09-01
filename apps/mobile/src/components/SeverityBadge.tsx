import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, TriageSeverity } from '@medisync/shared';
import { theme } from '../styles/theme';

interface SeverityBadgeProps {
  severity: 'GREEN' | 'YELLOW' | 'RED';
  size?: 'small' | 'medium';
}

const severityConfig = {
  [TriageSeverity.GREEN]: { color: COLORS.severityGreen, label: 'Mild' },
  [TriageSeverity.YELLOW]: { color: COLORS.severityYellow, label: 'Moderate' },
  [TriageSeverity.RED]: { color: COLORS.severityRed, label: 'Critical' },
};

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, size = 'medium' }) => {
  const config = severityConfig[severity] || severityConfig[TriageSeverity.GREEN];

  return (
    <View style={[styles.container, { borderColor: config.color }]}>
      <View style={[styles.dot, { backgroundColor: config.color, width: size === 'small' ? 6 : 8, height: size === 'small' ? 6 : 8 }]} />
      <Text style={[styles.text, { fontSize: size === 'small' ? theme.typography.fontSize.xs : theme.typography.fontSize.sm, color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    borderRadius: theme.borderRadius.full,
  },
  text: {
    fontWeight: theme.typography.fontWeight.semibold,
  },
});
