import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';
import { COLORS } from '@medisync/shared';
import { bluetoothSupported, connectWearable, isInTransit, startVitalsSimulator, VitalReading, VitalValues, validateVitalValues } from '../services/bluetoothService';
import { voiceVitalsText } from '../i18n/voiceVitals';

export interface VitalsMonitorProps { emergencyId: string; status: string; language: string; apiOrigin?: string; active?: boolean }
type HistoryReading = VitalReading & { id?: string };

export const VitalsMonitor: React.FC<VitalsMonitorProps> = ({ emergencyId, status, language,
  apiOrigin = process.env.EXPO_PUBLIC_API_URL || '', active = true }) => {
  const copy = voiceVitalsText(language);
  const [mode, setMode] = useState<'measured' | 'demo' | null>(null);
  const [readings, setReadings] = useState<HistoryReading[]>([]);
  const [message, setMessage] = useState('');
  const [connecting, setConnecting] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  const connection = useRef<AbortController | null>(null);
  const requests = useRef(new Set<AbortController>());
  const generation = useRef(0);
  const busy = useRef(false);
  const allowed = active && isInTransit(status);
  const currentAllowed = useRef(allowed);
  currentAllowed.current = allowed;
  const origin = apiOrigin.replace(/\/$/, '');
  const url = `${origin}/api/emergencies/${encodeURIComponent(emergencyId)}/vitals`;
  const validOrigin = !origin || /^https?:\/\/[^/?#]+$/.test(origin);

  const cleanup = () => {
    generation.current++;
    connection.current?.abort(); connection.current = null;
    stop.current?.(); stop.current = null;
    requests.current.forEach(controller => controller.abort()); requests.current.clear();
    busy.current = false;
  };
  useEffect(() => {
    cleanup(); setMode(null); setConnecting(false); setReadings([]); setMessage('');
    return cleanup;
  }, [emergencyId, allowed, origin]);

  const request = async (method: 'GET' | 'POST', source: 'measured' | 'demo', reading?: VitalReading) => {
    if (!validOrigin) throw new Error('EXPO_PUBLIC_API_URL must be an origin without /api');
    const controller = new AbortController();
    requests.current.add(controller);
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, { method, signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(source === 'demo' ? { 'X-Demo-Mode': 'true' } : {}) },
        ...(reading ? { body: JSON.stringify(reading) } : {}) });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || `Vitals HTTP ${response.status}`);
      return body;
    } finally { clearTimeout(timeout); requests.current.delete(controller); }
  };
  const start = async (source: 'measured' | 'demo') => {
    cleanup();
    if (!currentAllowed.current) return;
    const run = generation.current;
    setMode(source); setReadings([]); setMessage('');
    const add = (reading: HistoryReading) => setReadings(previous => {
      const next = previous.filter(row => !(row.id && row.id === reading.id) && !(row.measuredAt === reading.measuredAt && row.source === reading.source));
      return [...next, reading].sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt)).slice(-120);
    });
    const receive = (reading: VitalReading) => {
      if (run !== generation.current || !currentAllowed.current) return;
      add(reading);
      if (busy.current) return; // Drop network backlog, never queue stale patient readings.
      busy.current = true;
      void request('POST', source, reading).then(body => {
        if (run === generation.current) { add(body.data); setMessage(copy.saved); }
      }).catch(error => {
        if (run === generation.current) setMessage(`${copy.local}: ${error.message}`);
      }).finally(() => { if (run === generation.current) busy.current = false; });
    };
    // Start BLE before any await so requestDevice retains the user gesture.
    if (source === 'demo') { setConnecting(false); stop.current = startVitalsSimulator(receive); }
    else {
      setConnecting(true);
      const controller = new AbortController(); connection.current = controller;
      try {
        const disconnect = await connectWearable(receive, error => {
          if (run === generation.current) setMessage(error);
        }, () => {
          if (run === generation.current) { cleanup(); setMode(null); setConnecting(false); setMessage(copy.local); }
        }, controller.signal);
        if (run !== generation.current) { disconnect(); return; }
        stop.current = disconnect;
      } catch (error) {
        if (run === generation.current) { cleanup(); setMode(null); setConnecting(false); setMessage(error instanceof Error ? error.message : copy.nativeBle); }
        return;
      }
      if (run === generation.current) setConnecting(false);
    }
    try {
      const body = await request('GET', source);
      if (run !== generation.current) return;
      for (const reading of body.data as HistoryReading[]) {
        const { heartRate, oxygenSaturation, bloodPressureSystolic, bloodPressureDiastolic } = reading;
        const values = Object.fromEntries(Object.entries({ heartRate, oxygenSaturation, bloodPressureSystolic, bloodPressureDiastolic }).filter(([, v]) => v !== undefined));
        if (reading.source === source && Number.isFinite(Date.parse(reading.measuredAt)) && validateVitalValues(values)) add(reading);
      }
    } catch (error) { if (run === generation.current) setMessage(`${copy.local}: ${error instanceof Error ? error.message : 'History unavailable'}`); }
  };
  const heart = readings.filter(row => row.heartRate !== undefined);
  const first = heart.length ? Date.parse(heart[0].measuredAt) : 0;
  const span = heart.length ? Math.max(1000, Date.parse(heart[heart.length - 1].measuredAt) - first) : 1000;
  const points = heart.map(row => `${8 + (Date.parse(row.measuredAt) - first) / span * 284},${112 - (row.heartRate! - 20) / 280 * 104}`).join(' ');
  const fields: (keyof VitalValues)[] = ['heartRate', 'oxygenSaturation', 'bloodPressureSystolic', 'bloodPressureDiastolic'];
  return <View style={styles.card}>
    <Text style={styles.title}>{copy.vitals}</Text>
    <Text>{copy.caution}</Text>
    {!allowed && <Text>{copy.transit}</Text>}
    {!bluetoothSupported() && <Text>{copy.nativeBle}</Text>}
    <View style={styles.actions}>
      <TouchableOpacity accessibilityRole="button" disabled={!allowed || connecting || !bluetoothSupported()} style={styles.button} onPress={() => void start('measured')}><Text style={styles.buttonText}>{connecting ? copy.connecting : copy.connect}</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" disabled={!allowed} style={styles.button} onPress={() => void start('demo')}><Text style={styles.buttonText}>{copy.simulate}</Text></TouchableOpacity>
      {mode && <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => { cleanup(); setMode(null); setConnecting(false); }}><Text style={styles.buttonText}>{copy.disconnect}</Text></TouchableOpacity>}
    </View>
    <Text style={styles.source}>{(mode || readings[readings.length - 1]?.source) === 'demo' ? copy.demo : copy.measured}</Text>
    <Text accessibilityLiveRegion="polite">{message || copy.empty}</Text>
    {fields.map(field => {
      const latest = [...readings].reverse().find(row => row[field] !== undefined);
      return <Text key={field}>{copy[field]}: {latest ? `${latest[field]!.toFixed(0)} (${new Date(latest.measuredAt).toLocaleTimeString()})` : '-'}</Text>;
    })}
    <Svg width="100%" height={120} viewBox="0 0 300 120" accessibilityLabel={copy.heartRate}>
      <Line x1={8} y1={8} x2={8} y2={112} stroke={COLORS.border} />
      <Line x1={8} y1={112} x2={292} y2={112} stroke={COLORS.border} />
      {heart.length > 1 && <Polyline points={points} fill="none" stroke={mode === 'demo' ? COLORS.warning : COLORS.primary} strokeWidth={2} />}
    </Svg>
    <Text>{copy.history}</Text>
  </View>;
};
const styles = StyleSheet.create({
  card: { padding: 16, margin: 16, borderRadius: 12, backgroundColor: COLORS.surface, gap: 10 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { padding: 12, backgroundColor: COLORS.primary, borderRadius: 8 },
  buttonText: { color: COLORS.textOnPrimary, fontWeight: '600' },
  source: { fontWeight: '700', color: COLORS.warning },
});
