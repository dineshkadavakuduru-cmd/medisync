import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Animated,
  Modal,
  TextInput,
} from 'react-native';
import { COLORS } from '@medisync/shared';
import { theme } from '../styles/theme';
import { useTranslation } from '../i18n';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { syncService } from '../services/syncService';
import { getActivePersona } from '../services/personas';
import { VoiceInputButton } from '../components/VoiceInputButton';
import { SymptomLabel } from '../services/voiceService';

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  village: string;
  phone: string;
  trimester?: number;
  lastVisit?: string;
  highRisk?: boolean;
  abhaId?: string;
}

interface VisitChecklist {
  bp?: string;
  weight?: string;
  hb?: string;
  urineAlbumin?: string;
  hivSyphilis?: string;
  tt1?: boolean;
  fundalHeight?: string;
  tt2?: boolean;
  ifa?: boolean;
  presentation?: string;
  ttBooster?: boolean;
  [key: string]: string | boolean | undefined;
}

const TRIMESTER_CHECKLISTS: Record<number, string[]> = {
  1: ['BP', 'Weight', 'Hb', 'Urine Albumin', 'HIV/Syphilis', 'TT1'],
  2: ['BP', 'Weight', 'Fundal Height', 'Hb', 'TT2', 'IFA'],
  3: ['BP', 'Weight', 'Fundal Height', 'Presentation', 'TT Booster'],
};

const MOCK_PATIENTS: Patient[] = [
  { id: 'patient-3', name: 'Anita Joshi', age: 24, gender: 'FEMALE', village: 'Khed', phone: '9876543210', trimester: 1, lastVisit: '2024-10-15', abhaId: 'ABHA-001' },
  { id: 'patient-4', name: 'Priya Kulkarni', age: 28, gender: 'FEMALE', village: 'Velhe', phone: '9876543211', trimester: 2, lastVisit: '2024-09-20', abhaId: 'ABHA-002' },
  { id: 'patient-5', name: 'Sunita Pawar', age: 22, gender: 'FEMALE', village: 'Mulshi', phone: '9876543212', trimester: 3, lastVisit: '2024-10-01', abhaId: 'ABHA-003' },
  { id: 'patient-6', name: 'Kavita Dhende', age: 30, gender: 'FEMALE', village: 'Junnar', phone: '9876543213', trimester: 1, lastVisit: '2024-08-15', abhaId: 'ABHA-004' },
  { id: 'patient-7', name: 'Smita Tilak', age: 26, gender: 'FEMALE', village: 'Bhor', phone: '9876543214', trimester: 2, lastVisit: '2024-09-10', abhaId: 'ABHA-005' },
];

