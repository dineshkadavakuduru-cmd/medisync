import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity, Alert, Modal, TextInput, Platform } from 'react-native';
import { COLORS } from '@medisync/shared';
import { theme } from '../styles/theme';
import { teleconsultClient, TeleconsultRole, TeleconsultSession, TeleconsultStatus, Prescription, PrescriptionMedication } from '../services/teleconsultClient';
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
  const [showAvailability, setShowAvailability] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [prescriptionMeds, setPrescriptionMeds] = useState<PrescriptionMedication[]>([{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }]);
  const [prescriptionNotes, setPrescriptionNotes] = useState('');
  const [savingPrescription, setSavingPrescription] = useState(false);
  const [sessionTimer, setSessionTimer] = useState(0);
  const [showTimer, setShowTimer] = useState(false);

  const alive = useRef(false);
  const operation = useRef(false);
  const loadVersion = useRef(0);
  const meetingGeneration = useRef(0);
  const joinedGeneration = useRef<number | null>(null);
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartTime = useRef<number | null>(null);
  const autoEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    stopTimer();
    clearAutoEndTimer();
  };

  const startTimer = () => {
    if (sessionStartTime.current === null) {
      sessionStartTime.current = Date.now();
    }
    setShowTimer(true);
    timerInterval.current = setInterval(() => {
      setSessionTimer(Date.now() - (sessionStartTime.current || Date.now()));
    }, 1000);
  };

  const stopTimer = () => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }
  };

  const clearAutoEndTimer = () => {
    if (autoEndTimer.current) {
      clearTimeout(autoEndTimer.current);
      autoEndTimer.current = null;
    }
  };

  const setAutoEndTimer = (durationMinutes: number) => {
    clearAutoEndTimer();
    autoEndTimer.current = setTimeout(() => {
      if (alive.current && session?.status === 'IN_PROGRESS') {
        update('COMPLETED');
      }
    }, durationMinutes * 60 * 1000);
  };

  const extendSession = () => {
    if (autoEndTimer.current) {
      clearAutoEndTimer();
      setAutoEndTimer(5); // Extend by 5 minutes
      Alert.alert('Session Extended', 'Session extended by 5 minutes');
    }
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
      stopTimer();
      clearAutoEndTimer();
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
      const current = await teleconsultClient.get(sessionId);
      if (!alive.current || version !== loadVersion.current ||
          (generation !== undefined && generation !== meetingGeneration.current)) return;
      const next = status === 'IN_PROGRESS' && current.status === 'IN_PROGRESS'
        ? current : await teleconsultClient.update(sessionId, status);
      if (!alive.current || version !== loadVersion.current) return;
      setSession(next);
      if (status === 'IN_PROGRESS') {
        setJoined(true);
        startTimer();
        setAutoEndTimer(30); // Default 30 min session
      }
      if (['COMPLETED', 'CANCELLED', 'DECLINED'].includes(status)) {
        closeMeeting();
      }
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
    stopTimer();
    clearAutoEndTimer();
  };

  const copyMeetingLink = async () => {
    if (!session?.meetingLink) return;
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(session.meetingLink);
      } else {
        const { Clipboard } = await import('@react-native-clipboard/clipboard');
        await Clipboard.setString(session.meetingLink);
      }
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (e) {
      console.error('Failed to copy link:', e);
    }
  };

  const shareViaWhatsApp = async () => {
    if (!session?.meetingLink) return;
    const message = `Join my MediSync teleconsultation: ${session.meetingLink}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    try {
      const { Linking } = await import('react-native');
      await Linking.openURL(url);
    } catch (e) {
      console.error('Failed to share via WhatsApp:', e);
    }
  };

  const handleSavePrescription = async () => {
    if (!session || prescriptionMeds.some(m => !m.name || !m.dosage || !m.frequency || !m.duration)) {
      Alert.alert('Error', 'Please fill all required medication fields');
      return;
    }
    setSavingPrescription(true);
    try {
      await teleconsultClient.createPrescription({
        sessionId: session.id,
        patientId: session.patientId || 'patient-1',
        doctorId: 'doc-1', // In real app, get from auth
        medications: prescriptionMeds,
        notes: prescriptionNotes,
      });
      Alert.alert('Success', copy.prescriptionSaved);
      setShowPrescriptionModal(false);
      void load(); // Reload to get updated session with prescription
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save prescription');
    } finally {
      setSavingPrescription(false);
    }
  };

  const addMedication = () => {
    setPrescriptionMeds(prev => [...prev, { name: '', dosage: '', frequency: '', duration: '', instructions: '' }]);
  };

  const removeMedication = (index: number) => {
    if (prescriptionMeds.length <= 1) return;
    setPrescriptionMeds(prev => prev.filter((_, i) => i !== index));
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTimeRemaining = () => {
    if (!sessionStartTime.current) return '00:00';
    const elapsed = Date.now() - sessionStartTime.current;
    const remaining = Math.max(0, 30 * 60 * 1000 - elapsed);
    return formatTime(remaining);
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
  const formatTimeStr = (dateStr: string) => new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const button = (label: string, action: () => void, secondary = false) => (
    <TouchableOpacity accessibilityRole="button" disabled={busy}
      style={[styles.button, secondary && styles.secondary, busy && styles.disabled]} onPress={action}>
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
    </TouchableOpacity>
  );

  // Get availability for the session's doctor
  const availability = useMemo(() => {
    if (!session) return [];
    // In demo mode, show static availability
    return [
      { dayOfWeek: 1, startTime: '09:00', endTime: '13:00', isException: false },
      { dayOfWeek: 1, startTime: '14:00', endTime: '17:00', isException: false },
      { dayOfWeek: 2, startTime: '09:00', endTime: '13:00', isException: false },
      { dayOfWeek: 2, startTime: '14:00', endTime: '17:00', isException: false },
      { dayOfWeek: 3, startTime: '09:00', endTime: '13:00', isException: false },
      { dayOfWeek: 3, startTime: '14:00', endTime: '17:00', isException: false },
      { dayOfWeek: 4, startTime: '09:00', endTime: '13:00', isException: false },
      { dayOfWeek: 4, startTime: '14:00', endTime: '17:00', isException: false },
      { dayOfWeek: 5, startTime: '09:00', endTime: '13:00', isException: false },
      { dayOfWeek: 5, startTime: '14:00', endTime: '17:00', isException: false },
    ];
  }, [session]);

  const availabilityByDay = useMemo(() => {
    const byDay: Record<number, typeof availability> = {};
    availability.forEach(a => {
      if (!byDay[a.dayOfWeek]) byDay[a.dayOfWeek] = [];
      byDay[a.dayOfWeek].push(a);
    });
    return byDay;
  }, [availability]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{copy.title}</Text>
          {teleconsultClient.isDemo && <Text style={styles.notice}>{copy.demo}</Text>}
          <Text style={styles.notice}>{copy.roles}</Text>
        </View>

        {button(copy.retry, () => { if (!operation.current) void load(); }, true)}

        {!session ? (
          <Text style={styles.body}>{error ? copy.error : copy.loading}</Text>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.title}>{session.patientName}</Text>
              <Text style={styles.body}>{copy.doctor}: {session.doctorName}</Text>
              <Text style={styles.body}>{copy.scheduled}: {formatDate(session.scheduledTime)} {formatTimeStr(session.scheduledTime)}</Text>
              <Text style={styles.body}>{copy.status}: {copy.statuses[session.status]}</Text>
            </View>

            {session.status === 'REQUESTED' && (
              <>
                <Text style={styles.body}>{copy.waiting}</Text>
                {role === 'doctor' && (
                  <>
                    {button(copy.accept, () => void update('ACCEPTED'))}
                    {button(copy.decline, () => void update('DECLINED'), true)}
                  </>
                )}
              </>
            )}

            {['ACCEPTED', 'IN_PROGRESS'].includes(session.status) && (
              <>
                <Text style={styles.notice}>{copy.privacy}</Text>

                {/* Doctor Availability Calendar */}
                {role === 'doctor' && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{copy.availability}</Text>
                    <TouchableOpacity style={styles.toggleButton} onPress={() => setShowAvailability(!showAvailability)}>
                      <Text style={styles.toggleButtonText}>
                        {showAvailability ? 'Hide' : 'Show'} {copy.weeklySchedule}
                      </Text>
                    </TouchableOpacity>
                    {showAvailability && (
                      <View style={styles.availabilityGrid}>
                        {dayNames.map((day, idx) => {
                          const daySlots = availabilityByDay[idx];
                          return (
                            <View key={idx} style={styles.dayColumn}>
                              <Text style={styles.dayHeader}>{day}</Text>
                              {daySlots && daySlots.length > 0 ? (
                                daySlots.map((slot, si) => (
                                  <View key={si} style={styles.slot}>
                                    <Text style={styles.slotTime}>
                                      {slot.startTime} - {slot.endTime}
                                    </Text>
                                  </View>
                                ))
                              ) : (
                                <Text style={styles.noSlots}>Off</Text>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                {/* Meeting Link & Actions */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{copy.meetingLink}</Text>
                  <View style={styles.linkRow}>
                    <Text style={styles.linkText} selectable>{session.meetingLink}</Text>
                  </View>
                  <View style={styles.linkActions}>
                    <TouchableOpacity style={styles.actionButton} onPress={copyMeetingLink}>
                      <Text style={styles.actionButtonText}>{copySuccess ? copy.copied : copy.copyMeetingLink}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, styles.secondaryAction]} onPress={shareViaWhatsApp}>
                      <Text style={styles.actionButtonText}>{copy.shareViaWhatsApp}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.notice}>{copy.privacy}</Text>

                {!meetingOpen ? (
                  button(copy.join, () => {
                    meetingGeneration.current += 1;
                    joinedGeneration.current = null;
                    setMeetingOpen(true);
                  })
                ) : (
                  <>
                    <TeleconsultMeeting meetingLink={session.meetingLink} role={role} onJoined={onJoined} onLeft={onLeft} />
                    <Text style={styles.body}>{copy.externalHelp}</Text>
                    {!joined && button(copy.confirmJoined, () => void update('IN_PROGRESS', generation), true)}
                    {button(copy.leave, closeMeeting, true)}
                  </>
                )}

                {session.status === 'IN_PROGRESS' && (
                  <>
                    {/* Session Timer */}
                    <View style={styles.timerCard}>
                      <Text style={styles.timerLabel}>{copy.sessionTimer}</Text>
                      <Text style={styles.timerValue}>{formatTime(sessionTimer)}</Text>
                      <Text style={styles.timerRemaining}>{copy.timeRemaining}: {formatTimeRemaining()}</Text>
                      {button(copy.extendSession, extendSession, true)}
                    </View>

                    {/* Prescription Writing (Doctor only) */}
                    {role === 'doctor' && (
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{copy.prescription}</Text>
                        {session.prescription ? (
                          <View style={styles.prescriptionView}>
                            <Text style={styles.sectionTitle}>Current Prescription</Text>
                            {session.prescription.medications.map((med, i) => (
                              <View key={i} style={styles.medicationRow}>
                                <Text style={styles.medName}>{med.name}</Text>
                                <Text style={styles.medDetails}>
                                  {med.dosage} • {med.frequency} • {med.duration}
                                  {med.instructions && ` • ${med.instructions}`}
                                </Text>
                              </View>
                            ))}
                            {session.prescription.notes && (
                              <Text style={styles.medNotes}>Notes: {session.prescription.notes}</Text>
                            )}
                          </View>
                        ) : (
                          button(copy.writePrescription, () => setShowPrescriptionModal(true))
                        )}
                      </View>
                    )}
                  </>
                )}

                {session.status === 'IN_PROGRESS' && role === 'doctor' && (
                  <>
                    <Text style={styles.notice}>{copy.completeHelp}</Text>
                    {button(copy.complete, () => void update('COMPLETED'))}
                  </>
                )}

                {['REQUESTED', 'ACCEPTED'].includes(session.status) && button(copy.cancel, () => void update('CANCELLED'), true)}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
  <Modal visible={showAvailability} animationType="slide" transparent={true}>
    <View style={styles.modalOverlay} onTouchStart={() => setShowAvailability(false)}>
      <View style={styles.modalCard} onTouchStart={e => e.stopPropagation()}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{copy.availability}</Text>
          <TouchableOpacity style={styles.modalClose} onPress={() => setShowAvailability(false)}>
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.availabilityGrid}>
          {dayNames.map((day, idx) => {
            const daySlots = availabilityByDay[idx];
            return (
              <View key={idx} style={styles.dayColumn}>
                <Text style={styles.dayHeader}>{day}</Text>
                {daySlots && daySlots.length > 0 ? (
                  daySlots.map((slot, si) => (
                    <View key={si} style={styles.slot}>
                      <Text style={styles.slotTime}>
                        {slot.startTime} - {slot.endTime}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noSlots}>Off</Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  </Modal>

  {/* Prescription Modal */}
  <Modal visible={showPrescriptionModal} animationType="slide" transparent={true}>
    <View style={styles.modalOverlay} onTouchStart={() => setShowPrescriptionModal(false)}>
      <View style={[styles.modalCard, { maxHeight: '90%' }]} onTouchStart={e => e.stopPropagation()}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{copy.writePrescription}</Text>
          <TouchableOpacity style={styles.modalClose} onPress={() => setShowPrescriptionModal(false)}>
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.prescriptionContent}>
          {prescriptionMeds.map((med, idx) => (
            <View key={idx} style={styles.medicationForm}>
              <Text style={styles.medNumber}>Medication #{idx + 1}</Text>
              <TextInput
                style={styles.input}
                placeholder={copy.medicationName}
                value={med.name}
                onChangeText={v => setPrescriptionMeds(prev => prev.map((m, i) => i === idx ? { ...m, name: v } : m))}
              />
              <View style={styles.inputRow}>
                <TextInput style={styles.input} placeholder={copy.dosage} value={med.dosage}
                  onChangeText={v => setPrescriptionMeds(prev => prev.map((m, i) => i === idx ? { ...m, dosage: v } : m))} />
                <TextInput style={styles.input} placeholder={copy.frequency} value={med.frequency}
                  onChangeText={v => setPrescriptionMeds(prev => prev.map((m, i) => i === idx ? { ...m, frequency: v } : m))} />
              </View>
              <View style={styles.inputRow}>
                <TextInput style={styles.input} placeholder={copy.duration} value={med.duration}
                  onChangeText={v => setPrescriptionMeds(prev => prev.map((m, i) => i === idx ? { ...m, duration: v } : m))} />
              </View>
              <TextInput
                style={styles.input}
                placeholder={copy.instructions}
                value={med.instructions}
                onChangeText={v => setPrescriptionMeds(prev => prev.map((m, i) => i === idx ? { ...m, instructions: v } : m))}
              />
              {prescriptionMeds.length > 1 && (
                <TouchableOpacity style={styles.removeButton} onPress={() => removeMedication(idx)}>
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity style={styles.addButton} onPress={addMedication}>
            <Text style={styles.addButtonText}>+ {copy.addMedication}</Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={copy.instructions}
            value={prescriptionNotes}
            onChangeText={setPrescriptionNotes}
            multiline
          />
          <TouchableOpacity style={[styles.submitButton, savingPrescription && styles.disabled]} onPress={handleSavePrescription} disabled={savingPrescription}>
            <Text style={styles.submitButtonText}>{savingPrescription ? 'Saving...' : copy.savePrescription}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  </Modal>
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: theme.layout.screenPadding, paddingBottom: theme.layout.tabBarHeight + 24, gap: 16 },
  header: { gap: 8, marginBottom: 8 },
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
  section: { marginTop: 16, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  toggleButton: { backgroundColor: COLORS.primaryLight, padding: 12, borderRadius: 8, alignItems: 'center' },
  toggleButtonText: { color: COLORS.primary, fontWeight: '600' },
  availabilityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayColumn: { flex: 1, minWidth: 40, alignItems: 'center', gap: 4 },
  dayHeader: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  slot: { backgroundColor: COLORS.surface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border },
  slotTime: { fontSize: 11, color: COLORS.textPrimary, fontWeight: '500' },
  noSlots: { fontSize: 11, color: COLORS.textSecondary },
  linkRow: { backgroundColor: COLORS.surface, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  linkText: { fontSize: 13, fontFamily: 'monospace', color: COLORS.textPrimary },
  linkActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionButton: { flex: 1, backgroundColor: COLORS.primary, padding: 12, borderRadius: 8, alignItems: 'center' },
  secondaryAction: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.primary },
  actionButtonText: { color: COLORS.textOnPrimary, fontWeight: '600', fontSize: 13 },
  timerCard: { backgroundColor: '#FFF3E0', padding: 16, borderRadius: 12, gap: 8, borderLeftWidth: 4, borderLeftColor: COLORS.warning },
  timerLabel: { fontSize: 14, fontWeight: '600', color: '#E65100' },
  timerValue: { fontSize: 36, fontWeight: '800', color: '#E65100', fontFamily: 'monospace', textAlign: 'center' },
  timerRemaining: { fontSize: 14, color: '#BF360C', textAlign: 'center' },
  prescriptionView: { backgroundColor: '#E8F5E9', padding: 16, borderRadius: 12, gap: 12, borderLeftWidth: 4, borderLeftColor: COLORS.success },
  medicationRow: { backgroundColor: COLORS.surface, padding: 12, borderRadius: 8, marginBottom: 8 },
  medName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  medDetails: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  medNotes: { fontSize: 13, color: COLORS.textSecondary, fontStyle: 'italic', marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { fontSize: 18, color: COLORS.textSecondary, fontWeight: '700' },
  availabilityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, maxHeight: 300 },
  prescriptionContent: { gap: 16 },
  medicationForm: { backgroundColor: COLORS.background, padding: 16, borderRadius: 12, gap: 12, borderWidth: 1, borderColor: COLORS.border },
  medNumber: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, color: COLORS.textPrimary, fontSize: 14 },
  textArea: { minHeight: 80 },
  removeButton: { marginTop: 8, padding: 8, backgroundColor: '#FFEBEE', borderRadius: 8, alignItems: 'center' },
  removeButtonText: { color: COLORS.danger, fontWeight: '600' },
  addButton: { backgroundColor: COLORS.primaryLight, padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  addButtonText: { color: COLORS.primary, fontWeight: '600' },
  submitButton: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  submitButtonText: { color: COLORS.textOnPrimary, fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.5 },
});