import { TeleconsultSession, TeleconsultStatus, Doctor } from '../types/index.js';
import { mockFacilities } from '../database/facilities.js';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Single-process demo persistence. Production needs a transactional shared database.
const storePath = resolve(process.env.TELECONSULT_STORE_PATH || 'data/teleconsult-sessions.json');
const saved: TeleconsultSession[] = existsSync(storePath) ? JSON.parse(readFileSync(storePath, 'utf8')) : [];
const sessions = new Map<string, TeleconsultSession>(saved.map((session) => [session.id, session]));

function persist(session: TeleconsultSession): void {
  const next = new Map(sessions);
  next.set(session.id, session);
  mkdirSync(dirname(storePath), { recursive: true });
  const temporary = `${storePath}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify([...next.values()]), { mode: 0o600 });
  renameSync(temporary, storePath);
  sessions.set(session.id, session);
}

const DOCTORS: Doctor[] = [
  { id: 'doc-1', name: 'डॉ. शर्मा', facilityId: 'facility-2', specialty: 'General Physician', languages: ['en', 'hi', 'mr'] },
  { id: 'doc-2', name: 'डॉ. पाटिल', facilityId: 'facility-8', specialty: 'Cardiologist', languages: ['en', 'hi', 'mr'] },
  { id: 'doc-3', name: 'डॉ. शिंदे', facilityId: 'facility-2', specialty: 'Pediatrician', languages: ['en', 'hi', 'mr'] },
  { id: 'doc-4', name: 'डॉ. कुलकर्णी', facilityId: 'facility-8', specialty: 'Neurologist', languages: ['en', 'hi', 'mr'] },
];

const VALID_TRANSITIONS: Record<TeleconsultStatus, TeleconsultStatus[]> = {
  REQUESTED: ['ACCEPTED', 'DECLINED', 'CANCELLED'],
  ACCEPTED: ['IN_PROGRESS', 'CANCELLED'],
  DECLINED: [],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function generateMeetingLink(): string {
  return `https://meet.jit.si/medisync-${randomBytes(24).toString('hex')}`;
}

export function getDoctors(): Doctor[] {
  return DOCTORS;
}

export function getDoctorById(id: string): Doctor | undefined {
  return DOCTORS.find((d) => d.id === id);
}

export function getDoctorsByFacility(facilityId: string): Doctor[] {
  return DOCTORS.filter((d) => d.facilityId === facilityId);
}

export function createSession(data: {
  patientId?: string;
  patientName: string;
  fromFacilityId: string;
  doctorId: string;
  referralId?: string;
  scheduledTime: string;
}): TeleconsultSession {
  const doctor = getDoctorById(data.doctorId);
  if (!doctor || !mockFacilities.some((f) => f.id === data.fromFacilityId)) {
    throw new Error('Unknown doctor or facility');
  }
  if (!data.patientName?.trim() || !Number.isFinite(Date.parse(data.scheduledTime))) {
    throw new Error('Patient name and valid scheduled time are required');
  }

  const session: TeleconsultSession = {
    id: `tc-${randomUUID()}`,
    patientId: data.patientId,
    patientName: data.patientName,
    fromFacilityId: data.fromFacilityId,
    doctorId: data.doctorId,
    doctorName: doctor?.name || data.doctorId,
    referralId: data.referralId,
    scheduledTime: data.scheduledTime,
    status: 'REQUESTED',
    meetingLink: '',
    createdAt: new Date().toISOString(),
  };

  persist(session);
  return { ...session };
}

export function getSession(id: string): TeleconsultSession | undefined {
  const session = sessions.get(id);
  return session ? { ...session } : undefined;
}

