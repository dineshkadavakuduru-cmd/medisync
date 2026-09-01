import { Appointment, QueueEntry, AppointmentStatus, AppointmentType, TriageSeverity } from '../types/index.js';
import { mockFacilities } from '../database/facilities.js';
import { getDoctors } from './teleconsultService.js';

const appointments: Map<string, Appointment> = new Map();

export const APPOINTMENT_TYPES: AppointmentType[] = ['OUTPATIENT', 'TELECONSULT', 'DIAGNOSTIC'];

export const APPOINTMENT_STATUSES: AppointmentStatus[] = ['BOOKED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  BOOKED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW', 'IN_PROGRESS'],
  CHECKED_IN: ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

const DOCTOR_APPOINTMENTS: { doctorId: string; availableSlots: string[] }[] = [
  { doctorId: 'doc-1', availableSlots: ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '15:30', '16:00'] },
  { doctorId: 'doc-2', availableSlots: ['09:30', '10:00', '10:30', '11:00', '11:30', '14:30', '15:00', '15:30', '16:00', '16:30'] },
  { doctorId: 'doc-3', availableSlots: ['10:00', '10:30', '11:00', '11:30', '12:00', '15:00', '15:30', '16:00', '16:30', '17:00'] },
  { doctorId: 'doc-4', availableSlots: ['09:00', '09:30', '10:30', '11:00', '11:30', '14:00', '14:30', '15:30', '16:00', '16:30'] },
];

function generateId(): string {
  return `apt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function getFacilityName(facilityId: string): string {
  const facility = mockFacilities.find((f) => f.id === facilityId);
  return facility?.name || facilityId;
}

function getTriageSeverityRank(severity: TriageSeverity): number {
  const rank: Record<TriageSeverity, number> = { RED: 0, YELLOW: 1, GREEN: 2 };
  return rank[severity];
}

export function createAppointment(data: {
  patientId: string;
  patientName: string;
  facilityId: string;
  doctorId?: string;
  dateTime: string;
  type: AppointmentType;
  priority: TriageSeverity;
}): Appointment {
  const facility = mockFacilities.find((f) => f.id === data.facilityId);
  const doctor = data.doctorId ? getDoctors().find((d) => d.id === data.doctorId) : undefined;

  const severityRank = getTriageSeverityRank(data.priority);
  const baseWait = data.type === 'TELECONSULT' ? 5 : data.type === 'DIAGNOSTIC' ? 15 : 30;
  const waitByPriority = severityRank === 0 ? Math.max(0, baseWait - 20) : severityRank === 1 ? Math.max(5, baseWait - 10) : baseWait + 10;

  const appointment: Appointment = {
    id: generateId(),
    patientId: data.patientId,
    patientName: data.patientName,
    facilityId: data.facilityId,
    facilityName: facility?.name || data.facilityId,
    doctorId: data.doctorId,
    doctorName: doctor?.name,
    dateTime: data.dateTime,
    type: data.type,
    status: 'BOOKED',
    estimatedWaitMinutes: waitByPriority,
    priority: data.priority,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  appointments.set(appointment.id, appointment);
  return appointment;
}

export function getAppointment(id: string): Appointment | undefined {
  return appointments.get(id);
}

export function getAllAppointments(): Appointment[] {
  return Array.from(appointments.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getAppointmentsByFacility(facilityId: string, date?: string): Appointment[] {
  return getAllAppointments().filter((a) => {
    if (a.facilityId !== facilityId) return false;
    if (date) {
      return a.dateTime.startsWith(date);
    }
    return true;
  });
}

export function getAppointmentsByPatient(patientId: string): Appointment[] {
  return getAllAppointments().filter((a) => a.patientId === patientId);
}

export function getAppointmentsByDoctor(doctorId: string, date?: string): Appointment[] {
  return getAllAppointments().filter((a) => {
    if (a.doctorId !== doctorId) return false;
    if (date) {
      return a.dateTime.startsWith(date);
    }
    return true;
  });
}

export function updateAppointmentStatus(
  id: string,
  newStatus: AppointmentStatus
): Appointment | null {
  const appointment = appointments.get(id);
  if (!appointment) return null;

  const allowed = VALID_TRANSITIONS[appointment.status] || [];
  if (newStatus !== appointment.status && !allowed.includes(newStatus)) {
    return null;
  }

  appointment.status = newStatus;
  appointment.updatedAt = new Date().toISOString();

  return appointment;
}

export function getQueue(facilityId: string): QueueEntry[] {
  const checkedIn = getAllAppointments()
    .filter((a) => a.facilityId === facilityId && (a.status === 'CHECKED_IN' || a.status === 'IN_PROGRESS'))
    .sort((a, b) => {
      const rankDiff = getTriageSeverityRank(a.priority) - getTriageSeverityRank(b.priority);
      if (rankDiff !== 0) return rankDiff;
      return new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
    });

  return checkedIn.map((apt, index) => ({
    appointmentId: apt.id,
    patientId: apt.patientId,
    patientName: apt.patientName,
    facilityId: apt.facilityId,
    priority: apt.priority,
    checkedInAt: apt.updatedAt,
    position: index + 1,
    estimatedWaitMinutes: Math.max(0, apt.estimatedWaitMinutes - index * 5),
  }));
}

export function getAvailableSlots(facilityId: string, date: string, doctorId?: string): string[] {
  const doctors = doctorId ? [getDoctors().find((d) => d.id === doctorId)].filter(Boolean) : getDoctors().filter((d) => d.facilityId === facilityId);
  const allSlots: string[] = [];

  doctors.forEach((doc) => {
    if (!doc) return;
    const available = DOCTOR_APPOINTMENTS.find((da) => da.doctorId === doc.id)?.availableSlots || [];
    const booked = getAppointmentsByDoctor(doc.id, date)
      .filter((a) => a.status === 'BOOKED' || a.status === 'CHECKED_IN' || a.status === 'IN_PROGRESS')
      .map((a) => a.dateTime.split('T')[1]?.substring(0, 5));

    available.forEach((slot) => {
      if (!booked.includes(slot) && !allSlots.includes(slot)) {
        allSlots.push(slot);
      }
    });
  });

  return allSlots.sort();
}

export function seedDemoAppointments() {
  if (appointments.size > 0) return;

  createAppointment({
    patientId: 'patient-1',
    patientName: 'राजेश पाटिल',
    facilityId: 'facility-2',
    doctorId: 'doc-1',
    dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    type: 'OUTPATIENT',
    priority: 'GREEN' as TriageSeverity,
  });

  createAppointment({
    patientId: 'patient-2',
    patientName: 'सुनीता शिंदे',
    facilityId: 'facility-2',
    doctorId: 'doc-1',
    dateTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    type: 'OUTPATIENT',
    priority: 'YELLOW' as TriageSeverity,
  });

  const urg = createAppointment({
    patientId: 'patient-3',
    patientName: 'आनंद जोशी',
    facilityId: 'facility-2',
    doctorId: 'doc-1',
    dateTime: new Date().toISOString(),
    type: 'OUTPATIENT',
    priority: 'YELLOW' as TriageSeverity,
  });
  updateAppointmentStatus(urg.id, 'CHECKED_IN');
}
