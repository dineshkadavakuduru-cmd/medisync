import React, { useEffect, useRef, useState } from 'react';
import { Modal, RefreshControl, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { DiagnosticOrder, DiagnosticPriority, DiagnosticStatus, TestFlag } from '@medisync/shared';
import { api } from '../services/api';
import { syncService } from '../services/syncService';
import { useTranslation } from '../i18n';
import { FieldQueue, fieldStyles as styles, useFieldScreenState } from './fieldScreenSupport';

type Catalog = NonNullable<Awaited<ReturnType<typeof api.getDiagnosticsTests>>['data']>;
type DraftResult = { orderId: string; testCode: string; value: string; unit: string; flag: TestFlag | ''; referenceRange: string };
function isValidResult(result: DraftResult): boolean {
  const value = result.value.trim();
  return value.length > 0 && value.length <= 2000 && !/^(pending|n\/?a|not yet added)$/i.test(value) &&
    result.unit.trim().length <= 50 && result.referenceRange.trim().length <= 200 &&
    ['NORMAL', 'ABNORMAL', 'CRITICAL'].includes(result.flag);
}
const STATUSES: DiagnosticStatus[] = ['ORDERED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const NEXT_STATUSES: Record<DiagnosticStatus, DiagnosticStatus[]> = {
  ORDERED: ['SAMPLE_COLLECTED', 'CANCELLED'], SAMPLE_COLLECTED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'], COMPLETED: [], CANCELLED: [],
};

export const DiagnosticsScreen: React.FC<{ navigation?: any; route?: { params?: { patientId?: string; facilityId?: string; triageId?: string; referralId?: string; recommendedTests?: string[] } } }> = ({ route }) => {
  const { t } = useTranslation();
  const { actions, persona } = useFieldScreenState();
  const [orders, setOrders] = useState<DiagnosticOrder[]>([]);
  const [catalog, setCatalog] = useState<Catalog>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [ordersError, setOrdersError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [discardError, setDiscardError] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const request = useRef(0);
  const [showCreate, setShowCreate] = useState(false);
  const [patientId, setPatientId] = useState(route?.params?.patientId || '');
  const [facilityId, setFacilityId] = useState(route?.params?.facilityId || '');
  const [tests, setTests] = useState<string[]>(route?.params?.recommendedTests || []);
  const [priority, setPriority] = useState<DiagnosticPriority>('ROUTINE');
  const [notes, setNotes] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [result, setResult] = useState<DraftResult | null>(null);
  const [filter, setFilter] = useState<DiagnosticStatus | 'ALL'>('ALL');
  const diagnosticActions = actions.filter(a => ['CREATE_DIAGNOSTIC_ORDER', 'ADD_DIAGNOSTIC_RESULT', 'UPDATE_DIAGNOSTIC_STATUS'].includes(a.type));
  const selected = orders.find(order => order.id === selectedId);
  const confirmed = diagnosticActions.filter(a => a.status === 'synced').map(a => a.id).sort().join(',');

  const loadData = async () => {
    const version = ++request.current;
    setLoading(true);
    await Promise.all([
      (async () => {
        try {
          const response = await api.getDiagnosticsTests();
          if (!response.success || !Array.isArray(response.data) || response.data.some(test => !test || typeof test.code !== 'string' || typeof test.name !== 'string' || typeof test.unit !== 'string' || typeof test.normalRange !== 'string')) throw new Error('Invalid catalogue');
          if (version === request.current) { setCatalog(response.data); setCatalogError(response.data.length === 0); }
        } catch {
          if (version === request.current) { setCatalog([]); setCatalogError(true); }
        }
      })(),
      (async () => {
        try {
          const response = await api.getDiagnosticsOrders(route?.params?.facilityId, route?.params?.patientId);
          if (!response.success || !Array.isArray(response.data) || response.data.some((order: DiagnosticOrder) => !order || typeof order.id !== 'string' || !STATUSES.includes(order.status) || !Array.isArray(order.tests) || order.tests.some(code => typeof code !== 'string') || !Array.isArray(order.results) || order.results.some(entry => !entry || typeof entry.testCode !== 'string' || typeof entry.value !== 'string'))) throw new Error('Invalid orders');
          if (version === request.current) { setOrders(response.data); setOrdersError(false); }
        } catch { if (version === request.current) setOrdersError(true); }
      })(),
    ]);
    if (version === request.current) setLoading(false);
  };

  useEffect(() => {
    void loadData();
    return () => { request.current += 1; };
  }, [confirmed]);

  const enqueue = async (action: Parameters<typeof syncService.enqueue>[0]) => {
    if (saveLock.current) return false;
    saveLock.current = true;
    setSaving(true);
    setSaveError(false);
    try { await syncService.enqueue(action); return true; }
    catch { setSaveError(true); return false; }
    finally { saveLock.current = false; setSaving(false); }
  };

  const createOrder = async () => {
    if (!patientId.trim() || !facilityId.trim() || !tests.length || catalogError || tests.some(code => !catalog.some(test => test.code === code))) return;
    const payload: Parameters<typeof api.createDiagnosticsOrder>[0] = {
      patientId: patientId.trim(), facilityId: facilityId.trim(), tests, priority, notes: notes.trim() || undefined,
      orderedBy: persona.staffId, triageId: route?.params?.triageId, referralId: route?.params?.referralId,
    };
    if (await enqueue({ type: 'CREATE_DIAGNOSTIC_ORDER', payload: { ...payload }, timestamp: Date.now() })) {
      setShowCreate(false); setTests([]); setNotes(''); setPriority('ROUTINE');
    }
  };

  const saveResult = async () => {
    if (!result || !isValidResult(result) || diagnosticActions.some(action => action.status !== 'synced' && !action.discarded && action.type === 'ADD_DIAGNOSTIC_RESULT' && action.payload.orderId === result.orderId && action.payload.testCode === result.testCode)) return;
    if (await enqueue({ type: 'ADD_DIAGNOSTIC_RESULT', payload: { ...result, value: result.value.trim(), unit: result.unit.trim(), referenceRange: result.referenceRange.trim() || undefined }, timestamp: Date.now() })) setResult(null);
  };

  const discardRejected = async (id: string) => {
    const action = diagnosticActions.find(entry => entry.id === id);
    if (saveLock.current || !action || action.discarded || action.status !== 'error' ||
        (action.rejectionStatus !== 400 && action.rejectionStatus !== 422)) return;
    saveLock.current = true;
    setSaving(true);
    setDiscardError(false);
    try { await syncService.discardRejected(id); }
    catch { setDiscardError(true); }
    finally { saveLock.current = false; setSaving(false); }
  };

  const button = (label: string, onPress: () => void, disabled = false) => (
    <TouchableOpacity accessibilityRole="button" disabled={disabled || saving} style={[styles.button, (disabled || saving) && styles.disabled]} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
  const error = saveError ? <Text accessibilityRole="alert" style={styles.error}>{t('fieldSync.saveFailed')}</Text> : null;
  const renderQueue = (entries: typeof diagnosticActions) => (
    <View style={{ gap: 8 }}>
      <FieldQueue actions={entries} />
      {discardError && <Text accessibilityRole="alert" style={styles.error}>{t('diagnostics.discardFailed')}</Text>}
      {entries.filter(action => action.discarded || (action.status === 'error' && (action.rejectionStatus === 400 || action.rejectionStatus === 422))).map(action => (
        <View key={action.id} style={styles.card}>
          <Text style={styles.text}>{action.id} | {String(action.payload.orderId || action.payload.patientId || '')} | {String(action.payload.testCode || '')}</Text>
          <Text style={styles.hint}>{t(action.discarded ? 'diagnostics.discardedAudit' : 'diagnostics.discardExplanation')}</Text>
          {!action.discarded && button(t('diagnostics.discardRejected'), () => void discardRejected(action.id))}
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void loadData()} />}>
        <Text style={styles.title}>{t('diagnostics.title')}</Text>
        {error}
        {ordersError && <Text style={styles.error}>{t('diagnostics.ordersUnavailable')}</Text>}
        {catalogError && <Text style={styles.error}>{t('diagnostics.catalogUnavailable')}</Text>}
        {button(t('common.retry'), () => void loadData(), loading)}
        {button(t('diagnostics.newOrder'), () => { setSaveError(false); setShowCreate(true); }, !catalog.length || catalogError)}
        {renderQueue(diagnosticActions)}
        <View style={styles.row}>
          {(['ALL', ...STATUSES] as const).map(status => (
            <TouchableOpacity key={status} accessibilityRole="button" accessibilityState={{ selected: status === filter }} style={[styles.chip, status === filter && styles.selected]} onPress={() => setFilter(status)}>
              <Text style={styles.text}>{status === 'ALL' ? t('diagnostics.all') : t(`diagnostics.status.${status.toLowerCase()}`)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {!loading && !ordersError && !orders.filter(o => filter === 'ALL' || o.status === filter).length && <Text style={styles.hint}>{t('diagnostics.noOrders')}</Text>}
        {orders.filter(order => filter === 'ALL' || order.status === filter).map(order => (
          <TouchableOpacity key={order.id} style={styles.card} onPress={() => { setSelectedId(order.id); setSaveError(false); }}>
            <Text style={styles.heading}>{order.patientName || order.patientId}</Text>
            <Text style={styles.text}>{order.id} | {order.facilityName || order.facilityId}</Text>
            <Text style={styles.text}>{t(`diagnostics.status.${order.status.toLowerCase()}`)} | {t(`diagnostics.priorityLabels.${order.priority}`)}</Text>
            <Text style={styles.hint}>{order.tests.map(code => catalog.find(test => test.code === code)?.name || code).join(', ')}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {showCreate && <Modal visible transparent animationType="slide" onRequestClose={() => { if (!saving) setShowCreate(false); }}>
        <View style={styles.overlay}><View style={styles.modal}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={styles.heading}>{t('diagnostics.newOrder')}</Text>
          {error}
          <Text style={styles.hint}>{t('fieldSync.explanation')}</Text>
          <TextInput accessibilityLabel={t('diagnostics.patientId')} style={styles.input} placeholder={t('diagnostics.patientId')} value={patientId} onChangeText={setPatientId} editable={!saving} />
          <TextInput accessibilityLabel={t('diagnostics.facilityId')} style={styles.input} placeholder={t('diagnostics.facilityId')} value={facilityId} onChangeText={setFacilityId} editable={!saving} />
          <Text style={styles.text}>{t('diagnostics.priority')}</Text>
          <View style={styles.row}>{(['ROUTINE', 'URGENT', 'STAT'] as const).map(value => <TouchableOpacity key={value} disabled={saving} style={[styles.chip, priority === value && styles.selected]} onPress={() => setPriority(value)}><Text style={styles.text}>{t(`diagnostics.priorityLabels.${value}`)}</Text></TouchableOpacity>)}</View>
          <Text style={styles.text}>{t('diagnostics.selectTests')}</Text>
          {catalogError && <Text style={styles.error}>{t('diagnostics.catalogUnavailable')}</Text>}
          {catalog.map(test => <TouchableOpacity key={test.code} accessibilityRole="checkbox" accessibilityState={{ checked: tests.includes(test.code) }} disabled={saving} style={[styles.chip, tests.includes(test.code) && styles.selected]} onPress={() => setTests(prev => prev.includes(test.code) ? prev.filter(code => code !== test.code) : [...prev, test.code])}><Text style={styles.text}>{test.name} ({test.code})</Text><Text style={styles.hint}>{test.unit} | {test.normalRange}</Text></TouchableOpacity>)}
          <TextInput style={styles.input} accessibilityLabel={t('diagnostics.notes')} placeholder={t('diagnostics.notes')} value={notes} onChangeText={setNotes} multiline editable={!saving} />
          {button(t('fieldSync.saveToQueue'), () => void createOrder(), !patientId.trim() || !facilityId.trim() || !tests.length || catalogError)}
          {button(t('common.cancel'), () => setShowCreate(false))}
        </ScrollView></View></View>
      </Modal>}

      {selected && !result && <Modal visible transparent animationType="slide" onRequestClose={() => { if (!saving) setSelectedId(null); }}>
        <View style={styles.overlay}><View style={styles.modal}><ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.heading}>{t('diagnostics.orderDetail')}: {selected.id}</Text>
          {error}
          <Text style={styles.text}>{selected.patientName || selected.patientId} | {selected.facilityName || selected.facilityId}</Text>
          <Text style={styles.text}>{t(`diagnostics.status.${selected.status.toLowerCase()}`)}</Text>
          {!!selected.notes && <Text style={styles.text}>{selected.notes}</Text>}
          <Text style={styles.hint}>{t('diagnostics.clinicianReview')}</Text>
          {renderQueue(diagnosticActions.filter(a => a.payload.orderId === selected.id))}
          {selected.tests.map(code => <View key={code} style={styles.card}>
            <Text style={styles.heading}>{catalog.find(test => test.code === code)?.name || code}</Text>
            {selected.results.filter(entry => entry.testCode === code).map(entry => <Text key={entry.id} style={entry.flag === 'CRITICAL' ? styles.error : styles.text}>{entry.value} {entry.unit} | {t(`diagnostics.flags.${entry.flag}`)} | {entry.referenceRange || ''}</Text>)}
            {button(t('diagnostics.addResult'), () => {
              const test = catalog.find(entry => entry.code === code);
              setResult({ orderId: selected.id, testCode: code, value: '', unit: test?.unit || '', referenceRange: test?.normalRange || '', flag: '' });
            }, !['SAMPLE_COLLECTED', 'IN_PROGRESS'].includes(selected.status) || selected.results.some(entry => entry.testCode === code) || diagnosticActions.some(action => action.status !== 'synced' && !action.discarded && action.type === 'ADD_DIAGNOSTIC_RESULT' && action.payload.orderId === selected.id && action.payload.testCode === code))}
          </View>)}
          <Text style={styles.text}>{t('diagnostics.nextStatus')}</Text>
          {NEXT_STATUSES[selected.status].map(status => <View key={status}>{button(t(`diagnostics.status.${status.toLowerCase()}`), () => void enqueue({ type: 'UPDATE_DIAGNOSTIC_STATUS', payload: { orderId: selected.id, status }, timestamp: Date.now() }), (status === 'COMPLETED' && !selected.tests.every(code => selected.results.some(entry => entry.testCode === code))) || diagnosticActions.some(action => action.status !== 'synced' && !action.discarded && action.type === 'UPDATE_DIAGNOSTIC_STATUS' && action.payload.orderId === selected.id))}</View>)}
          {button(t('common.back'), () => setSelectedId(null))}
        </ScrollView></View></View>
      </Modal>}

      {result && <Modal visible transparent animationType="slide" onRequestClose={() => { if (!saving) setResult(null); }}>
        <View style={styles.overlay}><View style={styles.modal}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={styles.heading}>{t('diagnostics.addResult')}: {result.testCode}</Text>
          {error}
          <Text style={styles.hint}>{t('diagnostics.resultRequirements')}</Text>
          {(['value', 'unit', 'referenceRange'] as const).map(key => <View key={key} style={{ gap: 6 }}><Text style={styles.text}>{t(`diagnostics.${key === 'referenceRange' ? 'reference' : key}`)}</Text><TextInput style={styles.input} accessibilityLabel={t(`diagnostics.${key === 'referenceRange' ? 'reference' : key}`)} value={result[key]} editable={!saving} onChangeText={value => setResult({ ...result, [key]: value })} /></View>)}
          <Text style={styles.text}>{t('diagnostics.flag')}</Text>
          <View style={styles.row}>{(['NORMAL', 'ABNORMAL', 'CRITICAL'] as const).map(flag => <TouchableOpacity key={flag} disabled={saving} style={[styles.chip, result.flag === flag && styles.selected]} onPress={() => setResult({ ...result, flag })}><Text style={styles.text}>{t(`diagnostics.flags.${flag}`)}</Text></TouchableOpacity>)}</View>
          {result.flag === 'CRITICAL' && <Text accessibilityRole="alert" style={styles.error}>{t('diagnostics.criticalWarning')}</Text>}
          <Text style={styles.hint}>{t('diagnostics.clinicianReview')}</Text>
          {button(t('fieldSync.saveToQueue'), () => void saveResult(), !isValidResult(result))}
          {button(t('common.cancel'), () => setResult(null))}
        </ScrollView></View></View>
      </Modal>}
    </SafeAreaView>
  );
};
