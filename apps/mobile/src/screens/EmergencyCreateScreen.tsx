import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Animated,
} from 'react-native';
import { COLORS } from '@arogyasetu/shared';
import { theme } from '../styles/theme';
import { api } from '../services/api';
import { useTranslation } from '../i18n';

interface ConditionOption {
  key: string;
  label: string;
  level: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
  icon: string;
}

const CONDITIONS: ConditionOption[] = [
  { key: 'cardiac_arrest', label: 'Cardiac Arrest', level: 'LEVEL_1', icon: '🫀' },
  { key: 'stroke', label: 'Stroke', level: 'LEVEL_1', icon: '🧠' },
  { key: 'severe_bleeding', label: 'Severe Bleeding', level: 'LEVEL_1', icon: '🩸' },
  { key: 'unconscious', label: 'Unconscious', level: 'LEVEL_1', icon: '😵' },
  { key: 'snakebite', label: 'Snakebite', level: 'LEVEL_1', icon: '🐍' },
  { key: 'poisoning', label: 'Poisoning', level: 'LEVEL_1', icon: '☠️' },
  { key: 'severe_burns', label: 'Severe Burns', level: 'LEVEL_1', icon: '🔥' },
  { key: 'pregnancy_emergency', label: 'Pregnancy Emergency', level: 'LEVEL_1', icon: '🤰' },
  { key: 'difficulty_breathing', label: 'Difficulty Breathing', level: 'LEVEL_1', icon: '🫁' },
  { key: 'anaphylaxis', label: 'Anaphylaxis', level: 'LEVEL_1', icon: '⚠️' },
  { key: 'high_fever_child', label: 'High Fever (Child)', level: 'LEVEL_2', icon: '🤒' },
  { key: 'severe_dehydration', label: 'Severe Dehydration', level: 'LEVEL_2', icon: '💧' },
  { key: 'fracture', label: 'Fracture', level: 'LEVEL_2', icon: '🦴' },
  { key: 'seizure', label: 'Seizure', level: 'LEVEL_2', icon: '😣' },
  { key: 'severe_abdominal_pain', label: 'Severe Abdominal Pain', level: 'LEVEL_2', icon: '🤢' },
  { key: 'diabetic_emergency', label: 'Diabetic Emergency', level: 'LEVEL_2', icon: '🩺' },
  { key: 'high_bp_crisis', label: 'High BP Crisis', level: 'LEVEL_2', icon: '💓' },
  { key: 'animal_bite', label: 'Animal Bite', level: 'LEVEL_3', icon: '🐕' },
  { key: 'moderate_injury', label: 'Moderate Injury', level: 'LEVEL_3', icon: '🤕' },
  { key: 'allergic_reaction', label: 'Allergic Reaction', level: 'LEVEL_3', icon: '🤧' },
  { key: 'persistent_vomiting', label: 'Persistent Vomiting', level: 'LEVEL_3', icon: '🤮' },
];

const LEVEL_COLORS: Record<string, string> = {
  LEVEL_1: COLORS.emergency,
  LEVEL_2: COLORS.warning,
  LEVEL_3: COLORS.info,
};

interface EmergencyCreateScreenProps {
  navigation: any;
  route: any;
}

