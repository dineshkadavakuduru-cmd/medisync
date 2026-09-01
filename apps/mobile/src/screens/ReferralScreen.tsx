import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { COLORS, TriageSeverity, ReferralStatus, FacilityType } from '@medisync/shared';
import { theme } from '../styles/theme';
import { SeverityIndicator } from '../components/SeverityIndicator';

interface Referral {
  id: string;
  patientName: string;
  fromFacility: string;
  toFacility: string;
  severity: TriageSeverity;
  status: ReferralStatus;
  reason: string;
  createdAt: string;
}

const mockReferrals: Referral[] = [
  {
    id: 'REF-001',
    patientName: 'Rajesh Kumar',
    fromFacility: 'PHC Khed',
    toFacility: 'District Hospital Pune',
    severity: TriageSeverity.RED,
    status: ReferralStatus.IN_TRANSIT,
    reason: 'Acute MI - needs cath lab',
    createdAt: '2024-01-15 10:30',
  },
  {
    id: 'REF-002',
    patientName: 'Sunita Devi',
    fromFacility: 'Sub Centre Mulshi',
    toFacility: 'CHC Maval',
    severity: TriageSeverity.YELLOW,
    status: ReferralStatus.ACCEPTED,
    reason: 'High fever with dehydration',
    createdAt: '2024-01-15 09:15',
  },
  {
    id: '3',
    patientName: 'Amit Patil',
    fromFacility: 'PHC Khed',
    toFacility: 'CHC Maval',
    severity: TriageSeverity.GREEN,
    status: ReferralStatus.COMPLETED,
    reason: 'Follow-up for hypertension',
    createdAt: '2024-01-14 14:20',
  },
];

const statusConfig = {
  [ReferralStatus.CREATED]: { color: COLORS.info, label: 'Created' },
  [ReferralStatus.ACCEPTED]: { color: COLORS.primary, label: 'Accepted' },
  [ReferralStatus.IN_TRANSIT]: { color: COLORS.warning, label: 'In Transit' },
  [ReferralStatus.ARRIVED]: { color: COLORS.info, label: 'Arrived' },
  [ReferralStatus.COMPLETED]: { color: COLORS.success, label: 'Completed' },
  [ReferralStatus.DROPPED]: { color: COLORS.textSecondary, label: 'Dropped' },
};

export const ReferralScreen: React.FC = () => {
  const [segment, setSegment] = useState<'active' | 'history'>('active');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Referrals</Text>
        <Text style={styles.headerSubtitle}>Track patient referrals</Text>
      </View>

      {/* Segment Control */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segmentButton, segment === 'active' && styles.segmentButtonActive]}
          onPress={() => setSegment('active')}
        >
          <Text style={[styles.segmentText, segment === 'active' && styles.segmentTextActive]}>
            Active ({mockReferrals.filter(r => r.status !== ReferralStatus.COMPLETED && r.status !== ReferralStatus.DROPPED).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentButton, segment === 'history' && styles.segmentButtonActive]}
          onPress={() => setSegment('history')}
        >
          <Text style={[styles.segmentText, segment === 'history' && styles.segmentTextActive]}>
            History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Create Referral Button */}
      <TouchableOpacity style={styles.createButton}>
        <Text style={styles.createButtonText}>+ Create New Referral</Text>
      </TouchableOpacity>

      {/* Referral List */}
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {mockReferrals
          .filter((r) =>
            segment === 'active'
              ? r.status !== ReferralStatus.COMPLETED && r.status !== ReferralStatus.DROPPED
              : r.status === ReferralStatus.COMPLETED || r.status === ReferralStatus.DROPPED
          )
          .map((referral) => (
            <TouchableOpacity key={referral.id} style={styles.referralCard} onPress={() => {}}>
              <View style={styles.referralHeader}>
                <View style={styles.referralIdRow}>
                  <Text style={styles.referralId}>{referral.id}</Text>
                  <SeverityIndicator severity={referral.severity} size="sm" />
                </View>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: statusConfig[referral.status].color },
                ]}>
                  <Text style={styles.statusText}>{statusConfig[referral.status].label}</Text>
                </View>
              </View>

              <View style={styles.referralRoute}>
                <View style={styles.routeItem}>
                  <Text style={styles.routeLabel}>FROM</Text>
                  <Text style={styles.routeFacility}>{referral.fromFacility}</Text>
                </View>
                <Text style={styles.routeArrow}>→</Text>
                <View style={styles.routeItem}>
                  <Text style={styles.routeLabel}>TO</Text>
                  <Text style={styles.routeFacility}>{referral.toFacility}</Text>
                </View>
              </View>

              <Text style={styles.referralReason}>{referral.reason}</Text>
              <Text style={styles.referralTime}>{referral.createdAt}</Text>
            </TouchableOpacity>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: theme.typography.fontSize.md,
    color: COLORS.textSecondary,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xs,
    marginHorizontal: theme.layout.screenPadding,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: COLORS.primary,
  },
  segmentText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  segmentTextActive: {
    color: COLORS.textOnPrimary,
  },
  createButton: {
    marginHorizontal: theme.layout.screenPadding,
    marginBottom: theme.spacing.md,
    backgroundColor: COLORS.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    ...theme.shadows.md,
  },
  createButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  listContent: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingBottom: theme.layout.tabBarHeight + theme.spacing.lg,
    gap: theme.spacing.md,
  },
  referralCard: {
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  referralHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  referralIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  referralId: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    color: COLORS.primary,
    fontFamily: 'monospace',
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  statusText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
    color: COLORS.textOnPrimary,
  },
  referralRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  routeItem: {
    flex: 1,
    alignItems: 'center',
  },
  routeLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  routeFacility: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  routeArrow: {
    fontSize: theme.typography.fontSize.lg,
    color: COLORS.textSecondary,
  },
  referralReason: {
    fontSize: theme.typography.fontSize.md,
    color: COLORS.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  referralTime: {
    fontSize: theme.typography.fontSize.xs,
    color: COLORS.textSecondary,
  },
});