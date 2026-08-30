import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { COLORS, Patient as PatientType, HealthRecord, FacilityType } from '@arogyasetu/shared';
import { theme } from '../styles/theme';
import { SeverityBadge } from '../components/SeverityBadge';
import { api } from '../services/api';
import { useTranslation } from '../i18n';

const facilityTypeColors: Record<string, string> = {
  [FacilityType.SUB_CENTRE]: COLORS.success,
  [FacilityType.PHC]: COLORS.info,
  [FacilityType.CHC]: COLORS.warning,
  [FacilityType.DISTRICT_HOSPITAL]: COLORS.emergency,
};

export const PatientDetailScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { t } = useTranslation();
  const [patient, setPatient] = useState<PatientType | null>(null);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const p = await api.getPatient('patient-1');
      setPatient(p.data);
      const r = await api.getPatientRecords('patient-1');
      setRecords(r.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loading}>{t('common.loading')}</Text>
      </SafeAreaView>
    );
  }

  if (!patient) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loading}>{t('common.noData')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.patientHeader}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarTextLarge}>{patient.name.charAt(0)}</Text>
          </View>
          <View style={styles.patientHeaderInfo}>
            <Text style={styles.patientNameLarge}>{patient.name}</Text>
            <Text style={styles.patientMetaLarge}>
              {patient.age} yrs • {patient.gender} • {patient.village}, {patient.district}
            </Text>
            <Text style={styles.abhaIdLarge}>ABHA: {patient.abhaId}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('facility.callFacility')}</Text>
            <Text style={styles.infoValue}>{patient.phone}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('settings.language')}</Text>
            <Text style={styles.infoValue}>{patient.languagePreference}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('facility.districtSummary')}</Text>
            <Text style={styles.infoValue}>{patient.district}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('patients.healthTimeline')}</Text>
          <View style={styles.timeline}>
            {records.map((record) => (
              <View key={record.id} style={styles.timelineItem}>
                <View style={[
                  styles.timelineDot,
                  { backgroundColor: facilityTypeColors[record.facilityId] || COLORS.primary },
                ]} />
                <View style={styles.timelineContent}>
                  <View style={styles.timelineHeader}>
                    <Text style={styles.timelineDate}>
                      {new Date(record.visitDate).toLocaleDateString()}
                    </Text>
                    <Text style={styles.timelineDoctor}>{record.doctorName}</Text>
                  </View>
                  <Text style={styles.timelineDiagnosis}>{record.diagnosis}</Text>
                  <Text style={styles.timelinePrescription}>{record.prescription}</Text>
                </View>
              </View>
            ))}
            {records.length === 0 && (
              <Text style={styles.noRecords}>{t('common.noData')}</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('common.home')}</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionButtonIcon}>📝</Text>
              <Text style={styles.actionButtonLabel}>{t('patients.newVisit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Feedback', { facilityId: 'facility-1' })}>
              <Text style={styles.actionButtonIcon}>📝</Text>
              <Text style={styles.actionButtonLabel}>{t('feedback.title')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionButtonIcon}>📄</Text>
              <Text style={styles.actionButtonLabel}>PDF</Text>
            </TouchableOpacity>
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
  loading: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingTop: theme.spacing.md,
    backgroundColor: COLORS.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.sm,
    ...theme.shadows.sm,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: theme.borderRadius.full,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextLarge: {
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: COLORS.primary,
  },
  patientHeaderInfo: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  patientNameLarge: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  patientMetaLarge: {
    fontSize: theme.typography.fontSize.md,
    color: COLORS.textSecondary,
  },
  abhaIdLarge: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: COLORS.primary,
    fontFamily: 'monospace',
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: COLORS.textPrimary,
  },
  section: {
    gap: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
  timeline: {
    gap: theme.spacing.md,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: theme.borderRadius.full,
    marginTop: 4,
    flexShrink: 0,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: COLORS.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    ...theme.shadows.sm,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  timelineDate: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
  timelineDoctor: {
    fontSize: theme.typography.fontSize.sm,
    color: COLORS.textSecondary,
  },
  timelineDiagnosis: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.medium,
    color: COLORS.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  timelinePrescription: {
    fontSize: theme.typography.fontSize.sm,
    color: COLORS.textSecondary,
  },
  noRecords: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: theme.spacing.lg,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  actionButtonIcon: {
    fontSize: theme.typography.fontSize.xl,
  },
  actionButtonLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: COLORS.textPrimary,
  },
});