export const EmergencyCreateScreen: React.FC<EmergencyCreateScreenProps> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<'condition' | 'details' | 'activated'>('condition');
  const [selectedCondition, setSelectedCondition] = useState<ConditionOption | null>(null);
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('M');
  const [description, setDescription] = useState('');
  const [originFacilityId, setOriginFacilityId] = useState('facility-2');
  const [initiatedBy, setInitiatedBy] = useState('user-current');
  const [createdEmergency, setCreatedEmergency] = useState<any>(null);
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const flashAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (route.params?.facilityId) {
      setOriginFacilityId(route.params.facilityId);
    }
  }, [route.params?.facilityId]);

  const handleConditionSelect = (condition: ConditionOption) => {
    setSelectedCondition(condition);
    if (condition.level === 'LEVEL_1') {
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
    setStep('details');
  };

  const handleActivate = async () => {
    if (!selectedCondition || !patientName.trim() || !patientAge.trim()) {
      Alert.alert('Missing Information', t('common.error'));
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.createEmergency({
        patientName: patientName.trim(),
        patientAge: parseInt(patientAge, 10),
        patientGender: patientGender,
        condition: selectedCondition.key,
        description: description.trim() || selectedCondition.label,
        originFacilityId,
        initiatedBy,
      });

      if (result.success) {
        setCreatedEmergency(result.data);
        setStep('activated');
        Animated.timing(successAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      } else {
        Alert.alert('Error', result.error || t('common.error'));
      }
    } catch (e) {
      Alert.alert('Error', t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStep = (index: number) => {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  if (step === 'activated' && createdEmergency) {
    const completedCount = checkedSteps.size;
    const totalSteps = createdEmergency.firstAidSteps.length;

    return (
      <SafeAreaView style={styles.activatedContainer}>
        <Animated.View style={[styles.successCircle, { opacity: successAnim, transform: [{ scale: successAnim }] }]}>
          <Text style={styles.successIcon}>✓</Text>
        </Animated.View>
        <Text style={styles.activatedTitle}>{t('emergency.emergencyActivated')}</Text>
        <Text style={styles.activatedId}>ID: {createdEmergency.id}</Text>
        <View style={[styles.protocolBadge, { backgroundColor: LEVEL_COLORS[createdEmergency.protocolLevel] }]}>
          <Text style={styles.protocolText}>
            {createdEmergency.protocolLevel}
          </Text>
        </View>

        <View style={styles.firstAidSection}>
          <Text style={styles.firstAidTitle}>📋 {t('emergency.firstAidSteps')} ({completedCount}/{totalSteps})</Text>
          <ScrollView style={styles.firstAidList}>
            {createdEmergency.firstAidSteps.map((step: string, index: number) => (
              <TouchableOpacity key={index} style={styles.firstAidItem} onPress={() => toggleStep(index)}>
                <View style={[styles.checkbox, checkedSteps.has(index) && styles.checkboxChecked]}>
                  {checkedSteps.has(index) && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.firstAidText, checkedSteps.has(index) && styles.firstAidTextChecked]}>{step}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <TouchableOpacity style={styles.trackButton} onPress={() => navigation.navigate('EmergencyDetail', { emergencyId: createdEmergency.id })}>
          <Text style={styles.trackButtonText}>{t('emergency.trackEmergency')} →</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (step === 'details' && selectedCondition) {
    const levelColor = LEVEL_COLORS[selectedCondition.level];
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.backButton} onPress={() => setStep('condition')}>
            <Text style={styles.backButtonText}>← {t('common.back')}</Text>
          </TouchableOpacity>

          <View style={[styles.selectedConditionCard, { borderColor: levelColor }]}>
            <Text style={styles.selectedConditionIcon}>{selectedCondition.icon}</Text>
            <View>
              <Text style={styles.selectedConditionLabel}>{selectedCondition.label}</Text>
              <View style={[styles.levelBadge, { backgroundColor: levelColor }]}>
                <Text style={styles.levelBadgeText}>{selectedCondition.level}</Text>
              </View>
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>{t('emergency.selectCondition')}</Text>
            <TextInput
              style={styles.input}
              placeholder="Patient Name *"
              value={patientName}
              onChangeText={setPatientName}
              placeholderTextColor={COLORS.textSecondary}
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Age *"
                value={patientAge}
                onChangeText={setPatientAge}
                keyboardType="numeric"
                placeholderTextColor={COLORS.textSecondary}
              />
              <View style={[styles.input, styles.halfInput, styles.genderSelector]}>
                <TouchableOpacity style={[styles.genderOption, patientGender === 'M' && { backgroundColor: COLORS.primary }]} onPress={() => setPatientGender('M')}>
                  <Text style={[styles.genderText, patientGender === 'M' && styles.genderTextActive]}>M</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.genderOption, patientGender === 'F' && { backgroundColor: COLORS.primary }]} onPress={() => setPatientGender('F')}>
                  <Text style={[styles.genderText, patientGender === 'F' && styles.genderTextActive]}>F</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.genderOption, patientGender === 'O' && { backgroundColor: COLORS.primary }]} onPress={() => setPatientGender('O')}>
                  <Text style={[styles.genderText, patientGender === 'O' && styles.genderTextActive]}>O</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Brief description of the situation..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <TouchableOpacity
            style={[styles.activateButton, submitting && styles.activateButtonDisabled]}
            onPress={handleActivate}
            disabled={submitting}
          >
            <Text style={styles.activateButtonText}>{submitting ? 'ACTIVATING...' : `🚨 ${t('emergency.activateEmergency')}`}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.flashOverlay, { opacity: flashAnim }]} pointerEvents="none" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>⚠️ {t('emergency.selectCondition')}</Text>
        <Text style={styles.subtitle}>{t('emergency.selectCondition')}</Text>

        <View style={styles.conditionsGrid}>
          {CONDITIONS.map((condition) => (
            <TouchableOpacity
              key={condition.key}
              style={[styles.conditionCard, { borderColor: LEVEL_COLORS[condition.level] }]}
              onPress={() => handleConditionSelect(condition)}
              activeOpacity={0.8}
            >
              <Text style={styles.conditionIcon}>{condition.icon}</Text>
              <Text style={styles.conditionLabel}>{condition.label}</Text>
              <View style={[styles.conditionLevelBadge, { backgroundColor: LEVEL_COLORS[condition.level] }]}>
                <Text style={styles.conditionLevelText}>{condition.level.replace('LEVEL_', 'L')}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5F5',
  },
  scrollContent: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingBottom: theme.layout.tabBarHeight + theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.emergency,
    zIndex: 100,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: theme.spacing.sm,
  },
  backButtonText: {
    color: COLORS.emergency,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  title: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: COLORS.emergency,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.md,
    color: COLORS.textSecondary,
  },
  conditionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  conditionCard: {
    width: '47%',
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderWidth: 2,
    ...theme.shadows.sm,
  },
  conditionIcon: {
    fontSize: theme.typography.fontSize['3xl'],
  },
  conditionLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  conditionLevelBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  conditionLevelText: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
  },
  selectedConditionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    borderWidth: 2,
  },
  selectedConditionIcon: {
    fontSize: theme.typography.fontSize['3xl'],
  },
  selectedConditionLabel: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  levelBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    marginTop: theme.spacing.xs,
  },
  levelBadgeText: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
  },
  formSection: {
    gap: theme.spacing.md,
  },
  formLabel: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    color: COLORS.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    fontSize: theme.typography.fontSize.md,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  genderSelector: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    padding: theme.spacing.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  genderOption: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  genderText: {
    color: COLORS.textSecondary,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  genderTextActive: {
    color: COLORS.textOnPrimary,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  activateButton: {
    backgroundColor: COLORS.emergency,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    ...theme.shadows.md,
  },
  activateButtonDisabled: {
    opacity: 0.7,
  },
  activateButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  activateNote: {
    fontSize: theme.typography.fontSize.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  activatedContainer: {
    flex: 1,
    backgroundColor: COLORS.emergency,
    alignItems: 'center',
    paddingTop: theme.spacing['3xl'],
    paddingHorizontal: theme.layout.screenPadding,
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.textOnPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  successIcon: {
    fontSize: 48,
    color: COLORS.emergency,
    fontWeight: '700',
  },
  activatedTitle: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: COLORS.textOnPrimary,
    marginBottom: theme.spacing.sm,
  },
  activatedId: {
    fontSize: theme.typography.fontSize.sm,
    color: COLORS.textOnPrimary,
    opacity: 0.9,
    marginBottom: theme.spacing.md,
  },
  protocolBadge: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    marginBottom: theme.spacing.lg,
  },
  protocolText: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  firstAidSection: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    maxHeight: 300,
  },
  firstAidTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: COLORS.textPrimary,
    marginBottom: theme.spacing.md,
  },
  firstAidList: {
    gap: theme.spacing.sm,
  },
  firstAidItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  checkmark: {
    color: COLORS.textOnPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  firstAidText: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  firstAidTextChecked: {
    color: COLORS.textSecondary,
    textDecorationLine: 'line-through',
  },
  trackButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.lg,
    ...theme.shadows.md,
  },
  trackButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
});