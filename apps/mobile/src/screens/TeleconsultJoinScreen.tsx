import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { COLORS } from '@medisync/shared';
import { theme } from '../styles/theme';
import { teleconsultClient, TeleconsultRole, TeleconsultSession, TeleconsultStatus } from '../services/teleconsultClient';
import { TeleconsultMeeting } from '../components/TeleconsultMeeting';
import { teleconsultCopy as copy } from '../i18n/translations/teleconsult';

export const TeleconsultJoinScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const sessionId = route.params?.sessionId as string;
  const [session, setSession] = useState<TeleconsultSession | null>(null);
  const [role, setRole] = useState<TeleconsultRole>('patient');
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const alive = useRef(false);
  const operation = useRef(false);
  const loadVersion = useRef(0);
  const meetingGeneration = useRef(0);
  const joinedGeneration = useRef<number | null>(null);

  const load = async () => {
    const version = ++loadVersion.current;
    try {
      const data = await teleconsultClient.get(sessionId);
      if (alive.current && version === loadVersion.current) {
        setSession(data);
        setError('');
        if (!['ACCEPTED', 'IN_PROGRESS'].includes(data.status)) closeMeeting();
      }
    } catch (e) {
      if (alive.current && version === loadVersion.current) setError(e instanceof Error ? e.message : copy.error);
    }
  };

  const closeMeeting = () => {
    meetingGeneration.current += 1;
    joinedGeneration.current = null;
    setMeetingOpen(false);
    setJoined(false);
  };

  useEffect(() => {
    alive.current = true;
    setSession(null);
    closeMeeting();
    void load();
    const interval = setInterval(() => { if (!operation.current) void load(); }, 10000);
    const unsubscribe = navigation.addListener?.('blur', closeMeeting);
    return () => {
      alive.current = false;
      loadVersion.current += 1;
      meetingGeneration.current += 1;
      clearInterval(interval);
      unsubscribe?.();
    };
  }, [sessionId]);

  const update = async (status: TeleconsultStatus, generation?: number) => {
    if (operation.current || !alive.current) return;
    operation.current = true;
    const version = ++loadVersion.current;
    setBusy(true);
    setError('');
    try {
      // Re-read before acting: another participant may already have advanced the session.
      const current = await teleconsultClient.get(sessionId);
      if (!alive.current || version !== loadVersion.current ||
          (generation !== undefined && generation !== meetingGeneration.current)) return;
      const next = status === 'IN_PROGRESS' && current.status === 'IN_PROGRESS'
        ? current : await teleconsultClient.update(sessionId, status);
      if (!alive.current || version !== loadVersion.current) return;
      setSession(next);
      if (status === 'IN_PROGRESS') setJoined(true);
      if (['COMPLETED', 'CANCELLED', 'DECLINED'].includes(status)) closeMeeting();
    } catch (e) {
      if (alive.current && version === loadVersion.current) {
        setError(e instanceof Error ? e.message : copy.error);
        if (generation !== undefined) joinedGeneration.current = null;
      }
    } finally {
      operation.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const generation = meetingGeneration.current;
  const onJoined = () => {
    if (!alive.current || !meetingOpen || generation !== meetingGeneration.current ||
        joinedGeneration.current === generation || operation.current) return;
    joinedGeneration.current = generation;
    void update('IN_PROGRESS', generation);
  };
  const onLeft = () => {
    if (!alive.current || generation !== meetingGeneration.current) return;
    joinedGeneration.current = null;
    setJoined(false);
    // No status mutation: the other participant may still be in the room.
  };

  const button = (label: string, action: () => void, secondary = false) => (
    <TouchableOpacity accessibilityRole="button" disabled={busy}
      style={[styles.button, secondary && styles.secondary, busy && styles.disabled]} onPress={action}>
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
    </TouchableOpacity>
  );

  return <SafeAreaView style={styles.container}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{copy.title}</Text>
      {teleconsultClient.isDemo && <Text style={styles.notice}>{copy.demo}</Text>}
      <Text style={styles.notice}>{copy.roles}</Text>
      <View style={styles.row}>
        {(['patient', 'doctor'] as const).map((value) => <TouchableOpacity key={value}
          accessibilityRole="button" accessibilityState={{ selected: role === value, disabled: meetingOpen || busy }}
          disabled={meetingOpen || busy} onPress={() => setRole(value)}
          style={[styles.role, role === value && styles.selected]}>
          <Text style={styles.body}>{copy[value]} (demo)</Text>
        </TouchableOpacity>)}
      </View>
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {button(copy.retry, () => { if (!operation.current) void load(); }, true)}
      {!session ? <Text style={styles.body}>{error ? copy.error : copy.loading}</Text> : <>
        <View style={styles.card}>
          <Text style={styles.title}>{session.patientName}</Text>
          <Text style={styles.body}>{copy.doctor}: {session.doctorName}</Text>
          <Text style={styles.body}>{copy.scheduled}: {new Date(session.scheduledTime).toLocaleString()}</Text>
          <Text style={styles.body}>{copy.status}: {copy.statuses[session.status]}</Text>
        </View>
        {session.status === 'REQUESTED' && <>
          <Text style={styles.body}>{copy.waiting}</Text>
          {role === 'doctor' && <>
            {button(copy.accept, () => void update('ACCEPTED'))}
            {button(copy.decline, () => void update('DECLINED'), true)}
          </>}
        </>}
        {['ACCEPTED', 'IN_PROGRESS'].includes(session.status) && <>
          <Text style={styles.notice}>{copy.privacy}</Text>
          {!meetingOpen ? button(copy.join, () => {
            meetingGeneration.current += 1;
            joinedGeneration.current = null;
            setMeetingOpen(true);
          }) : <>
            <TeleconsultMeeting meetingLink={session.meetingLink} role={role} onJoined={onJoined} onLeft={onLeft} />
            <Text style={styles.body}>{copy.externalHelp}</Text>
            {!joined && button(copy.confirmJoined, () => void update('IN_PROGRESS', generation), true)}
            {button(copy.leave, closeMeeting, true)}
          </>}
        </>}
        {session.status === 'IN_PROGRESS' && role === 'doctor' && <>
          <Text style={styles.notice}>{copy.completeHelp}</Text>
          {button(copy.complete, () => void update('COMPLETED'))}
        </>}
        {['REQUESTED', 'ACCEPTED'].includes(session.status) && button(copy.cancel, () => void update('CANCELLED'), true)}
      </>}
      {button(copy.back, () => navigation.goBack(), true)}
    </ScrollView>
  </SafeAreaView>;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: theme.layout.screenPadding, paddingBottom: theme.layout.tabBarHeight + 24, gap: 16 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  body: { color: COLORS.textPrimary, fontSize: 15, lineHeight: 22 },
  notice: { backgroundColor: '#EAF3F2', color: '#234B47', padding: 14, borderRadius: 10, lineHeight: 21 },
  card: { backgroundColor: COLORS.surface, padding: 16, borderRadius: 12, gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  role: { borderWidth: 1, borderColor: COLORS.textSecondary, padding: 12, borderRadius: 10 },
  selected: { borderColor: COLORS.primary, backgroundColor: '#D7EEEA', borderWidth: 2 },
  button: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  secondary: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.primary },
  secondaryText: { color: COLORS.primary }, disabled: { opacity: 0.5 },
  error: { color: COLORS.danger, lineHeight: 22 },
});
