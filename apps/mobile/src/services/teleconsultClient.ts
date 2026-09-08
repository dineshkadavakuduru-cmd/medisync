/// <reference lib="dom" />

export type TeleconsultStatus = 'REQUESTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DECLINED' | 'CANCELLED';
export type TeleconsultRole = 'patient' | 'doctor';
export interface TeleconsultSession {
  id: string;
  patientName: string;
  doctorName: string;
  scheduledTime: string;
  status: TeleconsultStatus;
  meetingLink: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
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
  // Only opaque rooms on the chosen provider may be opened or embedded.
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
  return s;
}

async function opaqueToken(): Promise<string> {
  if (!globalThis.crypto?.getRandomValues) await import('react-native-get-random-values');
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createTeleconsultClient(origin = '', storage?: Storage) {
  const base = origin.trim().replace(/\/+$/, '');
  const isDemo = !base;
  let queue: Promise<unknown> = Promise.resolve();

  async function request(path: string, method = 'GET', body?: unknown): Promise<unknown> {
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
      throw new Error('EXPO_PUBLIC_API_URL must be an API origin without /api');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${base}/api/teleconsult${path}`, {
        method, signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const payload = await response.json();
      if (!response.ok || payload?.success !== true || payload.data === undefined) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : `Teleconsult request failed (${response.status})`);
      }
      return payload.data;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function local<T>(action: (sessions: TeleconsultSession[]) => Promise<T>, write = false): Promise<T> {
    // Serialize local reads/writes so double clicks cannot generate two accepted rooms.
    const next = queue.then(async () => {
      const store = storage || (await import('@react-native-async-storage/async-storage')).default;
      const raw = await store.getItem(storageKey);
      const values = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(values)) throw new Error('Invalid local teleconsult data');
      const sessions = values.map(validateSession);
      const result = await action(sessions);
      if (write) await store.setItem(storageKey, JSON.stringify(sessions));
      return result;
    });
    queue = next.catch(() => undefined);
    return next;
  }

  return {
    isDemo,
    async list(): Promise<TeleconsultSession[]> {
      if (isDemo) return local(async (sessions) => sessions.slice().reverse());
      const data = await request('/sessions');
      if (!Array.isArray(data)) throw new Error('Invalid teleconsult list response');
      return data.map(validateSession);
    },
    async get(id: string): Promise<TeleconsultSession> {
      if (!id) throw new Error('Session ID is required');
      if (!isDemo) return validateSession(await request(`/sessions/${encodeURIComponent(id)}`));
      return local(async (sessions) => {
        const session = sessions.find((s) => s.id === id);
        if (!session) throw new Error('Session not found on this device');
        return { ...session };
      });
    },
    async createDemo(): Promise<TeleconsultSession> {
      if (!isDemo) throw new Error('Local demo creation is unavailable with a configured backend');
      return local(async (sessions) => {
        const now = new Date().toISOString();
        const session: TeleconsultSession = {
          id: `demo-${await opaqueToken()}`, patientName: 'Demo patient', doctorName: 'Demo clinician',
          scheduledTime: now, createdAt: now, status: 'REQUESTED', meetingLink: '',
        };
        sessions.push(session);
        return { ...session };
      }, true);
    },
    async update(id: string, status: TeleconsultStatus): Promise<TeleconsultSession> {
      if (!isDemo) {
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
  };
}

export const teleconsultClient = createTeleconsultClient(process.env.EXPO_PUBLIC_API_URL || '');
