import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { COLORS } from '@medisync/shared';
import { theme } from '../styles/theme';
import { useTranslation } from '../i18n';

interface Doctor {
  id: string;
  name: string;
  specialty: string;
}

export const AppointmentBookScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { t } = useTranslation();
  const [patientName, setPatientName] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [appointmentType, setAppointmentType] = useState('OUTPATIENT');

  const doctors: Doctor[] = [
    { id: 'doc-1', name: 'डॉ. शर्मा', specialty: 'General Physician' },
    { id: 'doc-2', name: 'डॉ. पाटिल', specialty: 'Cardiologist' },
    { id: 'doc-3', name: 'डॉ. शिंदे', specialty: 'Pediatrician' },
  ];

  const timeSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00'];

  const handleBook = async () => {
    if (!patientName || !selectedDoctor || !selectedDate || !selectedTime) return;

    const dateTime = new Date(`${selectedDate}T${selectedTime}:00`);
    try {
      await fetch('http://localhost:3001/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName,
          facilityId: 'facility-2',
          doctorId: selectedDoctor,
          dateTime: dateTime.toISOString(),
          type: appointmentType,
          priority: 'GREEN',
        }),
      });
      navigation.goBack();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Book Appointment</Text>
          <Text style={styles.headerSubtitle}>Schedule a visit with a doctor</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Patient Name</Text>
          <TextInput
            style={styles.input}
            value={patientName}
            onChangeText={setPatientName}
            placeholder="Enter patient name"
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={styles.label}>Appointment Type</Text>
          <View style={styles.typeRow}>
            {['OUTPATIENT', 'TELECONSULT', 'DIAGNOSTIC'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeButton, appointmentType === type && styles.typeButtonActive]}
                onPress={() => setAppointmentType(type)}
              >
                <Text style={[styles.typeText, appointmentType === type && styles.typeTextActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Select Doctor</Text>
          <View style={styles.doctorList}>
            {doctors.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                style={[styles.doctorCard, selectedDoctor === doc.id && styles.doctorCardActive]}
                onPress={() => setSelectedDoctor(doc.id)}
              >
                <Text style={styles.doctorName}>{doc.name}</Text>
                <Text style={styles.doctorSpecialty}>{doc.specialty}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={selectedDate}
            onChangeText={setSelectedDate}
            placeholder="2024-04-15"
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={styles.label}>Time Slot</Text>
          <View style={styles.timeGrid}>
            {timeSlots.map((slot) => (
              <TouchableOpacity
                key={slot}
                style={[styles.timeSlot, selectedTime === slot && styles.timeSlotActive]}
                onPress={() => setSelectedTime(slot)}
              >
                <Text style={[styles.timeText, selectedTime === slot && styles.timeTextActive]}>{slot}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.bookButton} onPress={handleBook}>
          <Text style={styles.bookButtonText}>Book Appointment</Text>
        </TouchableOpacity>
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
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  timeSlot: { paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderRadius: theme.borderRadius.sm, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  timeSlotActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  timeText: { fontSize: theme.typography.fontSize.sm, color: COLORS.textSecondary },
  timeTextActive: { color: COLORS.textOnPrimary, fontWeight: '600' },
  bookButton: { backgroundColor: COLORS.primary, borderRadius: theme.borderRadius.md, paddingVertical: theme.spacing.lg, alignItems: 'center', marginTop: theme.spacing.lg },
  bookButtonText: { color: COLORS.textOnPrimary, fontSize: theme.typography.fontSize.lg, fontWeight: '700' },
});