export const AshaHomeVisitScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { t } = useTranslation();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [checklist, setChecklist] = useState<VisitChecklist>({});
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [highRiskFlags, setHighRiskFlags] = useState<string[]>([]);
  const [voiceResult, setVoiceResult] = useState<string>('');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const { data: patientsData, refetch: refetchPatients } = useApi(() => api.getPatients?.() || Promise.resolve({ success: true, data: MOCK_PATIENTS }));

  useEffect(() => {
    if (patientsData?.success && patientsData.data) {
      const ashaPatients = patientsData.data
        .filter((p: any) => p.trimester)
        .map((p: any) => ({
          ...p,
          highRisk: (p.hb && p.hb < 11) || (p.bpSystolic && p.bpSystolic > 140) || (p.bpDiastolic && p.bpDiastolic > 90),
        }));
      setPatients(ashaPatients);
    }
  }, [patientsData]);

  const loadData = async () => {
    await refetchPatients();
    setRefreshing(false);
  };

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setChecklist({});
    setHighRiskFlags([]);
    setVoiceResult('');
    setShowVisitModal(true);
  };

  const updateChecklist = (field: keyof VisitChecklist, value: string | boolean) => {
    setChecklist(prev => ({ ...prev, [field]: value }));
  };

  const checkHighRisk = () => {
    const flags: string[] = [];
    if (checklist.hb && parseFloat(checklist.hb) < 11) {
      flags.push(t('asha.anemiaFlag'));
    }
    if (checklist.bp) {
      const [sys, dia] = checklist.bp.split('/').map(Number);
      if ((sys && sys > 140) || (dia && dia > 90)) {
        flags.push(t('asha.hypertensionFlag'));
      }
    }
    if (selectedPatient && selectedPatient.trimester === 3 && checklist.presentation && checklist.presentation.toLowerCase().includes('breech')) {
      flags.push(t('asha.pretermFlag'));
    }
    setHighRiskFlags(flags);
    return flags.length > 0;
  };

  const handleSaveVisit = async () => {
    if (!selectedPatient) return;

    const isHighRisk = checkHighRisk();
    const visitData = {
      patientId: selectedPatient.id,
      ashaId: getActivePersona().staffId,
      trimester: selectedPatient.trimester,
      checklist,
      highRisk: isHighRisk,
      highRiskFlags,
      voiceNotes: voiceResult,
      timestamp: new Date().toISOString(),
    };

    if (syncService.isOnline()) {
      try {
        // In real app, call API
        console.log('Saving visit online:', visitData);
      } catch (e) {
        console.error('Failed to save online:', e);
      }
    } else {
      await syncService.enqueue({
        type: 'CREATE_ASHA_VISIT',
        payload: visitData,
        timestamp: Date.now(),
      });
    }

    if (isHighRisk) {
      // Auto-create referral
      await syncService.enqueue({
        type: 'CREATE_REFERRAL',
        payload: {
          patientId: selectedPatient.id,
          fromFacilityId: 'f1',
          toFacilityId: 'f2',
          severity: 'YELLOW',
          reason: `ASHA High-risk flags: ${highRiskFlags.join(', ')}`,
        },
        timestamp: Date.now(),
      });
    }

    // Update patient last visit
    setPatients(prev => prev.map(p =>
      p.id === selectedPatient.id ? { ...p, lastVisit: new Date().toISOString().split('T')[0] } : p
    ));

    setShowVisitModal(false);
    setSelectedPatient(null);
  };

  const handleVoiceResult = (result: { transcript: string; recognizedIds: string[]; source: any }) => {
    setVoiceResult(result.transcript);
  };

  const renderPatientCard = (patient: Patient) => (
    <TouchableOpacity key={patient.id} style={styles.patientCard} onPress={() => handleSelectPatient(patient)}>
      <View style={styles.patientInfo}>
        <Text style={styles.patientName}>{patient.name}</Text>
        <Text style={styles.patientMeta}>
          {t('asha.trimester')}: {patient.trimester} | {t('asha.lastVisit')}: {patient.lastVisit || 'Never'}
        </Text>
        <Text style={styles.patientMeta}>
          {t('asha.village')}: {patient.village} | {t('asha.phone')}: {patient.phone}
        </Text>
        {patient.highRisk && (
          <View style={styles.highRiskBadge}>
            <Text style={styles.highRiskText}>⚠️ {t('asha.highRisk')}</Text>
          </View>
        )}
      </View>
      <View style={styles.patientAction}>
        <Text style={styles.actionText}>{t('asha.startVisit')}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('asha.title')}</Text>
            <View style={styles.headerRight}>
              {syncService.getPendingCount() > 0 && (
                <View style={styles.syncBadge}>
                  <Text style={styles.syncBadgeText}>{syncService.getPendingCount()}</Text>
                </View>
              )}
            </View>
          </View>

          <Text style={styles.sectionTitle}>{t('asha.ancDueList')}</Text>
          <View style={styles.statsRow}>
            {([1, 2, 3] as number[]).map(trim => (
              <View key={trim} style={styles.statBox}>
                <Text style={styles.statNumber}>
                  {patients.filter(p => p.trimester === trim).length}
                </Text>
                <Text style={styles.statLabel}>{t('asha.trimester')} {trim}</Text>
              </View>
            ))}
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>{t('asha.filterByTrimester')}</Text>
            <View style={styles.trimesterChips}>
              {(['all', 1, 2, 3] as (string | number)[]).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.trimesterChip, t === 'all' && styles.trimesterChipActive]}
                  onPress={() => {}}
                >
                  <Text style={[styles.trimesterChipText, t === 'all' && styles.trimesterChipTextActive]}>
                    {t === 'all' ? t('asha.all') : `${t}st`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {patients.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t('asha.noDuePatients')}</Text>
            </View>
          ) : (
            <View style={styles.patientsList}>
              {patients.map(renderPatientCard)}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Visit Modal */}
      <Modal visible={showVisitModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('asha.visitChecklist')}: {selectedPatient?.name}</Text>
              <TouchableOpacity style={styles.modalClose} onPress={() => setShowVisitModal(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.trimesterLabel}>{t('asha.trimester')} {selectedPatient?.trimester}</Text>

            <ScrollView contentContainerStyle={styles.checklistContent}>
              {TRIMESTER_CHECKLISTS[selectedPatient?.trimester || 1]?.map(item => (
                <View key={item} style={styles.checklistItem}>
                  <Text style={styles.checklistLabel}>{item}</Text>
                  {['TT1', 'TT2', 'TT Booster', 'IFA'].includes(item) ? (
                    <TouchableOpacity
                      style={[styles.checkbox, checklist[item.toLowerCase().replace(' ', '')] && styles.checkboxChecked]}
                      onPress={() => updateChecklist(item.toLowerCase().replace(' ', ''), !checklist[item.toLowerCase().replace(' ', '')])}
                    >
                      <Text style={styles.checkboxText}>☑</Text>
                    </TouchableOpacity>
                  ) : (
                    <TextInput
                      style={styles.checklistInput}
                      placeholder={t('asha.enterValue')}
                      value={checklist[item.toLowerCase().replace(' ', '')] || ''}
                      onChangeText={v => updateChecklist(item.toLowerCase().replace(' ', ''), v)}
                      keyboardType={['BP', 'Weight', 'Hb', 'Fundal Height'].includes(item) ? 'numeric' : 'default'}
                    />
                  )}
                </View>
              ))}

              <View style={styles.voiceSection}>
                <Text style={styles.sectionTitle}>{t('asha.voiceNotes')}</Text>
                <VoiceInputButton
                  language={getActivePersona().role === 'ASHA' ? 'hi' : 'en'}
                  catalogue={[{ id: 'bp', label: 'BP', labelHi: 'रक्तचाप', labelMr: 'रक्तदाब' }]}
                  onResult={handleVoiceResult}
                />
                {voiceResult && (
                  <Text style={styles.voiceTranscript}>"{voiceResult}"</Text>
                )}
              </View>

              {highRiskFlags.length > 0 && (
                <View style={styles.highRiskSection}>
                  <Text style={styles.highRiskTitle}>⚠️ {t('asha.highRiskDetected')}</Text>
                  {highRiskFlags.map((flag, i) => (
                    <Text key={i} style={styles.highRiskFlag}>• {flag}</Text>
                  ))}
                </View>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.submitButton} onPress={handleSaveVisit}>
              <Text style={styles.submitButtonText}>{t('asha.saveVisit')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: theme.layout.screenPadding, paddingTop: theme.spacing.md, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  headerTitle: { fontSize: theme.typography.fontSize['2xl'], fontWeight: theme.typography.fontWeight.bold, color: COLORS.textPrimary },
  headerRight: { flexDirection: 'row', gap: theme.spacing.sm },
  syncBadge: { backgroundColor: COLORS.warning, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  syncBadgeText: { color: COLORS.textOnPrimary, fontSize: 12, fontWeight: '700' },
  sectionTitle: { fontSize: theme.typography.fontSize.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: theme.spacing.sm },
  statsRow: { flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.md },
  statBox: { flex: 1, backgroundColor: COLORS.surface, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, alignItems: 'center' },
  statNumber: { fontSize: theme.typography.fontSize['2xl'], fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary },
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md },
  filterLabel: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary },
  trimesterChips: { flexDirection: 'row', gap: theme.spacing.sm },
  trimesterChip: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, backgroundColor: COLORS.background, borderRadius: theme.borderRadius.full, borderWidth: 1, borderColor: COLORS.border },
  trimesterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  trimesterChipText: { fontSize: theme.typography.fontSize.sm, fontWeight: '600', color: COLORS.textPrimary },
  trimesterChipTextActive: { color: COLORS.textOnPrimary },
  emptyState: { alignItems: 'center', paddingVertical: theme.spacing.xl * 2 },
  emptyText: { color: COLORS.textSecondary },
  patientsList: { gap: theme.spacing.md },
  patientCard: { backgroundColor: COLORS.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  patientInfo: { flex: 1 },
  patientName: { fontSize: theme.typography.fontSize.md, fontWeight: '700', color: COLORS.textPrimary },
  patientMeta: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary, marginTop: 2 },
  highRiskBadge: { marginTop: theme.spacing.sm, backgroundColor: COLORS.emergency, paddingHorizontal: theme.spacing.sm, paddingVertical: 2, borderRadius: theme.borderRadius.full, alignSelf: 'flex-start' },
  highRiskText: { fontSize: theme.typography.fontSize.xs, fontWeight: '600', color: COLORS.textOnPrimary },
  patientAction: { padding: theme.spacing.sm },
  actionText: { color: COLORS.primary, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: theme.spacing.md },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: theme.borderRadius.xl, padding: theme.spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg },
  modalTitle: { fontSize: theme.typography.fontSize.xl, fontWeight: '700', color: COLORS.textPrimary },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { fontSize: 18, color: COLORS.textSecondary, fontWeight: '700' },
  trimesterLabel: { fontSize: theme.typography.fontSize.md, fontWeight: '600', color: COLORS.primary, marginBottom: theme.spacing.md },
  checklistContent: { gap: theme.spacing.md, maxHeight: 400 },
  checklistItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md },
  checklistLabel: { fontSize: theme.typography.fontSize.md, color: COLORS.textPrimary, flex: 1 },
  checklistInput: { width: 100, borderWidth: 1, borderColor: COLORS.border, borderRadius: theme.borderRadius.md, padding: theme.spacing.sm, color: COLORS.textPrimary },
  checkbox: { width: 28, height: 28, borderWidth: 2, borderColor: COLORS.primary, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: COLORS.primary },
  checkboxText: { color: COLORS.textOnPrimary, fontSize: 16 },
  voiceSection: { marginTop: theme.spacing.md, paddingTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  voiceTranscript: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary, fontStyle: 'italic', marginTop: theme.spacing.sm },
  highRiskSection: { marginTop: theme.spacing.md, padding: theme.spacing.md, backgroundColor: '#FFF3E0', borderRadius: theme.borderRadius.md },
  highRiskTitle: { fontSize: theme.typography.fontSize.md, fontWeight: '700', color: COLORS.warning, marginBottom: theme.spacing.sm },
  highRiskFlag: { fontSize: theme.typography.fontSize.sm, color: COLORS.textPrimary, marginBottom: 4 },
  submitButton: { backgroundColor: COLORS.primary, paddingVertical: theme.spacing.md, borderRadius: theme.borderRadius.md, alignItems: 'center', marginTop: theme.spacing.lg },
  submitButtonText: { color: COLORS.textOnPrimary, fontWeight: '700', fontSize: theme.typography.fontSize.md },
});