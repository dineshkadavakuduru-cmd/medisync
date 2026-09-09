import React, { useEffect, useRef, useState } from 'react';
import { Modal, RefreshControl, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { fieldClient, inventoryOrderStatuses, type FieldInventory, type FieldMedicine, type FieldOrder } from '../services/fieldClient';
import { fieldText } from '../i18n/translations/fieldWorkflows';
import { syncService } from '../services/syncService';
import { getActivePersona } from '../services/personas';
import { useTranslation } from '../i18n';
import { FieldQueue, fieldStyles as styles, useFieldScreenState } from './fieldScreenSupport';
import { parseStockQuantity } from './inventoryScreenLogic';

type Medicine = FieldMedicine;
type Entry = { medicine: Medicine; kind: 'dispense' | 'reorder' | 'count'; quantity: string };

export const InventoryScreen: React.FC<{ navigation?: any; route?: { params?: { facilityId?: string } } }> = ({ route }) => {
  const { t, language } = useTranslation();
  const { persona, actions } = useFieldScreenState();
  const allowed = persona.role === 'PHARMACIST';
  const [facilityInput, setFacilityInput] = useState(route?.params?.facilityId || '');
  const [facilityId, setFacilityId] = useState(route?.params?.facilityId || '');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [snapshot, setSnapshot] = useState<FieldInventory | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const request = useRef(0);
  const lock = useRef(false);
  const inventoryActions = actions.filter(a => ['DISPENSE_MEDICINE', 'CREATE_INVENTORY_ORDER', 'UPDATE_INVENTORY', 'UPDATE_INVENTORY_ORDER'].includes(a.type) && a.payload.facilityId === facilityId);
  const confirmed = inventoryActions.filter(a => a.status === 'synced').map(a => a.id).sort().join(',');

  const loadData = async () => {
    if (!allowed || !facilityId) return;
    const version = ++request.current;
    setLoading(true);
    try {
      const loaded = await fieldClient.inventory(facilityId);
      if (version === request.current) { setMedicines(loaded.stocks); setSnapshot(loaded); setLoadError(false); }
    } catch { if (version === request.current) setLoadError(true); }
    finally { if (version === request.current) setLoading(false); }
  };

  useEffect(() => {
    setMedicines([]); setSnapshot(null); setEntry(null); setCategory('');
  }, [facilityId, allowed]);
  useEffect(() => {
    void loadData();
    return () => { request.current += 1; };
  }, [facilityId, allowed, confirmed]);

  const saveEntry = async () => {
    if (!entry || lock.current || getActivePersona().role !== 'PHARMACIST' || !facilityId || loading || loadError) return;
    const quantity = parseStockQuantity(entry.quantity, entry.kind === 'count');
    const medicine = medicines.find(item => item.id === entry.medicine.id);
    const reserved = inventoryActions.filter(a => a.type === 'DISPENSE_MEDICINE' && a.status !== 'synced' && !a.discarded && a.payload.medicineId === entry.medicine.id)
      .reduce((sum, a) => sum + (typeof a.payload.quantity === 'number' ? a.payload.quantity : 0), 0);
    if (quantity === null || !medicine || quantity > medicine.maxCapacity ||
        (entry.kind === 'dispense' && quantity > Math.max(0, medicine.currentStock - reserved))) { setInvalid(true); return; }
    lock.current = true; setSaving(true); setSaveError(false); setInvalid(false);
    const timestamp = Date.now();
    const payload = {
      medicineId: medicine.id, medicineName: medicine.name, facilityId, quantity,
      staffId: persona.staffId, timestamp: new Date(timestamp).toISOString(),
      ...(entry.kind === 'count' ? { newStock: quantity, currentStock: quantity, operation: 'physical_count' } : {}),
      ...(entry.kind === 'dispense' ? { dispensedBy: persona.staffId } : {}),
      ...(entry.kind === 'reorder' ? { orderedBy: persona.staffId, status: 'PO' } : {}),
    };
    try {
      await syncService.enqueue({
        type: entry.kind === 'dispense' ? 'DISPENSE_MEDICINE' : entry.kind === 'reorder' ? 'CREATE_INVENTORY_ORDER' : 'UPDATE_INVENTORY',
        payload, timestamp,
      });
      setEntry(null);
    } catch { setSaveError(true); }
    finally { lock.current = false; setSaving(false); }
  };

  const advanceOrder = async (order: FieldOrder) => {
    if (lock.current || loading || loadError || getActivePersona().role !== 'PHARMACIST' ||
        inventoryActions.some(a => a.payload.orderId === order.id && a.status !== 'synced' && !a.discarded)) return;
    const status = inventoryOrderStatuses[inventoryOrderStatuses.indexOf(order.status) + 1];
    if (!status) return;
    lock.current = true; setSaving(true); setSaveError(false);
    try {
      await syncService.enqueue({ type: 'UPDATE_INVENTORY_ORDER', timestamp: Date.now(), payload: {
        facilityId, orderId: order.id, status, staffId: persona.staffId, timestamp: new Date().toISOString(),
      } });
    } catch { setSaveError(true); }
    finally { lock.current = false; setSaving(false); }
  };

  if (!allowed) return <SafeAreaView style={styles.container}><Text style={styles.error}>{t('inventory.roleRequired')}</Text></SafeAreaView>;
  const filtered = medicines.filter(m => (!category || m.category === category) && m.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void loadData()} />}>
        <Text style={styles.title}>{t('inventory.title')}</Text>
        <Text style={styles.hint}>{fieldText(language, 'source')}</Text>
        {snapshot && <Text style={styles.hint}>{fieldText(language, snapshot.mode)}</Text>}
        <TextInput style={styles.input} accessibilityLabel={t('diagnostics.facilityId')} placeholder={t('diagnostics.facilityId')} value={facilityInput} onChangeText={setFacilityInput} editable={!saving} />
        <TouchableOpacity style={styles.button} disabled={loading || saving || !facilityInput.trim()} onPress={() => { if (facilityInput.trim() === facilityId) void loadData(); else setFacilityId(facilityInput.trim()); }}><Text style={styles.buttonText}>{t('inventory.loadStock')}</Text></TouchableOpacity>
        {loadError && <Text accessibilityRole="alert" style={styles.error}>{t('inventory.unavailable')}</Text>}
        {saveError && <Text accessibilityRole="alert" style={styles.error}>{t('fieldSync.saveFailed')}</Text>}
        {!!facilityId && <FieldQueue actions={inventoryActions} allowCorrection />}
        <TextInput style={styles.input} accessibilityLabel={t('inventory.searchPlaceholder')} placeholder={t('inventory.searchPlaceholder')} value={query} onChangeText={setQuery} />
        <View style={styles.row}>{['', ...new Set(medicines.map(m => m.category))].map(value => <TouchableOpacity key={value} style={[styles.chip, category === value && styles.selected]} onPress={() => setCategory(value)}><Text style={styles.text}>{value || t('diagnostics.all')}</Text></TouchableOpacity>)}</View>
        {!loading && !loadError && !filtered.length && <Text style={styles.hint}>{t('inventory.noMedicines')}</Text>}
        {filtered.map(medicine => {
          const usage = snapshot?.usage.find(row => row.medicineId === medicine.id);
          const status = medicine.currentStock === 0 ? 'outOfStock' : medicine.currentStock <= medicine.minThreshold * 0.5 ? 'critical' : medicine.currentStock <= medicine.minThreshold ? 'low' : 'adequate';
          return <View key={medicine.id} style={styles.card}>
            <Text style={styles.heading}>{medicine.name}</Text>
            <Text style={styles.hint}>{medicine.category} | {t(`facility.${status}`)}</Text>
            <Text style={styles.text}>{t('inventory.serverStock')}: {medicine.currentStock} {medicine.unit}</Text>
            <Text style={styles.hint}>{fieldText(language, 'usage')}: {usage?.dailyAverage7.toFixed(1) ?? '-'} / {usage?.dailyAverage30.toFixed(1) ?? '-'} {t('inventory.perDay')}</Text>
            <View style={styles.row}>{(['dispense', 'reorder', 'count'] as const).map(kind => <TouchableOpacity key={kind} style={[styles.button, (loadError || loading) && styles.disabled]} disabled={loadError || loading || saving} onPress={() => { setSaveError(false); setInvalid(false); setEntry({ medicine, kind, quantity: '' }); }}><Text style={styles.buttonText}>{t(`inventory.${kind === 'count' ? 'recordCount' : kind}`)}</Text></TouchableOpacity>)}</View>
          </View>;
        })}
        {!!snapshot?.orders.length && <Text style={styles.heading}>{fieldText(language, 'orders')}</Text>}
        {snapshot?.orders.map(order => <View key={order.id} style={styles.card}>
          <Text style={styles.heading}>{medicines.find(m => m.id === order.medicineId)?.name || order.medicineId}: {order.quantity} | {order.status}</Text>
          {order.history.map((event, index) => <Text key={index} style={styles.hint}>{event.status} | {event.timestamp} | {event.staffId}</Text>)}
          {order.status !== 'STOCKED' && <TouchableOpacity style={styles.button} disabled={saving || loading || loadError || inventoryActions.some(a => a.payload.orderId === order.id && a.status !== 'synced' && !a.discarded)} onPress={() => void advanceOrder(order)}><Text style={styles.buttonText}>{fieldText(language, 'advance')}: {inventoryOrderStatuses[inventoryOrderStatuses.indexOf(order.status) + 1]}</Text></TouchableOpacity>}
        </View>)}
        {!!snapshot?.log.length && <Text style={styles.heading}>{fieldText(language, 'history')}</Text>}
        {snapshot?.log.slice().reverse().map(log => <Text key={log.id} style={styles.hint}>{log.medicineId} | {log.kind} | {log.before} &gt; {log.after} | {log.timestamp} | {log.staffId}</Text>)}
      </ScrollView>

      {entry && <Modal visible transparent animationType="slide" onRequestClose={() => { if (!saving) setEntry(null); }}>
        <View style={styles.overlay}><View style={styles.modal}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>{t(`inventory.${entry.kind === 'count' ? 'recordCount' : entry.kind}`)}: {entry.medicine.name}</Text>
          <Text style={styles.hint}>{t('fieldSync.explanation')}</Text>
          {entry.kind === 'count' && <Text style={styles.hint}>{t('inventory.countNotice')}</Text>}
          {saveError && <Text accessibilityRole="alert" style={styles.error}>{t('fieldSync.saveFailed')}</Text>}
          {invalid && <Text accessibilityRole="alert" style={styles.error}>{t('inventory.invalidQuantity')}</Text>}
          <TextInput style={styles.input} accessibilityLabel={t('inventory.quantity')} placeholder={t('inventory.quantity')} keyboardType="number-pad" value={entry.quantity} editable={!saving} onChangeText={quantity => setEntry({ ...entry, quantity })} />
          {loadError && <Text style={styles.error}>{t('inventory.unavailable')}</Text>}
          <TouchableOpacity style={[styles.button, (saving || loading || loadError) && styles.disabled]} disabled={saving || loading || loadError} onPress={() => void saveEntry()}><Text style={styles.buttonText}>{t('fieldSync.saveToQueue')}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.chip} disabled={saving} onPress={() => setEntry(null)}><Text style={styles.text}>{t('common.cancel')}</Text></TouchableOpacity>
        </ScrollView></View></View>
      </Modal>}
    </SafeAreaView>
  );
};
