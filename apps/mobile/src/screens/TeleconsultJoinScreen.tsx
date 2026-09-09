import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity, Modal, TextInput, Platform, Clipboard } from 'react-native';
import { COLORS } from '@medisync/shared';
import { theme } from '../styles/theme';
import { teleconsultClient, TeleconsultRole, TeleconsultSession, TeleconsultStatus, DoctorAvailability, PrescriptionMedication } from '../services/teleconsultClient';
import { TeleconsultMeeting } from '../components/TeleconsultMeeting';
import { teleconsultCopy as copy } from '../i18n/translations/teleconsult';
import { useTranslation } from '../i18n';
import { isDemoActive, onDemoModeChange } from '../services/demoMode';

export const TeleconsultJoinScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { language } = useTranslation();
  const [isDemo, setIsDemo] = useState(isDemoActive);
  const sessionId = typeof route.params?.sessionId === 'string' ? route.params.sessionId : '';
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
  const [targetMinutes, setTargetMinutes] = useState(30);
  const [message, setMessage] = useState('');
  const [prescriptionError, setPrescriptionError] = useState('');
  const [availability, setAvailability] = useState<DoctorAvailability[]>([]);
  const [availabilityError, setAvailabilityError] = useState('');
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const alive = useRef(false);
  const operation = useRef(false);
  const loadVersion = useRef(0);
  const modeVersion = useRef(0);
  const meetingGeneration = useRef(0);
  const joinedGeneration = useRef<number | null>(null);
  const prescriptionLock = useRef(false);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const extendSession = () => setTargetMinutes(minutes => minutes + 5);

  useEffect(() => {
    const start = session?.startedAt ? Date.parse(session.startedAt) : NaN;
    if (!Number.isFinite(start)) { setSessionTimer(0); return; }
    const tick = () => setSessionTimer(Math.max(0, Date.now() - start));
    tick();
    if (session?.status !== 'IN_PROGRESS') return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session?.startedAt, session?.status]);

  useEffect(() => {
    if (!showAvailability) return;
    const currentMode = modeVersion.current;
    let cancelled = false;
    setAvailability([]);
    setAvailabilityError('');
    setAvailabilityLoading(false);
    const doctorId = session?.doctorId || (isDemo ? 'demo-clinician' : '');
    if (!doctorId) { setAvailabilityError(copy.availabilityMissing); return; }
    setAvailabilityLoading(true);
    teleconsultClient.getDoctorAvailability(doctorId).then(data => {
      if (!cancelled && currentMode === modeVersion.current) setAvailability(data);
    }).catch(e => {
      if (!cancelled && currentMode === modeVersion.current) setAvailabilityError(e instanceof Error ? e.message : copy.error);
    }).finally(() => { if (!cancelled && currentMode === modeVersion.current) setAvailabilityLoading(false); });
    return () => { cancelled = true; };
  }, [showAvailability, session?.doctorId, isDemo]);

  useEffect(() => {
    alive.current = true;
    const reset = () => {
      modeVersion.current += 1;
      loadVersion.current += 1;
      operation.current = false;
      prescriptionLock.current = false;
      setIsDemo(isDemoActive());
      setBusy(false);
      setSavingPrescription(false);
      setSession(null);
      setRole('patient');
      setError('');
      setMessage('');
      setCopySuccess(false);
      setTargetMinutes(30);
      setSessionTimer(0);
      setShowAvailability(false);
      setAvailability([]);
      setAvailabilityError('');
      setAvailabilityLoading(false);
      setShowPrescriptionModal(false);
      setPrescriptionError('');
      setPrescriptionMeds([{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }]);
      setPrescriptionNotes('');
      closeMeeting();
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
      void load();
    };
    reset();
    const unsubscribeMode = onDemoModeChange(reset);
    const interval = setInterval(() => { if (!operation.current && !prescriptionLock.current) void load(); }, 10000);
    const unsubscribe = navigation.addListener?.('blur', closeMeeting);
    return () => {
      alive.current = false;
      modeVersion.current += 1;
      loadVersion.current += 1;
      meetingGeneration.current += 1;
      clearInterval(interval);
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
      unsubscribe?.();
      unsubscribeMode();
    };
  }, [sessionId]);

  const update = async (status: TeleconsultStatus, generation?: number) => {
    if (operation.current || prescriptionLock.current || !alive.current) return;
    operation.current = true;
    const currentMode = modeVersion.current;
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
      if (status === 'IN_PROGRESS' && generation === meetingGeneration.current) {
        setJoined(true);
      }
      if (['COMPLETED', 'CANCELLED', 'DECLINED'].includes(status)) {
        closeMeeting();
      }
    } catch (e) {
      if (alive.current && version === loadVersion.current) {
        setError(e instanceof Error ? e.message : copy.error);
        if (generation === meetingGeneration.current) joinedGeneration.current = null;
      }
    } finally {
      if (currentMode === modeVersion.current) {
        operation.current = false;
        if (alive.current) setBusy(false);
      }
    }
  };

  const generation = meetingGeneration.current;
  const onJoined = () => {
    if (!alive.current || !meetingOpen || generation !== meetingGeneration.current ||
        joinedGeneration.current === generation || operation.current || prescriptionLock.current) return;
    joinedGeneration.current = generation;
    void update('IN_PROGRESS', generation);
  };
  const onLeft = () => {
    if (!alive.current || generation !== meetingGeneration.current) return;
    joinedGeneration.current = null;
    setJoined(false);
  };

  const copyMeetingLink = async () => {
    if (!session?.meetingLink) return;
    const currentMode = modeVersion.current;
    try {
      if (Platform.OS === 'web') {
        if (!globalThis.navigator?.clipboard?.writeText) throw new Error(copy.manualCopy);
        await globalThis.navigator.clipboard.writeText(session.meetingLink);
      } else {
        Clipboard.setString(session.meetingLink);
      }
      if (!alive.current || currentMode !== modeVersion.current) return;
      setCopySuccess(true);
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
      copyTimeout.current = setTimeout(() => setCopySuccess(false), 2000);
    } catch (e) {
      if (alive.current && currentMode === modeVersion.current) setMessage(copy.manualCopy);
    }
  };

  const shareViaWhatsApp = async () => {
    if (!session?.meetingLink) return;
    const currentMode = modeVersion.current;
    const message = `Join my MediSync teleconsultation: ${session.meetingLink}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    try {
      const { Linking } = await import('react-native');
      if (!alive.current || currentMode !== modeVersion.current) return;
      await Linking.openURL(url);
    } catch (e) {
      if (alive.current && currentMode === modeVersion.current) setError(copy.shareFailed);
    }
  };

  const handleSavePrescription = async () => {
    if (prescriptionLock.current || operation.current || !alive.current) return;
    if (!session || role !== 'doctor' || session.status !== 'IN_PROGRESS' || session.prescription) {
      setPrescriptionError(copy.prescriptionUnavailable); return;
    }
    const patientId = session.patientId || (isDemo ? 'demo-patient' : '');
    const doctorId = session.doctorId || (isDemo ? 'demo-clinician' : '');
    if (!patientId || !doctorId) { setPrescriptionError(copy.missingParticipants); return; }
    if (!prescriptionMeds.length || prescriptionMeds.some(m => !m.name.trim() || !m.dosage.trim() || !m.frequency.trim() || !m.duration.trim())) {
      setPrescriptionError(copy.requiredMedication);
      return;
    }
    prescriptionLock.current = true;
    const currentMode = modeVersion.current;
    const version = ++loadVersion.current;
    setPrescriptionError('');
    setSavingPrescription(true);
    try {
      const prescription = await teleconsultClient.createPrescription({
        sessionId: session.id,
        patientId, doctorId,
        medications: prescriptionMeds.map(m => ({ name: m.name.trim(), dosage: m.dosage.trim(), frequency: m.frequency.trim(), duration: m.duration.trim(), instructions: m.instructions?.trim() })),
        notes: prescriptionNotes.trim(),
      });
      if (!alive.current || version !== loadVersion.current) return;
      setSession(current => current ? { ...current, patientId, doctorId, prescription } : current);
      setMessage(isDemo ? copy.prescriptionSaved : copy.prescriptionSavedRemote);
      setShowPrescriptionModal(false);
    } catch (e) {
      if (alive.current && version === loadVersion.current) setPrescriptionError(e instanceof Error ? e.message : copy.error);
    } finally {
      if (currentMode === modeVersion.current) {
        prescriptionLock.current = false;
        if (alive.current) setSavingPrescription(false);
      }
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
    const remaining = Math.max(0, targetMinutes * 60 * 1000 - sessionTimer);
    return formatTime(remaining);
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
  const formatTimeStr = (dateStr: string) => new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const button = (label: string, action: () => void, secondary = false) => (
    <TouchableOpacity accessibilityRole="button" disabled={busy || savingPrescription}
      style={[styles.button, secondary && styles.secondary, (busy || savingPrescription) && styles.disabled]} onPress={action}>
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
    </TouchableOpacity>
  );

  const availabilityByDay: Record<number, DoctorAvailability[]> = {};
  availability.filter(a => !a.isException).forEach(a => {
    (availabilityByDay[a.dayOfWeek] ||= []).push(a);
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{copy.title}</Text>
          {isDemo && <Text style={styles.notice}>{copy.demo}</Text>}
          {!isDemo && <Text style={styles.notice}>{copy.backendNotice}</Text>}
          {language !== 'en' && <Text style={styles.notice}>{copy.languageGap}</Text>}
          <Text style={styles.notice}>{copy.roles}</Text>
          <View style={styles.row}>
            {(['patient', 'doctor'] as const).map(value => (
              <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: role === value }}
                disabled={busy || savingPrescription || meetingOpen} style={[styles.role, role === value && styles.selected]}
                onPress={() => setRole(value)}><Text>{copy[value]}</Text></TouchableOpacity>
            ))}
          </View>
        </View>

        {button(copy.retry, () => { if (!operation.current && !prescriptionLock.current) void load(); }, true)}
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {!!message && <Text style={styles.notice}>{message}</Text>}

        {!session ? (
          <Text style={styles.body}>{error ? copy.error : copy.loading}</Text>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.title}>{session.patientName}</Text>
              <Text style={styles.body}>{copy.doctor}: {session.doctorName}</Text>
              <Text style={styles.body}>{copy.scheduled}: {formatDate(session.scheduledTime)} {formatTimeStr(session.scheduledTime)}</Text>
              <Text style={styles.body}>{copy.status}: {copy.statuses[session.status]}</Text>
              {session.prescription && <View style={styles.prescriptionView}>
                <Text style={styles.sectionTitle}>{copy.currentPrescription}</Text>
                <Text style={styles.notice}>{copy.prescriptionNotice}</Text>
                {session.prescription.medications.map((med, i) => <View key={i} style={styles.medicationRow}>
                  <Text style={styles.medName}>{med.name}</Text>
                  <Text style={styles.medDetails}>{med.dosage} / {med.frequency} / {med.duration}</Text>
                  {!!med.instructions && <Text style={styles.medDetails}>{med.instructions}</Text>}
                </View>)}
                {!!session.prescription.notes && <Text style={styles.medNotes}>{session.prescription.notes}</Text>}
              </View>}
            </View>

            {['REQUESTED', 'ACCEPTED'].includes(session.status) && button(copy.cancel, () => void update('CANCELLED'), true)}

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
                        {copy.show} {copy.weeklySchedule}
                      </Text>
                    </TouchableOpacity>
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
                      <Text style={[styles.actionButtonText, styles.secondaryText]}>{copy.shareViaWhatsApp}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

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
                      <Text style={styles.notice}>{copy.timerNotice}</Text>
                      {session.startedAt ? <>
                        <Text style={styles.timerValue}>{formatTime(sessionTimer)}</Text>
                        <Text style={styles.timerRemaining}>{copy.timeRemaining}: {formatTimeRemaining()}</Text>
                        {button(copy.extendSession, extendSession, true)}
                      </> : <Text style={styles.body}>{copy.timerUnknown}</Text>}
                    </View>

                    {/* Prescription Writing (Doctor only) */}
                    {role === 'doctor' && !session.prescription && (
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{copy.prescription}</Text>
                        <Text style={styles.notice}>{copy.prescriptionNotice}</Text>
                        {!isDemo && (!session.patientId || !session.doctorId)
                          ? <Text style={styles.error}>{copy.missingParticipants}</Text>
                          : button(copy.writePrescription, () => setShowPrescriptionModal(true))}
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

              </>
            )}
          </>
        )}
      </ScrollView>
  <Modal visible={showAvailability} animationType="slide" transparent={true} onRequestClose={() => setShowAvailability(false)}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalCard}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{copy.availability}</Text>
          <TouchableOpacity style={styles.modalClose} onPress={() => setShowAvailability(false)}>
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView>
          {isDemo && <Text style={styles.notice}>{copy.availabilityDemo}</Text>}
          {availabilityLoading && <Text style={styles.body}>{copy.loading}</Text>}
          {!!availabilityError && <Text accessibilityRole="alert" style={styles.error}>{availabilityError}</Text>}
          {!availabilityLoading && !availabilityError && !availability.length && <Text>{copy.availabilityEmpty}</Text>}
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
                  <Text style={styles.noSlots}>-</Text>
                )}
              </View>
            );
          })}
          </View>
          {availability.filter(a => a.isException).map((slot, index) => <Text key={index} style={styles.body}>
            {copy.exceptionDates}: {slot.exceptionDate} {slot.startTime} - {slot.endTime}
          </Text>)}
        </ScrollView>
      </View>
    </View>
  </Modal>

  {/* Prescription Modal */}
  <Modal visible={showPrescriptionModal} animationType="slide" transparent={true} onRequestClose={() => { if (!savingPrescription) setShowPrescriptionModal(false); }}>
    <View style={styles.modalOverlay}>
      <View style={[styles.modalCard, { maxHeight: '90%' }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{copy.writePrescription}</Text>
          <TouchableOpacity disabled={savingPrescription} style={styles.modalClose} onPress={() => setShowPrescriptionModal(false)}>
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.prescriptionContent}>
          <Text style={styles.notice}>{copy.prescriptionNotice}</Text>
          {!!prescriptionError && <Text accessibilityRole="alert" style={styles.error}>{prescriptionError}</Text>}
          {prescriptionMeds.map((med, idx) => (
            <View key={idx} style={styles.medicationForm}>
              <Text style={styles.medNumber}>{copy.medication} #{idx + 1}</Text>
              <TextInput
                style={styles.input}
                editable={!savingPrescription}
                placeholder={copy.medicationName}
                value={med.name}
                onChangeText={v => setPrescriptionMeds(prev => prev.map((m, i) => i === idx ? { ...m, name: v } : m))}
              />
              <View style={styles.inputRow}>
                <TextInput editable={!savingPrescription} style={styles.input} placeholder={copy.dosage} value={med.dosage}
                  onChangeText={v => setPrescriptionMeds(prev => prev.map((m, i) => i === idx ? { ...m, dosage: v } : m))} />
                <TextInput editable={!savingPrescription} style={styles.input} placeholder={copy.frequency} value={med.frequency}
                  onChangeText={v => setPrescriptionMeds(prev => prev.map((m, i) => i === idx ? { ...m, frequency: v } : m))} />
              </View>
              <View style={styles.inputRow}>
                <TextInput editable={!savingPrescription} style={styles.input} placeholder={copy.duration} value={med.duration}
                  onChangeText={v => setPrescriptionMeds(prev => prev.map((m, i) => i === idx ? { ...m, duration: v } : m))} />
              </View>
              <TextInput
                style={styles.input}
                placeholder={copy.instructions}
                editable={!savingPrescription}
                value={med.instructions}
                onChangeText={v => setPrescriptionMeds(prev => prev.map((m, i) => i === idx ? { ...m, instructions: v } : m))}
              />
              {prescriptionMeds.length > 1 && (
                <TouchableOpacity disabled={savingPrescription} style={styles.removeButton} onPress={() => removeMedication(idx)}>
                  <Text style={styles.removeButtonText}>{copy.remove}</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity disabled={savingPrescription} style={styles.addButton} onPress={addMedication}>
            <Text style={styles.addButtonText}>+ {copy.addMedication}</Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={copy.notes}
            editable={!savingPrescription}
            value={prescriptionNotes}
            onChangeText={setPrescriptionNotes}
            maxLength={500}
            multiline
          />
          <TouchableOpacity style={[styles.submitButton, savingPrescription && styles.disabled]} onPress={handleSavePrescription} disabled={savingPrescription}>
            <Text style={styles.submitButtonText}>{savingPrescription ? copy.saving : copy.savePrescription}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  </Modal>
    </SafeAreaView>
  );
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
  dayColumn: { minWidth: 110, alignItems: 'center', gap: 4 },
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
  prescriptionContent: { gap: 16 },
  medicationForm: { backgroundColor: COLORS.background, padding: 16, borderRadius: 12, gap: 12, borderWidth: 1, borderColor: COLORS.border },
  medNumber: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  inputRow: { gap: 8 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, color: COLORS.textPrimary, fontSize: 14 },
  textArea: { minHeight: 80 },
  removeButton: { marginTop: 8, padding: 8, backgroundColor: '#FFEBEE', borderRadius: 8, alignItems: 'center' },
  removeButtonText: { color: COLORS.danger, fontWeight: '600' },
  addButton: { backgroundColor: COLORS.primaryLight, padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  addButtonText: { color: COLORS.primary, fontWeight: '600' },
  submitButton: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  submitButtonText: { color: COLORS.textOnPrimary, fontWeight: '700', fontSize: 16 },
});
