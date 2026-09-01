import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, TriageSeverity } from '@medisync/shared';
import { theme } from '../styles/theme';

interface SeverityIndicatorProps {
  severity: TriageSeverity;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const severityConfig = {
  [TriageSeverity.GREEN]: {
    color: COLORS.severityGreen,
    label: 'Mild',
    emoji: '🟢',
  },
  [TriageSeverity.YELLOW]: {
    color: COLORS.severityYellow,
    label: 'Moderate',
    emoji: '🟡',
  },
  [TriageSeverity.RED]: {
    color: COLORS.severityRed,
    label: 'Critical',
    emoji: '🔴',
  },
};

const sizeConfig = {
  sm: { dotSize: 8, fontSize: 10, gap: 4 },
  md: { dotSize: 12, fontSize: 12, gap: 6 },
  lg: { dotSize: 16, fontSize: 14, gap: 8 },
};

export const SeverityIndicator: React.FC<SeverityIndicatorProps> = ({
  severity,
  size = 'md',
  showLabel = true,
}) => {
  const config = severityConfig[severity];
  const s = sizeConfig[size];

  return (
    <View style={[styles.container, { gap: s.gap }]}>
      <View
        style={[
          styles.dot,
          { width: s.dotSize, height: s.dotSize, backgroundColor: config.color },
        ]}
      />
      {showLabel && (
        <Text style={[styles.label, { fontSize: s.fontSize, color: config.color }]}>
          {config.label}
        </Text>
      )}
    </View>
  );
};

export const SeverityEmoji: React.FC<{ severity: TriageSeverity; size?: number }> = ({
  severity,
  size = 20,
}) => {
  const config = severityConfig[severity];
  return <Text style={{ fontSize: size }}>{config.emoji}</Text>;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    borderRadius: theme.borderRadius.full,
  },
  label: {
    fontWeight: theme.typography.fontWeight.semibold,
  },
});