import { TeleconsultSession, TeleconsultStatus, Doctor } from '../types/index.js';
import { mockFacilities } from '../database/facilities.js';

const sessions: Map<string, TeleconsultSession> = new Map();

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

function generateId(): string {
  return `tc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function generateMeetingLink(sessionId: string): string {
  const token = Buffer.from(`${sessionId}-${Date.now()}`).toString('base64url').substring(0, 24);
  return `https://meet.medisync.plus/room/${sessionId}?token=${token}`;
}

function getFacilityName(facilityId: string): string {
  const facility = mockFacilities.find((f) => f.id === facilityId);
  return facility?.name || facilityId;
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
  const facility = mockFacilities.find((f) => f.id === data.fromFacilityId);

  const session: TeleconsultSession = {
    id: generateId(),
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

  session.meetingLink = generateMeetingLink(session.id);
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): TeleconsultSession | undefined {
  return sessions.get(id);
}

export function getAllSessions(): TeleconsultSession[] {
  return Array.from(sessions.values()).sort(
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
  newStatus: TeleconsultStatus,
  notes?: string
): TeleconsultSession | null {
  const session = sessions.get(id);
  if (!session) return null;

  const allowed = VALID_TRANSITIONS[session.status] || [];
  if (!allowed.includes(newStatus) && session.status !== newStatus) {
    return null;
  }

  const prevStatus = session.status;
  session.status = newStatus;

  if (newStatus === 'IN_PROGRESS' && !session.startedAt) {
    session.startedAt = new Date().toISOString();
  }
  if (newStatus === 'COMPLETED' && !session.completedAt) {
    session.completedAt = new Date().toISOString();
  }

  if (notes) {
    session.meetingLink = session.meetingLink;
  }

  return session;
}

export function getPendingSessionCount(): number {
  return getAllSessions().filter((s) => s.status === 'REQUESTED' || s.status === 'ACCEPTED').length;
}

export function seedDemoSessions() {
  if (sessions.size > 0) return;

  const session1 = createSession({
    patientId: 'patient-2',
    patientName: 'सुनीता शिंदे',
    fromFacilityId: 'facility-3',
    doctorId: 'doc-1',
    referralId: 'referral-demo-1',
    scheduledTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
  updateSessionStatus(session1.id, 'ACCEPTED');

  const session2 = createSession({
    patientId: 'patient-5',
    patientName: 'सचिन गवसकर',
    fromFacilityId: 'facility-5',
    doctorId: 'doc-2',
    scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  });
}
