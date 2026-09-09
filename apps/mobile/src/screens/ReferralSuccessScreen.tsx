import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { COLORS, TriageSeverity } from '@medisync/shared';
import { theme } from '../styles/theme';
import { useNavigation, useRoute } from '@react-navigation/native';

export const ReferralSuccessScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const scaleAnim = useRef(new Animated.Value(0)).current;

  const referral = (route.params as any)?.referral;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const severity = referral?.severity as TriageSeverity || TriageSeverity.GREEN;
  const severityConfig: Record<TriageSeverity, { color: string; label: string }> = {
    [TriageSeverity.GREEN]: { color: COLORS.severityGreen, label: 'Mild' },
    [TriageSeverity.YELLOW]: { color: COLORS.severityYellow, label: 'Moderate' },
    [TriageSeverity.RED]: { color: COLORS.severityRed, label: 'Critical' },
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: 'center', marginBottom: theme.spacing.xl }}>
          <Text style={styles.checkmark}>✅</Text>
        </Animated.View>

        <Text style={styles.title}>Referral Created Successfully</Text>

        {referral && (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Patient</Text>
              <Text style={styles.value}>Patient #{referral.patientId?.slice(-4) || '---'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>From</Text>
              <Text style={styles.value}>{referral.fromFacilityId}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>To</Text>
              <Text style={styles.value}>{referral.toFacilityId}</Text>
            </View>
            {referral.distanceKm !== undefined && (
              <View style={styles.row}>
                <Text style={styles.label}>Distance</Text>
                <Text style={styles.value}>{referral.distanceKm} km</Text>
              </View>
            )}
            <View style={styles.row}>
              <Text style={styles.label}>Severity</Text>
              <View style={[styles.badge, { backgroundColor: severityConfig[severity]?.color }]}>
                <Text style={styles.badgeText}>{severityConfig[severity]?.label}</Text>
              </View>
            </View>
            {referral.routingReason && (
              <View style={styles.row}>
                <Text style={styles.label}>Routing</Text>
                <Text style={styles.value}>{referral.routingReason}</Text>
              </View>
            )}
            <View style={styles.row}>
              <Text style={styles.label}>QR Code</Text>
              <View style={styles.qrBox}>
                <Text style={styles.qrText}>{referral.qrCode}</Text>
              </View>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Status</Text>
              <View style={[styles.badge, { backgroundColor: COLORS.info }]}>
                <Text style={styles.badgeText}>CREATED</Text>
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.trackButton} onPress={() => navigation.navigate('Referral' as never)}>
          <Text style={styles.trackButtonText}>Track Referral</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.homeButton} onPress={() => navigation.navigate('MainTabs' as never)}>
          <Text style={styles.homeButtonText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: theme.layout.tabBarHeight + theme.spacing.lg, gap: theme.spacing.lg, alignItems: 'center' },
  checkmark: { fontSize: 80 },
  title: { fontSize: theme.typography.fontSize['2xl'], fontWeight: theme.typography.fontWeight.bold, color: COLORS.textPrimary, textAlign: 'center' },
  card: { width: '100%', backgroundColor: COLORS.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.lg, gap: theme.spacing.md, ...theme.shadows.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: theme.spacing.sm },
  label: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary, fontWeight: theme.typography.fontWeight.medium },
  value: { fontSize: theme.typography.fontSize.sm, color: COLORS.textPrimary, fontWeight: theme.typography.fontWeight.semibold, flex: 1, textAlign: 'right' },
  badge: { paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderRadius: theme.borderRadius.full },
  badgeText: { color: COLORS.textOnPrimary, fontSize: theme.typography.fontSize.xs, fontWeight: theme.typography.fontWeight.semibold },
  qrBox: { borderWidth: 1, borderColor: COLORS.border, borderRadius: theme.borderRadius.sm, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs },
  qrText: { fontSize: theme.typography.fontSize.xs, color: COLORS.textPrimary, fontFamily: 'monospace' },
  trackButton: { backgroundColor: COLORS.primary, borderRadius: theme.borderRadius.md, paddingVertical: theme.spacing.lg, alignItems: 'center', width: '100%' },
  trackButtonText: { color: COLORS.textOnPrimary, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold },
  homeButton: { backgroundColor: COLORS.cardBg, borderRadius: theme.borderRadius.md, paddingVertical: theme.spacing.lg, alignItems: 'center', width: '100%', borderWidth: 1, borderColor: COLORS.border },
  homeButtonText: { color: COLORS.textPrimary, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold },
});
