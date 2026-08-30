import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { COLORS } from '@arogyasetu/shared';
import { theme } from '../styles/theme';

interface EmergencyBannerProps {
  onPress?: () => void;
  text?: string;
  alertCount?: number;
}

export const EmergencyBanner: React.FC<EmergencyBannerProps> = ({
  onPress,
  text = 'Emergency Escalation',
  alertCount = 0,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      <Animated.View style={[styles.content, { opacity: pulseAnim }]}>
        <View style={styles.leftContent}>
          <Text style={styles.icon}>*</Text>
          <Text style={styles.text}>{text}</Text>
        </View>
        {alertCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{alertCount}</Text>
          </View>
        )}
        <Text style={styles.arrow}>→</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.emergency,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    ...theme.shadows.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  icon: {
    color: COLORS.textOnPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  text: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  badge: {
    backgroundColor: COLORS.textOnPrimary,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    marginHorizontal: theme.spacing.sm,
  },
  badgeText: {
    color: COLORS.emergency,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
  },
  arrow: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
  },
});
