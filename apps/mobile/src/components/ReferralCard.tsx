import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, TriageSeverity, ReferralStatus } from '@arogyasetu/shared';
import { theme } from '../styles/theme';

interface Referral {
  id: string;
  patientId: string;
  fromFacilityId: string;
  toFacilityId: string;
  severity: TriageSeverity;
  status: ReferralStatus;
  reason: string;
  aiTriageSummary: string;
  qrCode: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface ReferralCardProps {
  referral: Referral;
  onPress?: () => void;
}

const statusConfig: Record<ReferralStatus, { color: string; label: string }> = {
  [ReferralStatus.CREATED]: { color: COLORS.info, label: 'Created' },
  [ReferralStatus.ACCEPTED]: { color: COLORS.primary, label: 'Accepted' },
  [ReferralStatus.IN_TRANSIT]: { color: COLORS.warning, label: 'In Transit' },
  [ReferralStatus.ARRIVED]: { color: COLORS.success, label: 'Arrived' },
  [ReferralStatus.COMPLETED]: { color: COLORS.success, label: 'Completed' },
  [ReferralStatus.DROPPED]: { color: COLORS.danger, label: 'Dropped' },
};

export const ReferralCard: React.FC<ReferralCardProps> = ({ referral, onPress }) => {
  const statusInfo = statusConfig[referral.status] || statusConfig[ReferralStatus.CREATED];
  const severityDot = referral.severity === TriageSeverity.RED ? '🔴' : referral.severity === TriageSeverity.YELLOW ? '🟡' : '🟢';

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.patientName}>Patient #{referral.patientId.slice(-4)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
          <Text style={styles.statusText}>{statusInfo.label}</Text>
        </View>
      </View>
      <View style={styles.route}>
        <Text style={styles.routeText}>From: {referral.fromFacilityId}</Text>
        <Text style={styles.arrow}>→</Text>
        <Text style={styles.routeText}>To: {referral.toFacilityId}</Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.severity}>{severityDot} {referral.severity}</Text>
        <Text style={styles.id}>{referral.id}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  patientName: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  statusText: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  route: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  routeText: {
    fontSize: theme.typography.fontSize.sm,
    color: COLORS.textSecondary,
  },
  arrow: {
    fontSize: theme.typography.fontSize.sm,
    color: COLORS.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  severity: {
    fontSize: theme.typography.fontSize.xs,
    color: COLORS.textSecondary,
  },
  id: {
    fontSize: theme.typography.fontSize.xs,
    color: COLORS.textSecondary,
    fontFamily: 'monospace',
  },
});
