import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, NavigationProp, RouteProp } from '@react-navigation/native';
import { COLORS, TriageSeverity } from '@medisync/shared';
import { theme } from '../styles/theme';
import { api, ClinicalTriageResult, SymptomCategory, TriagePayload, VitalSigns } from '../services/api';
import { useTranslation } from '../i18n';
import { speak, stopSpeaking } from '../services/voiceService';
import { VoiceInputButton } from '../components/VoiceInputButton';
import { getAllSymptoms } from '../services/triageService';
import { getRecommendedDiagnostics } from '../services/triageService';
import { syncService } from '../services/syncService';

type Step = 'select' | 'symptoms' | 'vitals' | 'result';

type TriageRoutes = {
  TriageFlow: { patientId?: string; facilityId?: string } | undefined;
  Diagnostics: { patientId: string; facilityId: string; triageId: string; symptoms: string[]; recommendedTests: string[] };
  Referral: { patientId: string; facilityId: string };
};

export const TriageFlowScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<TriageRoutes>>();
  const route = useRoute<RouteProp<TriageRoutes, 'TriageFlow'>>();
  const { t, language } = useTranslation();
  const [step, setStep] = useState<Step>('select');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('');
  const [patientId, setPatientId] = useState(route.params?.patientId || '');
  const [facilityId, setFacilityId] = useState(route.params?.facilityId || '');
  const [vitals, setVitals] = useState({
    temperature: '',
    heartRate: '',
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    oxygenSaturation: '',
    respiratoryRate: '',
  });
  const [result, setResult] = useState<ClinicalTriageResult | null>(null);
  const [submittedContext, setSubmittedContext] = useState<TriagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [referralSaving, setReferralSaving] = useState(false);
  const [referralQueued, setReferralQueued] = useState(false);
  const [loading, setLoading] = useState(false);
  const [symptomCategories, setSymptomCategories] = useState<SymptomCategory[]>([]);
  const [otherSymptom, setOtherSymptom] = useState('');
  const [analysisStep, setAnalysisStep] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const contextVersion = useRef(0);
  const analyzeLock = useRef(false);
  const referralLock = useRef(false);

  useEffect(() => {
    let active = true;
    api.getSymptoms().then(res => {
      if (!res.success) throw new Error(res.error);
      if (active) setSymptomCategories(res.data.categories);
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Unable to load symptoms.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setPatientId(route.params?.patientId || '');
    setFacilityId(route.params?.facilityId || '');
    setPatientAge('');
    setPatientGender('');
    setResult(null);
    setSubmittedContext(null);
    setSelectedSymptoms([]);
    setReferralQueued(false);
    setOtherSymptom('');
    setVitals({ temperature: '', heartRate: '', bloodPressureSystolic: '', bloodPressureDiastolic: '', oxygenSaturation: '', respiratoryRate: '' });
    setLoading(false);
    setReferralSaving(false);
    setStep('select');
    return () => {
      contextVersion.current += 1;
      analyzeLock.current = false;
      referralLock.current = false;
      stopSpeaking();
    };
  }, [route.params?.patientId, route.params?.facilityId]);

  const toggleSymptom = (symptomId: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(symptomId) ? prev.filter(s => s !== symptomId) : [...prev, symptomId]
    );
  };

  const hasRedFlag = symptomCategories.some(cat =>
    cat.symptoms.some(s => s.redFlag && selectedSymptoms.includes(s.id))
  );

  const handleAnalyze = async () => {
    if (analyzeLock.current) return;
    setError(null);
    const age = Number(patientAge);
    const gender = patientGender.trim().toUpperCase();
    if (!patientId.trim() || !patientAge.trim() || !Number.isInteger(age) || age < 0 || age > 120 || (gender !== 'MALE' && gender !== 'FEMALE' && gender !== 'OTHER') || !selectedSymptoms.length) {
      setError('Enter a patient ID, valid age (0-120), gender (MALE/FEMALE/OTHER), and at least one symptom.');
      return;
    }
    const vitalSigns: VitalSigns = {};
    const bounds: Record<keyof VitalSigns, [number, number]> = {
      temperature: [25, 45], heartRate: [20, 300], bloodPressureSystolic: [40, 300],
      bloodPressureDiastolic: [20, 200], oxygenSaturation: [50, 100], respiratoryRate: [1, 100],
    };
    for (const key of Object.keys(bounds) as (keyof VitalSigns)[]) {
      if (!vitals[key]) continue;
      const value = Number(vitals[key]);
      const [min, max] = bounds[key];
      if (!Number.isFinite(value) || value < min || value > max) {
        setError(`Enter a valid ${key} between ${min} and ${max}, or leave it blank.`);
        return;
      }
      vitalSigns[key] = value;
    }
    const { bloodPressureSystolic: systolic, bloodPressureDiastolic: diastolic } = vitalSigns;
    if ((systolic === undefined) !== (diastolic === undefined) || (systolic !== undefined && diastolic !== undefined && systolic <= diastolic)) {
      setError('Provide both blood pressure values, with systolic greater than diastolic.');
      return;
    }
    const body: TriagePayload = {
      symptoms: [...selectedSymptoms], patientAge: age, patientGender: gender, patientId: patientId.trim(),
      vitalSigns: Object.keys(vitalSigns).length ? vitalSigns : undefined,
    };
    const version = contextVersion.current;
    analyzeLock.current = true;
    setLoading(true);
    setResult(null);
    setReferralQueued(false);
    setAnalysisStep(0);
    setStep('result');

    const steps = [
      { text: t('triage.analyzing'), delay: 500 },
      { text: t('triage.crossReferencing'), delay: 500 },
      { text: t('triage.calculatingSeverity'), delay: 500 },
      { text: t('triage.generatingSummary'), delay: 500 },
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, steps[i].delay));
      if (version !== contextVersion.current) return;
      setAnalysisStep(i + 1);
    }

    try {
      const response = await api.submitTriage(body);
      if (version !== contextVersion.current) return;
      if (!response.success || !response.data?.id) throw new Error(response.error || 'The server did not return a triage result.');
      setSubmittedContext(body);
      setResult(response.data);
    } catch (e) {
      if (version !== contextVersion.current) return;
      setError(e instanceof Error ? e.message : 'Triage failed. No result was confirmed.');
      setStep('vitals');
    } finally {
      if (version === contextVersion.current) { setLoading(false); analyzeLock.current = false; }
    }
  };

  const handleCreateReferral = async () => {
    if (referralLock.current || referralQueued) return;
    setError(null);
    if (!submittedContext || !facilityId.trim()) {
      setError('A completed triage and originating facility ID are required.');
      return;
    }
    const version = contextVersion.current;
    referralLock.current = true;
    setReferralSaving(true);
    try {
      await syncService.enqueue({
        type: 'CREATE_REFERRAL',
        payload: {
          ...submittedContext,
          fromFacilityId: facilityId.trim(),
          reason: submittedContext.symptoms.join(', '),
        },
        timestamp: Date.now(),
      });
      if (version !== contextVersion.current) return;
      // enqueue confirms local persistence only. Retries must reuse the stored action ID.
      setReferralQueued(true);
    } catch (e) {
      if (version !== contextVersion.current) return;
      referralLock.current = false;
      setError(e instanceof Error ? `Unable to save referral locally: ${e.message}` : 'Unable to save referral locally. Please retry.');
    } finally {
      if (version === contextVersion.current) setReferralSaving(false);
    }
  };

  const handleReviewDiagnostics = () => {
    setError(null);
    if (!result || !submittedContext || !facilityId.trim()) {
      setError('Patient, facility, and completed triage context are required for clinician review.');
      return;
    }
    try {
      navigation.navigate('Diagnostics', {
        patientId: submittedContext.patientId,
        facilityId: facilityId.trim(),
        triageId: result.id,
        symptoms: submittedContext.symptoms,
        recommendedTests: result.recommendedDiagnostics ?? getRecommendedDiagnostics(submittedContext.symptoms),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to open diagnostic review.');
    }
  };

  const handleSpeak = () => {
    if (!result) return;
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      return;
    }
    setIsSpeaking(true);
    speak(result.aiSummary || result.recommendation, language);
    setTimeout(() => setIsSpeaking(false), 5000);
  };

  const getSeverityConfig = (severity: TriageSeverity) => {
    switch (severity) {
      case TriageSeverity.GREEN:
        return { bg: '#E8F5E9', text: t('triage.mild'), subtitle: t('triage.opdRecommended'), color: COLORS.severityGreen, gradient: ['#E8F5E9', '#C8E6C9'] };
      case TriageSeverity.YELLOW:
        return { bg: '#FFF8E1', text: t('triage.moderate'), subtitle: t('triage.priorityNeeded'), color: COLORS.severityYellow, gradient: ['#FFF8E1', '#FFECB3'] };
      case TriageSeverity.RED:
        return { bg: '#FFEBEE', text: t('triage.critical'), subtitle: t('triage.immediateAction'), color: COLORS.severityRed, gradient: ['#FFEBEE', '#FFCDD2'] };
    }
  };

  const renderStepSelect = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('triage.selectPatient')}</Text>
      <TextInput
        style={styles.input}
        placeholder="Patient ID (required)"
        value={patientId}
        onChangeText={setPatientId}
        placeholderTextColor={COLORS.textSecondary}
      />
      <TextInput
        style={styles.input}
        placeholder="Patient age (0-120)"
        value={patientAge}
        onChangeText={setPatientAge}
        keyboardType="numeric"
        placeholderTextColor={COLORS.textSecondary}
      />
      <TextInput
        style={styles.input}
        placeholder="Patient Gender (MALE/FEMALE)"
        value={patientGender}
        onChangeText={setPatientGender}
        placeholderTextColor={COLORS.textSecondary}
      />
      <TextInput
        style={styles.input}
        placeholder="Originating facility ID (required for referral or diagnostics)"
        value={facilityId}
        onChangeText={setFacilityId}
        placeholderTextColor={COLORS.textSecondary}
      />
      <TouchableOpacity style={styles.nextButton} onPress={() => setStep('symptoms')}>
        <Text style={styles.nextButtonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStepSymptoms = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>{t('triage.selectSymptoms')}</Text>
      <Text style={styles.counterText}>{selectedSymptoms.length} {t('triage.symptomsSelected')}</Text>

      {hasRedFlag && (
        <View style={styles.redFlagWarning}>
          <Text style={styles.redFlagText}>⚠️ {t('triage.emergencyWarning')}</Text>
        </View>
      )}

      <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
        {symptomCategories.map((category) => (
          <View key={category.name} style={styles.category}>
            <Text style={styles.categoryTitle}>{category.icon} {category.name}</Text>
            <View style={styles.symptomGrid}>
              {category.symptoms.map((symptom) => {
                const isSelected = selectedSymptoms.includes(symptom.id);
                let chipColor = COLORS.surface;
                let textColor = COLORS.textPrimary;
                if (isSelected) {
                  if (symptom.redFlag) { chipColor = COLORS.severityRed; textColor = COLORS.textOnPrimary; }
                  else if (symptom.weight >= 5) { chipColor = COLORS.severityYellow; textColor = COLORS.textOnPrimary; }
                  else { chipColor = COLORS.severityGreen; textColor = COLORS.textOnPrimary; }
                }
                return (
                  <TouchableOpacity
                    key={symptom.id}
                    style={[styles.symptomChip, { backgroundColor: chipColor }]}
                    onPress={() => toggleSymptom(symptom.id)}
                  >
                    <Text style={[styles.symptomText, { color: textColor }]}>
                      {language === 'hi' ? symptom.labelHi : language === 'mr' ? symptom.labelMr : symptom.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.voiceRow}>
        <VoiceInputButton
          language={language}
          catalogue={getAllSymptoms()}
          onResult={result => {
            setSelectedSymptoms(prev => [...new Set([...prev, ...result.recognizedIds])]);
          }}
        />
      </View>

      <TextInput
        style={styles.input}
        placeholder={t('triage.describeOther')}
        value={otherSymptom}
        onChangeText={setOtherSymptom}
        placeholderTextColor={COLORS.textSecondary}
      />
      <View style={styles.rowButtons}>
        <TouchableOpacity style={styles.backButton} onPress={() => setStep('select')}>
          <Text style={styles.backButtonText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextButton} onPress={() => setStep('vitals')}>
          <Text style={styles.nextButtonText}>{t('triage.skip')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStepVitals = () => {
    const vitalFields = [
      { key: 'temperature', label: t('triage.temperature'), placeholder: '36-38', min: 34, max: 42 },
      { key: 'heartRate', label: t('triage.heartRate'), placeholder: '60-100', min: 40, max: 200 },
      { key: 'bloodPressureSystolic', label: `${t('triage.bloodPressure')} ${t('triage.systolic')}`, placeholder: '120', min: 60, max: 220 },
      { key: 'bloodPressureDiastolic', label: `${t('triage.bloodPressure')} ${t('triage.diastolic')}`, placeholder: '80', min: 40, max: 140 },
      { key: 'oxygenSaturation', label: t('triage.oxygenSaturation'), placeholder: '95-100', min: 70, max: 100 },
      { key: 'respiratoryRate', label: t('triage.respiratoryRate'), placeholder: '12-20', min: 8, max: 40 },
    ];

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>{t('triage.vitalSigns')}</Text>
        <Text style={styles.subtitle}>{t('triage.skip')}</Text>

        {vitalFields.map(field => (
          <View key={field.key} style={styles.vitalField}>
            <Text style={styles.vitalLabel}>{field.label}</Text>
            <View style={styles.vitalInputRow}>
              <TouchableOpacity onPress={() => {
                const val = parseFloat(vitals[field.key as keyof typeof vitals] as string) || 0;
                setVitals({ ...vitals, [field.key]: String(Math.max(field.min, val - 1)) });
              }}>
                <Text style={styles.stepper}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.vitalInput}
                placeholder={field.placeholder}
                value={vitals[field.key as keyof typeof vitals] as string}
                onChangeText={(text) => {
                  if (/^\d*\.?\d*$/.test(text)) setVitals({ ...vitals, [field.key]: text });
                }}
                keyboardType="numeric"
                placeholderTextColor={COLORS.textSecondary}
              />
              <TouchableOpacity onPress={() => {
                const val = parseFloat(vitals[field.key as keyof typeof vitals] as string) || 0;
                setVitals({ ...vitals, [field.key]: String(Math.min(field.max, val + 1)) });
              }}>
                <Text style={styles.stepper}>+</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.vitalHint}>Normal: {field.placeholder}</Text>
          </View>
        ))}

        <View style={styles.rowButtons}>
          <TouchableOpacity style={styles.backButton} onPress={() => setStep('symptoms')}>
            <Text style={styles.backButtonText}>{t('common.back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.analyzeButton} onPress={handleAnalyze} disabled={loading}>
            <Text style={styles.analyzeButtonText}>{loading ? t('triage.analyzing') : t('triage.analyze')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderAnalysisAnimation = () => {
    const icons = ['🧠', '🗄️', '📊', '📄'];
    const labels = [t('triage.analyzing'), t('triage.crossReferencing'), t('triage.calculatingSeverity'), t('triage.generatingSummary')];
    return (
      <View style={styles.analysisContainer}>
        {labels.map((label, i) => (
          <View key={i} style={styles.analysisStep}>
            <View style={[styles.analysisIcon, analysisStep > i && styles.analysisIconDone]}>
              <Text style={styles.analysisIconText}>{analysisStep > i ? '✅' : icons[i]}</Text>
            </View>
            <Text style={[styles.analysisLabel, analysisStep > i && styles.analysisLabelDone]}>{label}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderStepResult = () => {
    if (!result) return renderAnalysisAnimation();

    const severityConfig = getSeverityConfig(result.severity);
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>{t('triage.clinicalSummary')}</Text>

        <View style={[styles.resultCard, { backgroundColor: severityConfig.bg, borderColor: severityConfig.color }]}>
          <Text style={[styles.resultSeverityText, { color: severityConfig.color }]}>{severityConfig.text}</Text>
          <Text style={[styles.resultSubtitle, { color: severityConfig.color }]}>{severityConfig.subtitle}</Text>
          {result.severity === TriageSeverity.RED && <Text style={styles.alarmIcon}>🚨</Text>}
          <View style={styles.confidenceContainer}>
            <Text style={styles.confidenceLabel}>{t('triage.confidence')}</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, result.confidence * 100))}%`, backgroundColor: severityConfig.color }]} />
            </View>
            <Text style={styles.confidenceValue}>{Math.round(result.confidence * 100)}%</Text>
          </View>
          <View style={styles.systemsContainer}>
            <Text style={styles.systemsLabel}>{t('triage.affectedSystems')}:</Text>
            {result.affectedSystems.map((sys: string) => (
              <View key={sys} style={styles.systemChip}>
                <Text style={styles.systemChipText}>{sys}</Text>
              </View>
            ))}
          </View>
          {result.vitalSignFlags.length > 0 && (
            <View style={styles.flagsContainer}>
              {result.vitalSignFlags.map((flag: string, i: number) => (
                <Text key={i} style={styles.flagText}>⚠️ {flag}</Text>
              ))}
            </View>
          )}
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryIcon}>🤖</Text>
            <Text style={styles.summaryText}>{result.aiSummary}</Text>
            <TouchableOpacity onPress={handleSpeak} style={styles.speakButton}>
              <Text style={styles.speakButtonText}>{isSpeaking ? '🔊 Reading...' : '🔊 Read Aloud'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.subtitle}>Patient: {submittedContext?.patientId} | Facility: {facilityId || 'Not selected'}</Text>
        <TouchableOpacity style={styles.nextButton} onPress={handleReviewDiagnostics}>
          <Text style={styles.nextButtonText}>Clinician review of diagnostic tests</Text>
        </TouchableOpacity>
        <Text style={styles.vitalHint}>Recommendations require clinician review before an order is submitted.</Text>
        {referralQueued && submittedContext && (
          <View>
            <Text accessibilityRole="alert" style={styles.vitalHint}>Referral saved on this device, pending server confirmation. Check the referral queue for delivery status and retry the saved action there; do not create it again.</Text>
            <TouchableOpacity style={styles.newTriageButton} onPress={() => navigation.navigate('Referral', { patientId: submittedContext.patientId, facilityId: facilityId.trim() })}>
              <Text style={styles.newTriageButtonText}>View referral queue</Text>
            </TouchableOpacity>
          </View>
        )}
        {result.needsReferral && (
          <TouchableOpacity
            style={[styles.referralButton, result.severity === TriageSeverity.RED && styles.referralButtonRed]}
            onPress={handleCreateReferral}
            disabled={referralSaving || referralQueued}
          >
            <Text style={styles.referralButtonText}>
              {referralQueued ? 'Referral saved in queue' : referralSaving ? 'Saving referral locally...' : result.severity === TriageSeverity.RED ? `🚑 ${t('triage.createEmergencyReferral')}` : `📋 ${t('triage.createReferral')}`}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.newTriageButton} disabled={referralSaving} onPress={() => { referralLock.current = false; setStep('select'); setResult(null); setSubmittedContext(null); setReferralQueued(false); setError(null); setSelectedSymptoms([]); setOtherSymptom(''); setVitals({ temperature: '', heartRate: '', bloodPressureSystolic: '', bloodPressureDiastolic: '', oxygenSaturation: '', respiratoryRate: '' }); }}>
          <Text style={styles.newTriageButtonText}>🔄 {t('triage.newTriage')}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {error && <Text accessibilityRole="alert" style={styles.flagText}>{error}</Text>}
        {step === 'select' && renderStepSelect()}
        {step === 'symptoms' && renderStepSymptoms()}
        {step === 'vitals' && renderStepVitals()}
        {(step === 'result') && renderStepResult()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: theme.layout.tabBarHeight + theme.spacing.lg, gap: theme.spacing.lg },
  stepContainer: { gap: theme.spacing.lg },
  stepTitle: { fontSize: theme.typography.fontSize['2xl'], fontWeight: theme.typography.fontWeight.bold, color: COLORS.textPrimary },
  subtitle: { fontSize: theme.typography.fontSize.md, color: COLORS.textSecondary, marginTop: -theme.spacing.md },
  input: { backgroundColor: COLORS.surface, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, fontSize: theme.typography.fontSize.md, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  nextButton: { backgroundColor: COLORS.primary, borderRadius: theme.borderRadius.md, paddingVertical: theme.spacing.lg, alignItems: 'center' },
  nextButtonText: { color: COLORS.textOnPrimary, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold },
  backButton: { backgroundColor: COLORS.cardBg, borderRadius: theme.borderRadius.md, paddingVertical: theme.spacing.lg, alignItems: 'center', flex: 1 },
  backButtonText: { color: COLORS.textPrimary, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold },
  rowButtons: { flexDirection: 'row', gap: theme.spacing.md },
  counterText: { fontSize: theme.typography.fontSize.md, color: COLORS.textSecondary, fontWeight: theme.typography.fontWeight.medium },
  redFlagWarning: { backgroundColor: COLORS.emergencyLight, padding: theme.spacing.md, borderRadius: theme.borderRadius.md },
  redFlagText: { color: COLORS.emergency, fontWeight: theme.typography.fontWeight.semibold, fontSize: theme.typography.fontSize.sm },
  category: { gap: theme.spacing.sm },
  categoryTitle: { fontSize: theme.typography.fontSize.md, fontWeight: theme.typography.fontWeight.semibold, color: COLORS.textPrimary },
  symptomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  symptomChip: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderRadius: theme.borderRadius.full, borderWidth: 1, borderColor: COLORS.border },
  symptomText: { fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium },
  voiceRow: { alignItems: 'center', marginVertical: theme.spacing.sm },
  vitalField: { gap: theme.spacing.xs },
  vitalLabel: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary, fontWeight: theme.typography.fontWeight.medium },
  vitalInputRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, backgroundColor: COLORS.surface, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: theme.spacing.md },
  vitalInput: { flex: 1, paddingVertical: theme.spacing.md, fontSize: theme.typography.fontSize.md, color: COLORS.textPrimary },
  stepper: { fontSize: theme.typography.fontSize['2xl'], color: COLORS.textSecondary, paddingHorizontal: theme.spacing.sm },
  vitalHint: { fontSize: theme.typography.fontSize.xs, color: COLORS.textSecondary },
  analyzeButton: { backgroundColor: COLORS.primary, borderRadius: theme.borderRadius.md, paddingVertical: theme.spacing.lg, alignItems: 'center', flex: 1 },
  analyzeButtonText: { color: COLORS.textOnPrimary, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold },
  analysisContainer: { gap: theme.spacing.lg, paddingVertical: theme.spacing.xl },
  analysisStep: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  analysisIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  analysisIconDone: { backgroundColor: COLORS.primaryLight },
  analysisIconText: { fontSize: theme.typography.fontSize.lg },
  analysisLabel: { fontSize: theme.typography.fontSize.md, color: COLORS.textSecondary },
  analysisLabelDone: { color: COLORS.primary, fontWeight: theme.typography.fontWeight.semibold },
  resultCard: { borderRadius: theme.borderRadius.md, padding: theme.spacing.lg, borderWidth: 2, gap: theme.spacing.md },
  resultSeverityText: { fontSize: theme.typography.fontSize['3xl'], fontWeight: theme.typography.fontWeight.bold, textAlign: 'center' },
  resultSubtitle: { fontSize: theme.typography.fontSize.md, fontWeight: theme.typography.fontWeight.semibold, textAlign: 'center' },
  alarmIcon: { fontSize: theme.typography.fontSize['3xl'], textAlign: 'center' },
  confidenceContainer: { gap: theme.spacing.xs },
  confidenceLabel: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary },
  progressBar: { height: 8, backgroundColor: COLORS.border, borderRadius: theme.borderRadius.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: theme.borderRadius.full },
  confidenceValue: { fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.semibold, color: COLORS.textPrimary },
  systemsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, alignItems: 'center' },
  systemsLabel: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary, fontWeight: theme.typography.fontWeight.medium },
  systemChip: { backgroundColor: COLORS.surface, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderRadius: theme.borderRadius.full, borderWidth: 1, borderColor: COLORS.border },
  systemChipText: { fontSize: theme.typography.fontSize.xs, color: COLORS.textPrimary, fontWeight: theme.typography.fontWeight.medium },
  flagsContainer: { gap: theme.spacing.xs },
  flagText: { fontSize: theme.typography.fontSize.sm, color: COLORS.warning, fontWeight: theme.typography.fontWeight.medium },
  summaryContainer: { flexDirection: 'row', gap: theme.spacing.sm, backgroundColor: COLORS.surface, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, alignItems: 'center' },
  summaryIcon: { fontSize: theme.typography.fontSize.lg },
  summaryText: { flex: 1, fontSize: theme.typography.fontSize.sm, color: COLORS.textPrimary, lineHeight: 20 },
  speakButton: { backgroundColor: COLORS.primaryLight, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderRadius: theme.borderRadius.full },
  speakButtonText: { color: COLORS.primary, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.semibold },
  referralButton: { backgroundColor: COLORS.primary, borderRadius: theme.borderRadius.md, paddingVertical: theme.spacing.lg, alignItems: 'center' },
  referralButtonRed: { backgroundColor: COLORS.severityRed },
  referralButtonText: { color: COLORS.textOnPrimary, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold },
  newTriageButton: { backgroundColor: COLORS.cardBg, borderRadius: theme.borderRadius.md, paddingVertical: theme.spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  newTriageButtonText: { color: COLORS.textPrimary, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold },
});
