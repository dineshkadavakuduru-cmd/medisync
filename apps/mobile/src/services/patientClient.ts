/// <reference lib="dom" />
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DiagnosticOrder, HealthRecord, Referral } from '@medisync/shared';
import { getApiOrigin } from './api';
import { isDemoActive } from './demoMode';
import { syncService } from './syncService';
import { validatePatient, JourneyPatient, PatientInput, PatientPrescription } from './patientHelpers';
import { PatientJourneyError } from '../i18n/patientJourney';

type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;
type Mode = 'live' | 'demo';
const demoKey = 'medisync.patients.demo.v1';

// Demo data never enters the live outbox or network. Live errors never select demo.
export function createPatientClient(storage: Storage, queue: typeof syncService, origin: () => string,
  isDemo: () => boolean, send: typeof fetch = fetch) {
  let serial: Promise<unknown> = Promise.resolve();
  const mode = (requested?: Mode) => requested || (isDemo() ? 'demo' : 'live');
  async function demoPatients(): Promise<JourneyPatient[]> {
    const raw = await storage.getItem(demoKey);
    const data: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(data)) throw new PatientJourneyError('demoStorageError');
    return data.map(patient => {
      validatePatient(patient);
      if (typeof patient.id !== 'string' || !patient.id.startsWith('demo-patient-')) throw new PatientJourneyError('demoStorageError');
      return patient as JourneyPatient;
    });
  }
  async function request<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await send(`${origin()}/api${path}`, { signal: controller.signal });
      const body = await response.json();
      if (!response.ok || body?.success !== true || body.data == null) throw new PatientJourneyError('loadError');
      return body.data as T;
    } finally { clearTimeout(timer); }
  }
  async function list<T>(path: string): Promise<T[]> {
    const data = await request<T[]>(path);
    if (!Array.isArray(data)) throw new PatientJourneyError('loadError');
    return data;
  }
  const patientPath = (id: string) => {
    if (!id || id.startsWith('demo-') || id.startsWith('action-')) throw new PatientJourneyError('serverPatientError');
    return `/patients/${encodeURIComponent(id)}`;
  };
  return {
    async getPatients(requested?: Mode) {
      return mode(requested) === 'demo' ? demoPatients() : list<JourneyPatient>('/patients');
    },
    async getPatient(id: string, requested?: Mode) {
      const patient = mode(requested) === 'demo' ? (await demoPatients()).find(p => p.id === id) : await request<JourneyPatient>(patientPath(id));
      if (!patient || patient.id !== id) throw new PatientJourneyError('patientNotFound');
      return patient;
    },
    async createPatient(input: PatientInput, requested?: Mode) {
      const data = validatePatient(input);
      if (mode(requested) === 'demo') {
        const result = serial.then(async () => {
          const patients = await demoPatients();
          const patient = { ...data, id: `demo-patient-${Date.now()}-${Math.random().toString(36).slice(2)}`, createdAt: new Date().toISOString() };
          await storage.setItem(demoKey, JSON.stringify([patient, ...patients]));
          return patient;
        });
        serial = result.catch(() => undefined);
        return { source: 'demo' as const, patient: await result };
      }
      await queue.enqueue({ type: 'CREATE_PATIENT', payload: data, timestamp: Date.now() });
      return { source: 'outbox' as const };
    },
    getPendingPatients() {
      return queue.getActions().filter(a => a.type === 'CREATE_PATIENT' && !a.demo && !a.discarded && a.status !== 'synced');
    },
    async getRecords(id: string, requested?: Mode) {
      return mode(requested) === 'demo' ? [] : (await list<HealthRecord>(`${patientPath(id)}/records`)).filter(r => r.patientId === id);
    },
    async getPrescriptions(id: string, requested?: Mode) {
      // Teleconsult demo sessions use a separate synthetic ID, not registry IDs.
      // Never attach those prescriptions to a registered patient by name or position.
      if (mode(requested) === 'demo') return [];
      const data = await list<PatientPrescription>(`${patientPath(id)}/prescriptions`);
      if (data.some(rx => !rx || rx.patientId !== id || [rx.id, rx.sessionId, rx.doctorId, rx.doctorName].some(v => typeof v !== 'string' || !v.trim()) ||
        !['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'CANCELLED'].includes(rx.sessionStatus) || !Number.isFinite(Date.parse(rx.createdAt)) ||
        (rx.notes !== undefined && typeof rx.notes !== 'string') || !Array.isArray(rx.medications) || !rx.medications.length ||
        rx.medications.some(m => !m || [m.name, m.dosage, m.frequency, m.duration].some(v => typeof v !== 'string' || !v.trim()) ||
          (m.instructions !== undefined && typeof m.instructions !== 'string')))) {
        throw new PatientJourneyError('rxInvalid');
      }
      return data;
    },
    async getDiagnostics(id: string, requested?: Mode) {
      if (mode(requested) === 'demo') return [];
      patientPath(id);
      return (await list<DiagnosticOrder>(`/diagnostics/orders?patientId=${encodeURIComponent(id)}`)).filter(r => r.patientId === id);
    },
    async getReferrals(id: string, requested?: Mode) {
      if (mode(requested) === 'demo') return [];
      patientPath(id);
      return (await list<Referral>('/referrals')).filter(r => r.patientId === id);
    },
  };
}

export const patientClient = createPatientClient(AsyncStorage, syncService, getApiOrigin, isDemoActive);
