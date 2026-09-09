/// <reference lib="dom" />
import { isDemoActive } from './demoMode';

export type TeleconsultStatus = 'REQUESTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DECLINED' | 'CANCELLED';
export type TeleconsultRole = 'patient' | 'doctor';

export interface DoctorAvailability {
  doctorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isException: boolean;
  exceptionDate?: string;
}

export interface PrescriptionMedication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
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

export interface TeleconsultSession {
  id: string;
  patientId?: string;
  doctorId?: string;
  doctorSpecialty?: string;
  specialty?: string;
  patientName: string;
  doctorName: string;
  scheduledTime: string;
  status: TeleconsultStatus;
  meetingLink: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  prescription?: Prescription;
}

const transitions: Record<TeleconsultStatus, TeleconsultStatus[]> = {
  REQUESTED: ['ACCEPTED', 'DECLINED', 'CANCELLED'],
  ACCEPTED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], DECLINED: [], CANCELLED: [],
};
const storageKey = 'teleconsult.demo.v1';
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };

export function isMeetingLink(value: string): boolean {
  return /^https:\/\/meet\.jit\.si\/medisync-[a-f0-9]{48}$/.test(value);
}

function validateSession(value: unknown): TeleconsultSession {
  const s = value as TeleconsultSession;
  if (!s || typeof s.id !== 'string' || !s.id || typeof s.patientName !== 'string' ||
      typeof s.doctorName !== 'string' || !Number.isFinite(Date.parse(s.scheduledTime)) ||
      !Object.prototype.hasOwnProperty.call(transitions, s.status) ||
      typeof s.meetingLink !== 'string' ||
      (s.meetingLink !== '' && !isMeetingLink(s.meetingLink)) ||
      (['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(s.status) && !isMeetingLink(s.meetingLink))) {
    throw new Error('Invalid teleconsult session response');
  }
  for (const key of ['patientId', 'doctorId', 'doctorSpecialty', 'specialty'] as const) {
    if (s[key] !== undefined && typeof s[key] !== 'string') throw new Error('Invalid session metadata');
  }
  for (const key of ['startedAt', 'completedAt'] as const) {
    if (s[key] !== undefined && !Number.isFinite(Date.parse(s[key]!))) throw new Error('Invalid session timestamp');
  }
  if (s.prescription !== undefined) {
    validatePrescription(s.prescription, s.id);
    if (s.prescription.patientId !== s.patientId || s.prescription.doctorId !== s.doctorId) {
      throw new Error('Prescription does not match session participants');
    }
  }
  return s;
}

function validatePrescription(value: unknown, sessionId: string): Prescription {
  const p = value as Prescription;
  if (!p || typeof p.id !== 'string' || !p.id.trim() || p.sessionId !== sessionId ||
      typeof p.patientId !== 'string' || !p.patientId.trim() || typeof p.doctorId !== 'string' || !p.doctorId.trim() ||
      !Number.isFinite(Date.parse(p.createdAt)) || !Array.isArray(p.medications) || !p.medications.length ||
      p.medications.some(m => !m || ['name', 'dosage', 'frequency', 'duration'].some(k =>
        typeof m[k as keyof PrescriptionMedication] !== 'string' || !m[k as keyof PrescriptionMedication]?.trim()) ||
        (m.instructions !== undefined && typeof m.instructions !== 'string')) ||
      (p.notes !== undefined && typeof p.notes !== 'string')) throw new Error('Invalid prescription response');
  return p;
}

// Shared by the scoped booking and queue screens; never falls back to demo data.
export async function configuredApiRequest(path: string, method = 'GET', body?: unknown,
  origin = process.env.EXPO_PUBLIC_API_URL || ''): Promise<unknown> {
  const base = origin.trim().replace(/\/+$/, '');
  if (isDemoActive()) throw new Error('Demo mode: this server operation is paused.');
  if (!base) throw new Error('Not connected: configure EXPO_PUBLIC_API_URL with the backend origin.');
  let url: URL;
  try { url = new URL(base); } catch { throw new Error('EXPO_PUBLIC_API_URL must be an HTTP(S) origin without /api'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('EXPO_PUBLIC_API_URL must be an HTTP(S) origin without /api');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${base}/api${path}`, {
      method, signal: controller.signal, headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await response.json();
    if (isDemoActive()) throw new Error('Mode changed. Reload before continuing.');
    if (!response.ok || payload?.success !== true || payload.data === undefined) {
      throw new Error(typeof payload?.error === 'string' ? payload.error : `Request failed (${response.status})`);
    }
    return payload.data;
  } finally { clearTimeout(timeout); }
}

async function opaqueToken(): Promise<string> {
  // This installed polyfill has no TypeScript declarations.
  if (!globalThis.crypto?.getRandomValues) require('react-native-get-random-values');
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createTeleconsultClient(origin = '', storage?: Storage, demoMode: () => boolean = () => !origin.trim()) {
  const base = origin.trim().replace(/\/+$/, '');
  let queue: Promise<unknown> = Promise.resolve();

  async function request(path: string, method = 'GET', body?: unknown): Promise<unknown> {
    if (demoMode()) throw new Error('Demo mode: this server operation is paused.');
    const result = await configuredApiRequest(`/teleconsult${path}`, method, body, base);
    if (demoMode()) throw new Error('Mode changed. Reload before continuing.');
    return result;
  }

  async function local<T>(action: (sessions: TeleconsultSession[]) => Promise<T>, write = false): Promise<T> {
    const next = queue.then(async () => {
      if (!demoMode()) throw new Error('Mode changed. Reload before continuing.');
      const store = storage || (await import('@react-native-async-storage/async-storage')).default;
      const raw = await store.getItem(storageKey);
      if (!demoMode()) throw new Error('Mode changed. Reload before continuing.');
      const values = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(values)) throw new Error('Invalid local teleconsult data');
      const sessions = values.map(validateSession);
      const result = await action(sessions);
      if (!demoMode()) throw new Error('Mode changed. Reload before continuing.');
      if (write) await store.setItem(storageKey, JSON.stringify(sessions));
      if (!demoMode()) throw new Error('Mode changed. Reload before continuing.');
      return result;
    });
    queue = next.catch(() => undefined);
    return next;
  }

  return {
    get isDemo() { return demoMode(); },
    async list(): Promise<TeleconsultSession[]> {
      if (demoMode()) return local(async (sessions) => sessions.slice().reverse());
      const data = await request('/sessions');
      if (!Array.isArray(data)) throw new Error('Invalid teleconsult list response');
      return data.map(validateSession);
    },
    async get(id: string): Promise<TeleconsultSession> {
      if (!id) throw new Error('Session ID is required');
      if (!demoMode()) {
        const session = validateSession(await request(`/sessions/${encodeURIComponent(id)}`));
        if (session.id !== id) throw new Error('Unexpected session response');
        return session;
      }
      return local(async (sessions) => {
        const session = sessions.find((s) => s.id === id);
        if (!session) throw new Error('Session not found on this device');
        return { ...session };
      });
    },
    async createDemo(): Promise<TeleconsultSession> {
      if (!demoMode()) throw new Error('Local demo creation is unavailable in server mode');
      return local(async (sessions) => {
        const now = new Date().toISOString();
        const session: TeleconsultSession = {
          id: `demo-${await opaqueToken()}`, patientName: 'Demo patient', doctorName: 'Demo clinician',
          patientId: 'demo-patient', doctorId: 'demo-clinician',
          scheduledTime: now, createdAt: now, status: 'REQUESTED', meetingLink: '',
        };
        sessions.push(session);
        return { ...session };
      }, true);
    },
    async update(id: string, status: TeleconsultStatus): Promise<TeleconsultSession> {
      if (!demoMode()) {
        const session = validateSession(await request(`/sessions/${encodeURIComponent(id)}/status`, 'PATCH', { status }));
        if (session.id !== id || session.status !== status) throw new Error('Unexpected teleconsult update response');
        return session;
      }
      return local(async (sessions) => {
        const session = sessions.find((s) => s.id === id);
        if (!session) throw new Error('Session not found on this device');
        if (!transitions[session.status].includes(status)) throw new Error(`Invalid transition: ${session.status} -> ${status}`);
        if (status === 'ACCEPTED') session.meetingLink = `https://meet.jit.si/medisync-${await opaqueToken()}`;
        if (status === 'IN_PROGRESS') session.startedAt = new Date().toISOString();
        if (status === 'COMPLETED') session.completedAt = new Date().toISOString();
        session.status = status;
        return { ...session };
      }, true);
    },
    async getDoctorAvailability(doctorId: string): Promise<DoctorAvailability[]> {
      if (demoMode()) {
        return [
          { doctorId, dayOfWeek: 1, startTime: '09:00', endTime: '13:00', isException: false },
          { doctorId, dayOfWeek: 1, startTime: '14:00', endTime: '17:00', isException: false },
          { doctorId, dayOfWeek: 2, startTime: '09:00', endTime: '13:00', isException: false },
          { doctorId, dayOfWeek: 2, startTime: '14:00', endTime: '17:00', isException: false },
          { doctorId, dayOfWeek: 3, startTime: '09:00', endTime: '13:00', isException: false },
          { doctorId, dayOfWeek: 3, startTime: '14:00', endTime: '17:00', isException: false },
          { doctorId, dayOfWeek: 4, startTime: '09:00', endTime: '13:00', isException: false },
          { doctorId, dayOfWeek: 4, startTime: '14:00', endTime: '17:00', isException: false },
          { doctorId, dayOfWeek: 5, startTime: '09:00', endTime: '13:00', isException: false },
          { doctorId, dayOfWeek: 5, startTime: '14:00', endTime: '17:00', isException: false },
        ];
      }
      const data = await request(`/doctors/${encodeURIComponent(doctorId)}/availability`);
      if (!Array.isArray(data)) throw new Error('Invalid availability response');
      if (data.some(a => !a || a.doctorId !== doctorId || !Number.isInteger(a.dayOfWeek) ||
          a.dayOfWeek < 0 || a.dayOfWeek > 6 || typeof a.isException !== 'boolean' ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(a.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(a.endTime) ||
          a.startTime >= a.endTime || (a.isException && !/^\d{4}-\d{2}-\d{2}$/.test(a.exceptionDate)))) {
        throw new Error('Invalid availability response');
      }
      return data as DoctorAvailability[];
    },
    async getAvailableSlots(doctorId: string, date: string): Promise<string[]> {
      if (demoMode()) {
        const dayOfWeek = new Date(date).getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) return [];
        return ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
      }
      const data = await request(`/doctors/${encodeURIComponent(doctorId)}/slots/${encodeURIComponent(date)}`);
      if (!data || typeof data !== 'object' || !Array.isArray((data as any).slots)) {
        throw new Error('Invalid slots response');
      }
      const slots = (data as { slots: unknown[] }).slots;
      if (slots.some(s => typeof s !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s))) throw new Error('Invalid slots response');
      return [...new Set(slots as string[])];
    },
    async createPrescription(data: {
      sessionId: string;
      patientId: string;
      doctorId: string;
      medications: PrescriptionMedication[];
      notes?: string;
    }): Promise<Prescription> {
      const { notes, ...required } = data;
      const normalizedNotes = typeof notes === 'string' ? notes.trim() || undefined : notes;
      data = {
        ...required,
        medications: data.medications.map(({ instructions, ...medication }) => {
          const normalized = typeof instructions === 'string' ? instructions.trim() || undefined : instructions;
          return { ...medication, ...(normalized === undefined ? {} : { instructions: normalized }) };
        }),
        ...(normalizedNotes === undefined ? {} : { notes: normalizedNotes }),
      };
      const draft = validatePrescription({ ...data, id: 'draft', createdAt: new Date().toISOString() }, data.sessionId);
      if (demoMode()) {
        return local(async sessions => {
          const session = sessions.find(s => s.id === data.sessionId);
          if (!session || session.status !== 'IN_PROGRESS') throw new Error('Prescription requires an in-progress local session');
          // Older persisted demos predate participant IDs; assign explicitly demo-only identities.
          session.patientId ||= 'demo-patient';
          session.doctorId ||= 'demo-clinician';
          if (session.patientId !== data.patientId || session.doctorId !== data.doctorId) throw new Error('Prescription participants do not match the session');
          if (session.prescription) throw new Error('This session already has a saved prescription');
          const prescription: Prescription = {
            ...draft,
            id: `rx-${await opaqueToken()}`,
          };
          session.prescription = prescription;
          return prescription;
        }, true);
      }
      const session = validateSession(await request(`/sessions/${encodeURIComponent(data.sessionId)}`));
      if (session.id !== data.sessionId || session.status !== 'IN_PROGRESS' || session.patientId !== data.patientId || session.doctorId !== data.doctorId) {
        throw new Error('Prescription requires matching session participants and an in-progress consultation');
      }
      if (session.prescription) throw new Error('This session already has a saved prescription');
      const result = await request('/prescriptions', 'POST', data);
      const prescription = validatePrescription(result, data.sessionId);
      if (prescription.patientId !== data.patientId || prescription.doctorId !== data.doctorId) throw new Error('Unexpected prescription participants');
      return prescription;
    },
    async getPrescription(sessionId: string): Promise<Prescription> {
      if (demoMode()) {
        return local(async sessions => {
          const prescription = sessions.find(s => s.id === sessionId)?.prescription;
          if (!prescription) throw new Error('No prescription saved for this session');
          return prescription;
        });
      }
      const result = await request(`/prescriptions/session/${encodeURIComponent(sessionId)}`);
      return validatePrescription(result, sessionId);
    },
  };
}

export const teleconsultClient = createTeleconsultClient(process.env.EXPO_PUBLIC_API_URL || '', undefined, isDemoActive);
