import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { COLORS } from '@medisync/shared';
import { theme } from '../styles/theme';
import { useTranslation } from '../i18n';
import { configuredApiRequest } from '../services/teleconsultClient';
import { appointmentBookCopy as copy } from '../i18n/translations/appointmentBook';

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  facilityId: string;
}

export const AppointmentBookScreen: React.FC<{ navigation: any; route?: any }> = ({ navigation, route }) => {
  const { language } = useTranslation();
  const connected = !!process.env.EXPO_PUBLIC_API_URL?.trim();
  const facilityId = typeof route?.params?.facilityId === 'string' ? route.params.facilityId.trim() : '';
  const [patientId, setPatientId] = useState(typeof route?.params?.patientId === 'string' ? route.params.patientId : '');
  const [patientName, setPatientName] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [appointmentType, setAppointmentType] = useState('OUTPATIENT');
  const [priority, setPriority] = useState<'GREEN' | 'YELLOW' | 'RED'>('GREEN');
  const [showCalendar, setShowCalendar] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [doctorsError, setDoctorsError] = useState('');
  const [slotsError, setSlotsError] = useState('');
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [doctorRetry, setDoctorRetry] = useState(0);
  const [slotRetry, setSlotRetry] = useState(0);
  const [bookingId, setBookingId] = useState('');
  const [bookingUncertain, setBookingUncertain] = useState(false);
  const bookLock = useRef(false);
  const alive = useRef(false);
  const slotVersion = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDoctors([]);
    setSelectedDoctor('');
    setSelectedTime('');
    setAvailableSlots([]);
    setDoctorsError('');
    if (!connected) return;
    setDoctorsLoading(true);
    configuredApiRequest('/teleconsult/doctors').then(data => {
      if (!Array.isArray(data) || data.some(d => !d || typeof d.id !== 'string' || !d.id.trim() ||
          typeof d.name !== 'string' || !d.name.trim() || typeof d.facilityId !== 'string' || !d.facilityId.trim() ||
          typeof d.specialty !== 'string') || new Set(data.map(d => d.id)).size !== data.length) {
        throw new Error(copy.invalidDoctors);
      }
      if (!cancelled) setDoctors((data as Doctor[]).filter(d => !facilityId || d.facilityId === facilityId));
    }).catch(e => { if (!cancelled) setDoctorsError(e instanceof Error ? e.message : copy.invalidDoctors); })
      .finally(() => { if (!cancelled) setDoctorsLoading(false); });
    return () => { cancelled = true; };
  }, [connected, facilityId, doctorRetry]);

  useEffect(() => {
    const version = ++slotVersion.current;
    setSelectedTime('');
    setAvailableSlots([]);
    setSlotsError('');
    setSlotsLoading(false);
    const doctor = doctors.find(d => d.id === selectedDoctor);
    if (!connected || !doctor || !selectedDate) return;
    setSlotsLoading(true);
    loadAvailableSlots(doctor, selectedDate).then(slots => {
      if (version === slotVersion.current) setAvailableSlots(slots);
    }).catch(e => {
      if (version === slotVersion.current) setSlotsError(e instanceof Error ? e.message : copy.invalidSlots);
    }).finally(() => { if (version === slotVersion.current) setSlotsLoading(false); });
    return () => { slotVersion.current += 1; };
  }, [connected, selectedDate, selectedDoctor, doctors, slotRetry]);

  const loadAvailableSlots = async (doctor: Doctor, date: string): Promise<string[]> => {
    const data = await configuredApiRequest(`/appointments/slots/${encodeURIComponent(doctor.facilityId)}/${encodeURIComponent(date)}?doctorId=${encodeURIComponent(doctor.id)}`);
    const slots = (data as { slots?: unknown } | null)?.slots;
    if (!Array.isArray(slots) || slots.some(s => typeof s !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s))) {
      throw new Error(copy.invalidSlots);
    }
    return [...new Set(slots as string[])].filter(s => new Date(`${date}T${s}:00`).getTime() > Date.now()).sort();
  };

  const handleBook = async () => {
    if (bookLock.current || bookingId || bookingUncertain) return;
    if (!connected) { setError(copy.notConnected); return; }
    const doctor = doctors.find(d => d.id === selectedDoctor);
    if (!patientId.trim() || !patientName.trim() || !doctor || !selectedDate || !selectedTime) {
      setError(copy.fillAllFields);
      return;
    }
    if (slotsLoading || slotsError || !availableSlots.includes(selectedTime) || new Date(`${selectedDate}T${selectedTime}:00`).getTime() <= Date.now()) {
      setError(copy.selectFuture); return;
    }
    bookLock.current = true;
    setLoading(true);
    setError('');
    let submitted = false;
    try {
      const slots = await loadAvailableSlots(doctor, selectedDate);
      if (!alive.current) return;
      if (!slots.includes(selectedTime)) {
        setAvailableSlots(slots); setSelectedTime(''); throw new Error(copy.selectFuture);
      }
      // The current API compares facility-local date/time strings when excluding booked slots.
      const body = { patientId: patientId.trim(), patientName: patientName.trim(), facilityId: doctor.facilityId,
        doctorId: doctor.id, dateTime: `${selectedDate}T${selectedTime}:00`, type: appointmentType, priority };
      submitted = true;
      const result = await configuredApiRequest('/appointments', 'POST', body);
      const booking = result as Record<string, unknown> | null;
      if (!booking || typeof booking.id !== 'string' || !booking.id.trim() || booking.status !== 'BOOKED' ||
          Object.entries(body).some(([key, value]) => booking[key] !== value)) throw new Error(copy.bookingUnconfirmed);
      if (alive.current) setBookingId(booking.id);
    } catch (e) {
      if (alive.current) {
        setBookingUncertain(submitted);
        setError(submitted ? copy.bookingUnconfirmed : e instanceof Error ? e.message : copy.bookingFailed);
      }
    } finally {
      bookLock.current = false;
      if (alive.current) setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(`${dateStr}T12:00:00`);
    return date.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
  };

  const next14Days = Array.from({ length: 14 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + i);
      return {
        date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        dayName: date.toLocaleDateString('en-IN', { weekday: 'short' }),
        dayNum: date.getDate(),
        month: date.toLocaleDateString('en-IN', { month: 'short' }),
        isToday: i === 0,
        isTomorrow: i === 1,
      };
  });

  const handleDateSelect = (date: string) => {
    if (date === selectedDate) { setShowCalendar(false); return; }
    setSelectedDate(date);
    slotVersion.current += 1;
    setAvailableSlots([]);
    setShowCalendar(false);
    setSelectedTime('');
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const handlePrioritySelect = (p: 'GREEN' | 'YELLOW' | 'RED') => {
    setPriority(p);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{copy.title}</Text>
          <Text style={styles.headerSubtitle}>{copy.subtitle}</Text>
          {language !== 'en' && <Text style={styles.headerSubtitle}>{copy.languageGap}</Text>}
          <Text style={styles.headerSubtitle}>{connected ? copy.backendNotice : copy.notConnected}</Text>
          <Text style={styles.headerSubtitle}>{copy.timezoneNotice}</Text>
        </View>

        {/* Priority Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{copy.priority}</Text>
          <Text style={styles.headerSubtitle}>{copy.emergencyNotice}</Text>
          <View style={styles.priorityRow}>
            {(['GREEN', 'YELLOW', 'RED'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                disabled={loading || !!bookingId || bookingUncertain}
                style={[
                  styles.priorityButton,
                  priority === p && styles.priorityButtonActive,
                  { borderColor: p === 'RED' ? COLORS.danger : p === 'YELLOW' ? COLORS.warning : COLORS.success },
                ]}
                onPress={() => handlePrioritySelect(p)}
              >
                <View style={[
                  styles.priorityIndicator,
                  { backgroundColor: p === 'RED' ? COLORS.danger : p === 'YELLOW' ? COLORS.warning : COLORS.success },
                ]} />
                <Text style={[
                  styles.priorityButtonText,
                  priority === p && styles.priorityButtonTextActive,
                ]}>
                  {{ GREEN: copy.green, YELLOW: copy.yellow, RED: copy.red }[p]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>{copy.patientId}</Text>
          <TextInput style={styles.input} value={patientId} onChangeText={setPatientId}
            autoCapitalize="none" placeholder={copy.patientIdPlaceholder} editable={!loading && !bookingId && !bookingUncertain} />
          <Text style={styles.label}>{copy.patientName}</Text>
          <TextInput
            style={styles.input}
            value={patientName}
            editable={!loading && !bookingId && !bookingUncertain}
            onChangeText={setPatientName}
            placeholder={copy.patientNamePlaceholder}
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={styles.label}>{copy.appointmentType}</Text>
          <View style={styles.typeRow}>
            {(['OUTPATIENT', 'TELECONSULT', 'DIAGNOSTIC'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                disabled={loading || !!bookingId || bookingUncertain}
                style={[styles.typeButton, appointmentType === type && styles.typeButtonActive]}
                onPress={() => setAppointmentType(type)}
              >
                <Text style={[
                  styles.typeText,
                  appointmentType === type && styles.typeTextActive,
                ]}>
                  {{ OUTPATIENT: copy.outpatient, TELECONSULT: copy.teleconsult, DIAGNOSTIC: copy.diagnostic }[type]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>{copy.selectDoctor}</Text>
          <View style={styles.doctorList}>
            {doctors.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                style={[
                  styles.doctorCard,
                  selectedDoctor === doc.id && styles.doctorCardActive,
                ]}
                disabled={loading || !!bookingId || bookingUncertain}
                onPress={() => { if (doc.id === selectedDoctor) return; slotVersion.current += 1; setSelectedDoctor(doc.id); setSelectedTime(''); setAvailableSlots([]); }}
              >
                <Text style={styles.doctorName}>{doc.name}</Text>
                <Text style={styles.doctorSpecialty}>{doc.specialty}</Text>
                <Text style={styles.doctorSpecialty}>{doc.facilityId}</Text>
              </TouchableOpacity>
            ))}
            {doctorsLoading && <Text style={styles.noDoctors}>{copy.loadingDoctors}</Text>}
            {!!doctorsError && <Text accessibilityRole="alert" style={styles.errorText}>{doctorsError}</Text>}
            {connected && !doctorsLoading && <TouchableOpacity onPress={() => setDoctorRetry(n => n + 1)} disabled={loading || !!bookingId || bookingUncertain}><Text style={styles.label}>{copy.retry}</Text></TouchableOpacity>}
            {connected && !doctorsLoading && !doctorsError && doctors.length === 0 && <Text style={styles.noDoctors}>{copy.noDoctorsAvailable}</Text>}
          </View>

          {/* Calendar View */}
          <Text style={styles.label}>{copy.selectDate}</Text>
          <TouchableOpacity disabled={loading || !!bookingId || bookingUncertain} style={styles.dateButton} onPress={() => setShowCalendar(true)}>
            <Text style={[
              styles.dateButtonText,
              !!selectedDate && styles.dateButtonTextSelected,
            ]}>
              {selectedDate ? formatDate(selectedDate) : copy.selectDatePlaceholder}
            </Text>
          </TouchableOpacity>

{showCalendar && (
            <Modal
              visible={showCalendar}
              animationType="slide"
              transparent={true}
              onRequestClose={() => setShowCalendar(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalCard}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{copy.calendarTitle}</Text>
                    <TouchableOpacity style={styles.modalClose} onPress={() => setShowCalendar(false)}>
                      <Text style={styles.modalCloseText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView contentContainerStyle={styles.calendarGrid}>
                    {next14Days.map((day) => (
                      <TouchableOpacity
                        key={day.date}
                        style={[
                          styles.dayCell,
                          day.isToday && styles.dayCellToday,
                          day.isTomorrow && styles.dayCellTomorrow,
                          selectedDate === day.date && styles.dayCellSelected,
                        ]}
                        onPress={() => handleDateSelect(day.date)}
                      >
                        <Text style={[
                          styles.dayName,
                          day.isToday && styles.dayNameToday,
                          selectedDate === day.date && styles.dayNameSelected,
                        ]}>
                          {day.dayName}
                        </Text>
                        <Text style={[
                          styles.dayNum,
                          day.isToday && styles.dayNumToday,
                          selectedDate === day.date && styles.dayNumSelected,
                        ]}>
                          {day.dayNum}
                        </Text>
                        <Text style={[
                          styles.dayMonth,
                          selectedDate === day.date && styles.dayMonthSelected,
                        ]}>
                          {day.month}
                        </Text>
                        {day.isToday && <Text style={styles.todayBadge}>{copy.today}</Text>}
                        {day.isTomorrow && <Text style={styles.tomorrowBadge}>{copy.tomorrow}</Text>}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </Modal>
          )}

          <Text style={styles.label}>{copy.selectTime}</Text>
          <View style={styles.timeGrid}>
            {availableSlots.map((slot) => (
              <TouchableOpacity
                key={slot}
                disabled={loading || slotsLoading || !!bookingId || bookingUncertain}
                style={[
                  styles.timeSlot,
                  selectedTime === slot && styles.timeSlotActive,
                ]}
                onPress={() => handleTimeSelect(slot)}
              >
                <Text style={[
                  styles.timeText,
                  selectedTime === slot && styles.timeTextActive,
                ]}>
                  {slot}
                </Text>
              </TouchableOpacity>
            ))}
            {slotsLoading && <Text style={styles.noSlots}>{copy.loadingSlots}</Text>}
            {!!slotsError && <Text accessibilityRole="alert" style={styles.errorText}>{slotsError}</Text>}
            {connected && selectedDate && selectedDoctor && !slotsLoading && <TouchableOpacity onPress={() => setSlotRetry(n => n + 1)} disabled={loading || !!bookingId || bookingUncertain}><Text style={styles.label}>{copy.retry}</Text></TouchableOpacity>}
            {(!selectedDate || !selectedDoctor) && <Text style={styles.noSlots}>{copy.chooseDoctorDate}</Text>}
            {connected && !slotsLoading && !slotsError && availableSlots.length === 0 && !!selectedDate && !!selectedDoctor && (
              <Text style={styles.noSlots}>{copy.noSlotsAvailable}</Text>
            )}
          </View>

          {!!error && <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>}
          {!!bookingId && <View style={styles.section}>
            <Text style={styles.label}>{copy.bookingConfirmed}</Text>
            <Text selectable style={styles.label}>{copy.bookingReference} {bookingId}</Text>
            <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.label}>{copy.ok}</Text></TouchableOpacity>
          </View>}

          <TouchableOpacity style={[styles.bookButton, (!connected || loading || slotsLoading || !!bookingId || bookingUncertain) && styles.disabled]} onPress={handleBook}
            disabled={!connected || loading || slotsLoading || !!bookingId || bookingUncertain}>
            <Text style={styles.bookButtonText}>
              {loading ? copy.booking : copy.bookAppointment}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: theme.layout.tabBarHeight + theme.spacing.lg, gap: theme.spacing.lg },
  header: { gap: theme.spacing.xs, paddingTop: theme.spacing.md },
  headerTitle: { fontSize: theme.typography.fontSize['2xl'], fontWeight: theme.typography.fontWeight.bold, color: COLORS.textPrimary },
  headerSubtitle: { fontSize: theme.typography.fontSize.md, color: COLORS.textSecondary },
  section: { gap: theme.spacing.md },
  sectionTitle: { fontSize: theme.typography.fontSize.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: theme.spacing.sm },
  priorityRow: { flexDirection: 'row', gap: theme.spacing.sm },
  priorityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  priorityButtonActive: { backgroundColor: COLORS.primaryLight },
  priorityIndicator: { width: 12, height: 12, borderRadius: 6 },
  priorityButtonText: { fontSize: theme.typography.fontSize.sm, fontWeight: '600', color: COLORS.textPrimary },
  priorityButtonTextActive: { color: COLORS.primary },
  form: { gap: theme.spacing.md },
  label: { fontSize: theme.typography.fontSize.sm, fontWeight: '600', color: COLORS.textPrimary },
  input: { backgroundColor: COLORS.surface, borderRadius: theme.borderRadius.sm, padding: theme.spacing.md, fontSize: theme.typography.fontSize.md, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  typeRow: { flexDirection: 'row', gap: theme.spacing.sm },
  typeButton: { flex: 1, paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderRadius: theme.borderRadius.sm, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  typeButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeText: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary },
  typeTextActive: { color: COLORS.textOnPrimary, fontWeight: '600' },
  doctorList: { gap: theme.spacing.sm },
  doctorCard: { backgroundColor: COLORS.surface, borderRadius: theme.borderRadius.sm, padding: theme.spacing.md, borderWidth: 1, borderColor: COLORS.border },
  doctorCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  doctorName: { fontSize: theme.typography.fontSize.md, fontWeight: '600', color: COLORS.textPrimary },
  doctorSpecialty: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary },
  dateButton: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: theme.borderRadius.md, padding: theme.spacing.md },
  dateButtonText: { color: COLORS.textSecondary },
  dateButtonTextSelected: { color: COLORS.primary, fontWeight: '600' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  timeSlot: { paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderRadius: theme.borderRadius.sm, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  timeSlotActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  timeText: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary },
  timeTextActive: { color: COLORS.textOnPrimary, fontWeight: '600' },
  noSlots: { color: COLORS.textSecondary, textAlign: 'center', marginTop: theme.spacing.md },
  bookButton: { backgroundColor: COLORS.primary, borderRadius: theme.borderRadius.md, paddingVertical: theme.spacing.lg, alignItems: 'center', marginTop: theme.spacing.lg },
  bookButtonText: { color: COLORS.textOnPrimary, fontSize: theme.typography.fontSize.lg, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: theme.spacing.md },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: theme.borderRadius.xl, padding: theme.spacing.lg, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg },
  modalTitle: { fontSize: theme.typography.fontSize.xl, fontWeight: '700', color: COLORS.textPrimary },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { fontSize: 18, color: COLORS.textSecondary, fontWeight: '700' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  dayCell: { width: 60, height: 80, backgroundColor: COLORS.surface, borderRadius: 12, padding: 8, alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderColor: COLORS.border },
  dayCellToday: { borderColor: COLORS.primary, borderWidth: 2, backgroundColor: COLORS.primaryLight },
  dayCellTomorrow: { borderColor: COLORS.info, borderWidth: 2 },
  dayCellSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayName: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  dayNameToday: { color: COLORS.primary },
  dayNameSelected: { color: COLORS.textOnPrimary },
  dayNum: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  dayNumToday: { color: COLORS.primary },
  dayNumSelected: { color: COLORS.textOnPrimary },
  dayMonth: { fontSize: 10, color: COLORS.textSecondary },
  dayMonthSelected: { color: 'rgba(255,255,255,0.7)' },
  todayBadge: { fontSize: 8, fontWeight: '700', color: COLORS.primary, backgroundColor: COLORS.primaryLight, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  tomorrowBadge: { fontSize: 8, fontWeight: '700', color: COLORS.info, backgroundColor: '#E3F2FD', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  noDoctors: { color: COLORS.textSecondary, textAlign: 'center', padding: 20 },
  errorText: { color: COLORS.danger, fontSize: 13, marginTop: 8 },
});
