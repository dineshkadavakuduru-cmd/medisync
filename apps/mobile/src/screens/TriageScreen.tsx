import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { COLORS, TriageSeverity } from '@medisync/shared';
import { theme } from '../styles/theme';
import { SeverityBadge } from '../components/SeverityBadge';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from '../i18n';

interface TriageResult {
  id: string;
  severity: TriageSeverity;
  confidence: number;
  symptoms: string[];
  recommendation: string;
  needsReferral: boolean;
  suggestedFacilityType: string;
}

export const TriageScreen: React.FC = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const [recentAssessments] = React.useState<TriageResult[]>([]);

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🤖</Text>
      <Text style={styles.emptyTitle}>{t('triage.noAssessmentsYet')}</Text>
      <Text style={styles.emptySubtitle}>{t('triage.startFirstTriage')}</Text>
      <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('TriageFlow' as never)}>
        <Text style={styles.emptyButtonText}>{t('triage.startNew')} →</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('triage.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('triage.startNew')}</Text>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('TriageFlow' as never)}
        >
          <Text style={styles.primaryButtonIcon}>🤖</Text>
          <Text style={styles.primaryButtonText}>{t('triage.startNew')}</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('triage.recentAssessments')}</Text>
          <View style={styles.list}>
            {recentAssessments.length === 0 ? (
              <EmptyState />
            ) : (
              recentAssessments.map((triage) => (
                <TouchableOpacity key={triage.id} style={styles.triageCard} onPress={() => {}}>
                  <View style={styles.triageLeft}>
                    <SeverityBadge severity={triage.severity} />
                    <View style={styles.triageInfo}>
                      <Text style={styles.triageSymptoms}>
                        {triage.symptoms.slice(0, 3).join(', ')}
                      </Text>
                      <Text style={styles.triageTime}>{triage.recommendation}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingBottom: theme.layout.tabBarHeight + theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  header: {
    gap: theme.spacing.xs,
    paddingTop: theme.spacing.md,
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
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.md,
    ...theme.shadows.md,
  },
  primaryButtonIcon: {
    fontSize: theme.typography.fontSize.xl,
  },
  primaryButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  section: {
    gap: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
  list: {
    gap: theme.spacing.sm,
  },
  triageCard: {
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  triageLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  triageInfo: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  triageSymptoms: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.medium,
    color: COLORS.textPrimary,
  },
  triageTime: {
    fontSize: theme.typography.fontSize.sm,
    color: COLORS.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: theme.spacing.sm,
    opacity: 0.4,
  },
  emptyTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: theme.typography.fontSize.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.md,
  },
  emptyButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
});
