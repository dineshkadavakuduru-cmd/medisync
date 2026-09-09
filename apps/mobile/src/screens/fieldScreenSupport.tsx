import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '@medisync/shared';
import { syncService } from '../services/syncService';
import { getActivePersona, onPersonaChange } from '../services/personas';
import { useTranslation } from '../i18n';
import { fieldText } from '../i18n/translations/fieldWorkflows';

export function useFieldScreenState() {
  const [persona, setPersona] = useState(getActivePersona);
  const [actions, setActions] = useState(() => syncService.getActions());
  useEffect(() => onPersonaChange(setPersona), []);
  useEffect(() => {
    const update = () => setActions(syncService.getActions());
    const unsubscribe = syncService.subscribe(update);
    update();
    return unsubscribe;
  }, []);
  return { persona, actions };
}

export function FieldQueue({ actions, allowCorrection = false }: { actions: ReturnType<typeof syncService.getActions>; allowCorrection?: boolean }) {
  const { t, language } = useTranslation();
  const [discardError, setDiscardError] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const discard = async (id: string) => {
    setDiscarding(true); setDiscardError(false);
    try { await syncService.discardRejected(id); } catch { setDiscardError(true); }
    finally { setDiscarding(false); }
  };
  return (
    <View style={styles.queue}>
      <Text style={styles.text}>{t('fieldSync.title')} ({actions.length})</Text>
      <Text style={styles.text}>{t('fieldSync.explanation')}</Text>
      {discardError && <Text accessibilityRole="alert" style={fieldStyles.error}>{fieldText(language, 'discardFailed')}</Text>}
      {actions.slice().sort((a, b) => b.timestamp - a.timestamp).map(action => (
        <View key={action.id}>
        <Text style={styles.text}>
          {action.type === 'UPDATE_INVENTORY_ORDER' ? fieldText(language, 'advance') : t(`fieldSync.${action.type}`)} | {String(action.payload.patientId || action.payload.medicineId || action.payload.orderId || '')}
          {' | '}{new Date(action.timestamp).toLocaleString()}{' | '}{t(`fieldSync.${action.status}`)}
          {typeof action.payload.quantity === 'number' ? ` | ${t('inventory.quantity')}: ${action.payload.quantity}` : ''}
          {typeof action.payload.testCode === 'string' ? ` | ${action.payload.testCode}: ${String(action.payload.value || '')} ${String(action.payload.unit || '')}` : ''}
          {action.type === 'CREATE_DIAGNOSTIC_ORDER' && Array.isArray(action.payload.tests) ? ` | ${action.payload.tests.join(', ')}` : ''}
          {action.type === 'UPDATE_DIAGNOSTIC_STATUS' && typeof action.payload.status === 'string' ? ` | ${t(`diagnostics.status.${action.payload.status.toLowerCase()}`)}` : ''}
          {action.status === 'error' ? `: ${action.error || t('fieldSync.notConfirmed')}` : ''}
          {action.discarded ? ` | ${fieldText(language, 'discarded')}` : ''}
          {action.type === 'CREATE_ASHA_VISIT' && action.status === 'synced' && action.response && typeof action.response === 'object' &&
            'patientProjection' in action.response && action.response.patientProjection === 'pending' ? ` | ${fieldText(language, 'projection')}` : ''}
        </Text>
        {allowCorrection && !action.discarded && action.status === 'error' && [400, 422].includes(action.rejectionStatus || 0) &&
          <TouchableOpacity accessibilityRole="button" disabled={discarding} style={fieldStyles.chip} onPress={() => void discard(action.id)}><Text style={styles.text}>{fieldText(language, 'discard')}</Text></TouchableOpacity>}
        </View>
      ))}
    </View>
  );
}

// These reads have no fallback data. Reject malformed envelopes instead of showing an empty success.
export function responseList(value: unknown): unknown[] {
  if (!value || typeof value !== 'object' || !('success' in value) || value.success !== true ||
      !('data' in value) || !Array.isArray(value.data)) throw new Error('Invalid server response');
  return value.data;
}

export const fieldStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 100, gap: 14 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary },
  heading: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary },
  text: { color: COLORS.textPrimary, fontSize: 15 },
  hint: { color: COLORS.textSecondary, fontSize: 14 },
  error: { color: COLORS.severityRed, fontSize: 15 },
  card: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, color: COLORS.textPrimary, backgroundColor: COLORS.surface },
  button: { backgroundColor: COLORS.primary, borderRadius: 8, padding: 12, alignItems: 'center' },
  buttonText: { color: COLORS.textOnPrimary, fontWeight: '600' },
  chip: { borderWidth: 1, borderColor: COLORS.border, padding: 10, borderRadius: 8 },
  selected: { borderColor: COLORS.primary, borderWidth: 2 },
  disabled: { opacity: 0.5 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modal: { backgroundColor: COLORS.background, borderRadius: 12, maxHeight: '90%' },
});

const styles = StyleSheet.create({
  queue: { padding: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, gap: 8 },
  text: { color: COLORS.textSecondary, fontSize: 13 },
});
