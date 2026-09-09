import React, { useEffect, useRef, useState } from 'react';
import { Modal, RefreshControl, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';
import { fieldClient, type FieldVisits } from '../services/fieldClient';
import { fieldText } from '../i18n/translations/fieldWorkflows';
import { syncService } from '../services/syncService';
import { getActivePersona } from '../services/personas';
import { useTranslation } from '../i18n';
import { VoiceInputButton } from '../components/VoiceInputButton';
import { FieldQueue, fieldStyles as styles, responseList, useFieldScreenState } from './fieldScreenSupport';
import { AncPatient, parseAncPatients, TRIMESTER_CHECKLISTS, VisitChecklist, visitChecklistError, visitDueState, visitReviewFlags } from './ashaVisitLogic';

export const AshaHomeVisitScreen: React.FC<{ navigation: any }> = () => {
  const { t, language } = useTranslation();
  const { persona, actions } = useFieldScreenState();
  const allowed = persona.role === 'ASHA';
  const [patients, setPatients] = useState<AncPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<AncPatient | null>(null);
  const [checklist, setChecklist] = useState<VisitChecklist>({});
  const [notes, setNotes] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [nextVisitDate, setNextVisitDate] = useState('');
  const [history, setHistory] = useState<FieldVisits | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [trimester, setTrimester] = useState<1 | 2 | 3 | 'all'>('all');
  const [dueFilter, setDueFilter] = useState<'all' | 'due' | 'upcoming' | 'unknown'>('due');
  const request = useRef(0);
  const lock = useRef(false);
  const visitActions = actions.filter(a => a.type === 'CREATE_ASHA_VISIT' && a.payload.ashaId === persona.staffId);
  const confirmed = visitActions.filter(a => a.status === 'synced').map(a => a.id).sort().join(',');
  const flags = visitReviewFlags(checklist);
  const selectedId = selected?.id;

  const loadData = async () => {
    if (!allowed) return;
    const version = ++request.current;
    setLoading(true);
    try {
      const loaded = parseAncPatients(responseList(await api.getPatients()));
      if (version === request.current) { setPatients(loaded); setLoadError(false); }
    } catch { if (version === request.current) setLoadError(true); }
    finally { if (version === request.current) setLoading(false); }
  };

  useEffect(() => {
    setPatients([]); setSelected(null);
  }, [allowed]);
  useEffect(() => {
    void loadData();
    return () => { request.current += 1; };
  }, [allowed, confirmed]);
  useEffect(() => {
    let active = true;
    setHistory(null); setHistoryError(false);
    if (selectedId && allowed) void fieldClient.visits(selectedId).then(value => {
      if (active) setHistory(value);
    }).catch(() => { if (active) setHistoryError(true); });
    return () => { active = false; };
  }, [selectedId, allowed, confirmed]);

  const saveVisit = async () => {
    if (!selected || lock.current || getActivePersona().role !== 'ASHA') return;
    if (!reviewed || notes.trim().length > 4000 || (nextVisitDate && (visitDueState(nextVisitDate, new Date()) === 'unknown' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(nextVisitDate) || nextVisitDate < new Date().toISOString().slice(0, 10))) ||
        visitChecklistError(checklist) || (!Object.values(checklist).some(value => typeof value === 'boolean' || !!value?.trim()) && !notes.trim())) { setInvalid(true); return; }
    lock.current = true; setSaving(true); setSaveError(false); setInvalid(false);
    // Compute once from this submission, never from a just-scheduled React state update.
    const reviewFlags = visitReviewFlags(checklist);
    const timestamp = Date.now();
    try {
      await syncService.enqueue({ type: 'CREATE_ASHA_VISIT', timestamp, payload: {
        patientId: selected.id, ashaId: persona.staffId, trimester: selected.trimester,
        reviewed, ...(nextVisitDate ? { nextVisitDate } : {}),
        checklist, highRisk: reviewFlags.length > 0, highRiskFlags: reviewFlags,
        requiresClinicianReview: reviewFlags.length > 0, voiceNotes: notes.trim(), timestamp: new Date(timestamp).toISOString(),
      } });
      setSelected(null); setChecklist({}); setNotes('');
    } catch { setSaveError(true); }
    finally { lock.current = false; setSaving(false); }
  };

  if (!allowed) return <SafeAreaView style={styles.container}><Text style={styles.error}>{t('asha.roleRequired')}</Text></SafeAreaView>;
  const now = new Date();
  const filtered = patients.filter(patient => (trimester === 'all' || patient.trimester === trimester) &&
    (dueFilter === 'all' || visitDueState(patient.nextVisitDate, now) === dueFilter));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void loadData()} />}>
        <Text style={styles.title}>{t('asha.title')}</Text>
        <Text style={styles.hint}>{t('asha.scheduleNotice')}</Text>
        {loadError && <Text accessibilityRole="alert" style={styles.error}>{t('asha.unavailable')}</Text>}
        <TouchableOpacity style={styles.button} disabled={loading} onPress={() => void loadData()}><Text style={styles.buttonText}>{t('common.retry')}</Text></TouchableOpacity>
        <FieldQueue actions={visitActions} allowCorrection />
        <Text style={styles.heading}>{t('asha.ancDueList')}</Text>
        <Text style={styles.text}>{t('asha.filterByTrimester')}</Text>
        <View style={styles.row}>{(['all', 1, 2, 3] as const).map(value => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: trimester === value }} style={[styles.chip, trimester === value && styles.selected]} onPress={() => setTrimester(value)}><Text style={styles.text}>{value === 'all' ? t('asha.all') : `${t('asha.trimester')} ${value}`}</Text></TouchableOpacity>)}</View>
        <View style={styles.row}>{(['due', 'upcoming', 'unknown', 'all'] as const).map(value => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: dueFilter === value }} style={[styles.chip, dueFilter === value && styles.selected]} onPress={() => setDueFilter(value)}><Text style={styles.text}>{t(`asha.${value}`)}</Text></TouchableOpacity>)}</View>
        {!loading && !loadError && !patients.length && <Text style={styles.hint}>{t('asha.noAncData')}</Text>}
        {!loading && !loadError && patients.length > 0 && !filtered.length && <Text style={styles.hint}>{t('asha.noDuePatients')}</Text>}
        {filtered.map(patient => <TouchableOpacity key={patient.id} style={styles.card} disabled={loading || loadError || visitActions.some(a => a.payload.patientId === patient.id && a.status !== 'synced' && !a.discarded)} onPress={() => { setSelected(patient); setChecklist({}); setNotes(''); setReviewed(false); setNextVisitDate(''); setSaveError(false); setInvalid(false); }}>
          <Text style={styles.heading}>{patient.name}</Text>
          <Text style={styles.text}>{t('asha.trimester')}: {patient.trimester}</Text>
          <Text style={styles.hint}>{t('asha.lastVisit')}: {patient.lastVisit || t('asha.unknown')}</Text>
          <Text style={styles.hint}>{t('asha.nextVisit')}: {patient.nextVisitDate || t('asha.unknown')} | {t(`asha.${visitDueState(patient.nextVisitDate, now)}`)}</Text>
          <Text style={styles.hint}>{patient.village || ''} | {patient.phone || ''}</Text>
          <Text style={styles.text}>{t('asha.startVisit')}</Text>
        </TouchableOpacity>)}
      </ScrollView>

      {selected && <Modal visible transparent animationType="slide" onRequestClose={() => { if (!saving) setSelected(null); }}>
        <View style={styles.overlay}><View style={styles.modal}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>{t('asha.visitChecklist')}: {selected.name}</Text>
          <Text style={styles.hint}>{t('asha.clinicianReview')}</Text>
          {historyError && <Text style={styles.error}>{fieldText(language, 'visitsUnavailable')}</Text>}
          {history && <View style={styles.card}><Text style={styles.heading}>{fieldText(language, 'visits')}</Text>
            {history.visits.map(visit => <Text key={visit.id} style={styles.hint}>{visit.timestamp} | {visit.highRiskFlags.map(flag => t(`asha.${flag}`)).join(', ')}</Text>)}
            {history.patientProjection === 'pending' && history.visits.length > 0 && <Text style={styles.hint}>{fieldText(language, 'projection')}</Text>}
          </View>}
          {saveError && <Text accessibilityRole="alert" style={styles.error}>{t('fieldSync.saveFailed')}</Text>}
          {invalid && <Text accessibilityRole="alert" style={styles.error}>{t('asha.invalidChecklist')} {fieldText(language, 'reviewRequired')}</Text>}
          {TRIMESTER_CHECKLISTS[selected.trimester].map(field => <View key={field.key} style={{ gap: 8 }}>
            <Text style={styles.text}>{t(`asha.fields.${field.key}`)}</Text>
            {field.kind === 'boolean' ? <View style={styles.row}>{([true, false] as const).map(value => <TouchableOpacity key={String(value)} accessibilityRole="radio" accessibilityState={{ checked: checklist[field.key] === value }} disabled={saving} style={[styles.chip, checklist[field.key] === value && styles.selected]} onPress={() => { setReviewed(false); setChecklist(prev => ({ ...prev, [field.key]: value })); }}><Text style={styles.text}>{t(`asha.${value ? 'yes' : 'no'}`)}</Text></TouchableOpacity>)}</View> :
              <TextInput style={styles.input} accessibilityLabel={t(`asha.fields.${field.key}`)} placeholder={field.key === 'bp' ? '120/80' : t('asha.enterValue')} value={checklist[field.key] || ''} editable={!saving} keyboardType={['weight', 'hb', 'fundalHeight'].includes(field.key) ? 'decimal-pad' : 'default'} onChangeText={value => { setReviewed(false); setChecklist(prev => ({ ...prev, [field.key]: value })); }} />}
          </View>)}
          <Text style={styles.text}>{t('asha.voiceNotes')}</Text>
          {!saving && <VoiceInputButton language={language} catalogue={[{ id: 'bp', label: 'BP', labelHi: 'रक्तचाप', labelMr: 'रक्तदाब' }]} onResult={value => { setReviewed(false); setNotes(value.transcript); }} />}
          <TextInput style={styles.input} multiline accessibilityLabel={t('asha.voiceNotes')} value={notes} editable={!saving} onChangeText={value => { setReviewed(false); setNotes(value); }} />
          {flags.map(flag => <Text key={flag} style={styles.error}>{t(`asha.${flag}`)}</Text>)}
          <Text style={styles.hint}>{t('asha.noAutoReferral')}</Text>
          <TextInput style={styles.input} accessibilityLabel={fieldText(language, 'nextVisit')} placeholder={fieldText(language, 'nextVisit')} value={nextVisitDate} editable={!saving} onChangeText={setNextVisitDate} />
          <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: reviewed }} disabled={saving} style={[styles.chip, reviewed && styles.selected]} onPress={() => setReviewed(!reviewed)}><Text style={styles.text}>{fieldText(language, 'reviewed')}</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.button, saving && styles.disabled]} disabled={saving} onPress={() => void saveVisit()}><Text style={styles.buttonText}>{t('fieldSync.saveToQueue')}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.chip} disabled={saving} onPress={() => setSelected(null)}><Text style={styles.text}>{t('common.cancel')}</Text></TouchableOpacity>
        </ScrollView></View></View>
      </Modal>}
    </SafeAreaView>
  );
};