export function getAllSessions(): TeleconsultSession[] {
  return Array.from(sessions.values(), (session) => ({ ...session })).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getSessionsByDoctor(doctorId: string): TeleconsultSession[] {
  return getAllSessions().filter((s) => s.doctorId === doctorId);
}

export function getSessionsByFacility(facilityId: string): TeleconsultSession[] {
  return getAllSessions().filter((s) => s.fromFacilityId === facilityId || getDoctorById(s.doctorId)?.facilityId === facilityId);
}

export function updateSessionStatus(
  id: string,
  newStatus: TeleconsultStatus
): TeleconsultSession | null {
  const session = getSession(id);
  if (!session) return null;

  const allowed = VALID_TRANSITIONS[session.status] || [];
  if (!allowed.includes(newStatus)) {
    return null;
  }

  if (newStatus === 'ACCEPTED') session.meetingLink = generateMeetingLink();
  session.status = newStatus;

  if (newStatus === 'IN_PROGRESS' && !session.startedAt) {
    session.startedAt = new Date().toISOString();
  }
  if (newStatus === 'COMPLETED' && !session.completedAt) {
    session.completedAt = new Date().toISOString();
  }

  persist(session);
  return { ...session };
}

export function getPendingSessionCount(): number {
  return getAllSessions().filter((s) => s.status === 'REQUESTED' || s.status === 'ACCEPTED').length;
}

export interface DoctorAvailability {
  doctorId: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  startTime: string; // HH:MM in 24h format
  endTime: string;
  isException: boolean;
  exceptionDate?: string; // YYYY-MM-DD for exception dates
}

export interface Prescription {
  id: string;
  sessionId: string;
  patientId: string;
  doctorId: string;
  medications: PrescriptionMedication[];
  notes?: string;
  createdAt: string;
}

export interface PrescriptionMedication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

// Weekly recurring availability for doctors (IST timezone)
const DOCTOR_AVAILABILITY: DoctorAvailability[] = [
  // Dr. Sharma (doc-1) - General Physician
  { doctorId: 'doc-1', dayOfWeek: 1, startTime: '09:00', endTime: '13:00', isException: false },
  { doctorId: 'doc-1', dayOfWeek: 1, startTime: '14:00', endTime: '17:00', isException: false },
  { doctorId: 'doc-1', dayOfWeek: 2, startTime: '09:00', endTime: '13:00', isException: false },
  { doctorId: 'doc-1', dayOfWeek: 2, startTime: '14:00', endTime: '17:00', isException: false },
  { doctorId: 'doc-1', dayOfWeek: 3, startTime: '09:00', endTime: '13:00', isException: false },
  { doctorId: 'doc-1', dayOfWeek: 3, startTime: '14:00', endTime: '17:00', isException: false },
  { doctorId: 'doc-1', dayOfWeek: 4, startTime: '09:00', endTime: '13:00', isException: false },
  { doctorId: 'doc-1', dayOfWeek: 4, startTime: '14:00', endTime: '17:00', isException: false },
  { doctorId: 'doc-1', dayOfWeek: 5, startTime: '09:00', endTime: '13:00', isException: false },
  { doctorId: 'doc-1', dayOfWeek: 5, startTime: '14:00', endTime: '17:00', isException: false },
  // Dr. Patil (doc-2) - Cardiologist
  { doctorId: 'doc-2', dayOfWeek: 1, startTime: '10:00', endTime: '14:00', isException: false },
  { doctorId: 'doc-2', dayOfWeek: 2, startTime: '10:00', endTime: '14:00', isException: false },
  { doctorId: 'doc-2', dayOfWeek: 3, startTime: '10:00', endTime: '14:00', isException: false },
  { doctorId: 'doc-2', dayOfWeek: 4, startTime: '10:00', endTime: '14:00', isException: false },
  { doctorId: 'doc-2', dayOfWeek: 5, startTime: '10:00', endTime: '14:00', isException: false },
  // Dr. Shinde (doc-3) - Pediatrician
  { doctorId: 'doc-3', dayOfWeek: 2, startTime: '09:00', endTime: '13:00', isException: false },
  { doctorId: 'doc-3', dayOfWeek: 2, startTime: '14:00', endTime: '17:00', isException: false },
  { doctorId: 'doc-3', dayOfWeek: 4, startTime: '09:00', endTime: '13:00', isException: false },
  { doctorId: 'doc-3', dayOfWeek: 4, startTime: '14:00', endTime: '17:00', isException: false },
  // Dr. Kulkarni (doc-4) - Neurologist
  { doctorId: 'doc-4', dayOfWeek: 1, startTime: '11:00', endTime: '15:00', isException: false },
  { doctorId: 'doc-4', dayOfWeek: 3, startTime: '11:00', endTime: '15:00', isException: false },
  { doctorId: 'doc-4', dayOfWeek: 5, startTime: '11:00', endTime: '15:00', isException: false },
];

export function getDoctorAvailability(doctorId: string): DoctorAvailability[] {
  return DOCTOR_AVAILABILITY.filter((a) => a.doctorId === doctorId);
}

export function getAvailableSlotsForDoctor(doctorId: string, date: string): string[] {
  const dayOfWeek = new Date(date).getDay();
  const availability = DOCTOR_AVAILABILITY.filter(
    (a) => a.doctorId === doctorId && a.dayOfWeek === dayOfWeek && !a.isException
  );
  
  // Check for exception dates
  const exceptions = DOCTOR_AVAILABILITY.filter(
    (a) => a.doctorId === doctorId && a.isException && a.exceptionDate === date
  );
  if (exceptions.length > 0) {
    // If there's an exception for this date, return no slots
    return [];
  }

  const slots: string[] = [];
  for (const avail of availability) {
    const start = parseInt(avail.startTime.split(':')[0], 10);
    const end = parseInt(avail.endTime.split(':')[0], 10);
    for (let hour = start; hour < end; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        if (hour === end && minute > 0) break;
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeStr);
      }
    }
  }

  // Filter out already booked slots
  const bookedSlots = getAllSessions()
    .filter((s) => s.doctorId === doctorId && s.scheduledTime.startsWith(date) && 
      ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS'].includes(s.status))
    .map((s) => s.scheduledTime.split('T')[1]?.substring(0, 5))
    .filter(Boolean);

  return slots.filter((slot) => !bookedSlots.includes(slot));
}

export function createPrescription(data: {
  sessionId: string;
  patientId: string;
  doctorId: string;
  medications: PrescriptionMedication[];
  notes?: string;
}): Prescription {
  const session = getSession(data.sessionId);
  if (!session) throw new Error('Session not found');

  const prescription: Prescription = {
    id: `rx-${randomBytes(12).toString('hex')}`,
    sessionId: data.sessionId,
    patientId: data.patientId,
    doctorId: data.doctorId,
    medications: data.medications,
    notes: data.notes,
    createdAt: new Date().toISOString(),
  };

  // Store prescription (in production, persist to database)
  session.prescription = prescription;
  persist(session);
  return prescription;
}

export function getPrescriptionBySession(sessionId: string): Prescription | undefined {
  const session = getSession(sessionId);
  return session?.prescription;
}
