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

export function seedDemoSessions() {
  if (sessions.size > 0) return;

  const session1 = createSession({
    patientId: 'patient-2',
    patientName: 'Demo patient A',
    fromFacilityId: 'facility-3',
    doctorId: 'doc-1',
    referralId: 'referral-demo-1',
    scheduledTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
  updateSessionStatus(session1.id, 'ACCEPTED');

  createSession({
    patientId: 'patient-5',
    patientName: 'Demo patient B',
    fromFacilityId: 'facility-5',
    doctorId: 'doc-2',
    scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  });
}
