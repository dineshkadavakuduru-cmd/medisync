import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { COLORS } from '@medisync/shared';
import { theme } from '../styles/theme';
import { useTranslation } from '../i18n';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { appointmentBookCopy as copy } from '../i18n/translations/appointmentBook';

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  facilityId: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
  doctorId: string;
}

interface DaySchedule {
  date: string;
  dayName: string;
  slots: TimeSlot[];
}

export const AppointmentBookScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { t } = useTranslation();
  const [patientName, setPatientName] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [appointmentType, setAppointmentType] = useState('OUTPATIENT');
  const [priority, setPriority] = useState<'GREEN' | 'YELLOW' | 'RED'>('GREEN');
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDateForSlots, setSelectedDateForSlots] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: doctorsData, refetch: refetchDoctors } = useApi(() => api.getFacilities?.() || Promise.resolve({ success: true, data: [] }));

  useEffect(() => {
    if (doctorsData?.success && doctorsData.data) {
      const facilityDoctors = doctorsData.data
        .filter((f: any) => f.specialists && f.specialists.length > 0)
        .flatMap((f: any) => f.specialists.map((spec: string, idx: number) => ({
          id: `doc-${f.id}-${idx}`,
          name: `Dr. ${spec}`,
          specialty: spec,
          facilityId: f.id,
        })));
      setDoctors(facilityDoctors);
    }
  }, [doctorsData]);

  useEffect(() => {
    if (selectedDateForSlots && selectedDoctor) {
      loadAvailableSlots(selectedDoctor, selectedDateForSlots);
    }
  }, [selectedDateForSlots, selectedDoctor]);

  const loadAvailableSlots = async (doctorId: string, date: string) => {
    try {
      // In real app, call API
      // const res = await api.getAppointmentSlots(doctorId, date);
      // For demo, generate mock slots
      const baseSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
      const booked = ['10:00', '11:00', '14:00']; // Mock booked slots
      const slots = baseSlots
        .filter(s => !booked.includes(s))
        .map(time => ({ time, available: true, doctorId }));
      setAvailableSlots(slots.map(s => s.time));
    } catch (e) {
      console.error(e);
    }
  };

  const handleBook = async () => {
    if (!patientName || !selectedDoctor || !selectedDate || !selectedTime) {
      Alert.alert(copy.error, copy.fillAllFields);
      return;
    }

    setLoading(true);
    setError('');

    const dateTime = new Date(`${selectedDate}T${selectedTime}:00`);
    try {
      // In real app, call API
      // await api.createAppointment({ ... });
      
      Alert.alert(copy.success, copy.bookingConfirmed, [
        { text: copy.ok, onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      setError(copy.bookingFailed);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
  };

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const next7Days = useMemo(() => {
    const days = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date(Date.now() + i * 86400000);
      days.push({
        date: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString('en-IN', { weekday: 'short' }),
        dayNum: date.getDate(),
        month: date.toLocaleDateString('en-IN', { month: 'short' }),
        isToday: i === 0,
        isTomorrow: i === 1,
      });
    }
    return days;
  }, []);

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedDateForSlots(date);
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
        </View>

        {/* Priority Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{copy.priority}</Text>
          <View style={styles.priorityRow}>
            {(['GREEN', 'YELLOW', 'RED'] as const).map((p) => (
              <TouchableOpacity
                key={p}
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
                  {copy[p.toLowerCase() as keyof typeof copy]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>{copy.patientName}</Text>
          <TextInput
            style={styles.input}
            value={patientName}
            onChangeText={setPatientName}
            placeholder={copy.patientNamePlaceholder}
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={styles.label}>{copy.appointmentType}</Text>
          <View style={styles.typeRow}>
            {(['OUTPATIENT', 'TELECONSULT', 'DIAGNOSTIC'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeButton, appointmentType === type && styles.typeButtonActive]}
                onPress={() => setAppointmentType(type)}
              >
                <Text style={[
                  styles.typeText,
                  appointmentType === type && styles.typeTextActive,
                ]}>
                  {copy[type.toLowerCase() as keyof typeof copy]}
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
                onPress={() => setSelectedDoctor(doc.id)}
              >
                <Text style={styles.doctorName}>{doc.name}</Text>
                <Text style={styles.doctorSpecialty}>{doc.specialty}</Text>
              </TouchableOpacity>
            ))}
            {doctors.length === 0 && <Text style={styles.noDoctors}>{copy.noDoctorsAvailable}</Text>}
          </View>

          {/* Calendar View */}
          <Text style={styles.label}>{copy.selectDate}</Text>
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowCalendar(true)}>
            <Text style={[
              styles.dateButtonText,
              selectedDate && styles.dateButtonTextSelected,
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
              <View style={styles.modalOverlay} onTouchStart={() => setShowCalendar(false)}>
                <View style={styles.modalCard} onTouchStart={(e) => e.stopPropagation()}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{copy.calendarTitle}</Text>
                    <TouchableOpacity style={styles.modalClose} onPress={() => setShowCalendar(false)}>
                      <Text style={styles.modalCloseText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView contentContainerStyle={styles.calendarGrid}>
                    {next7Days.map((day) => (
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
            {availableSlots.length === 0 && selectedDate && (
              <Text style={styles.noSlots}>{copy.noSlotsAvailable}</Text>
            )}
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity style={[styles.bookButton, loading && styles.disabled]} onPress={handleBook} disabled={loading}>
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

export { AppointmentBookScreen };