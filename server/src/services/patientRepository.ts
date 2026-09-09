import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { FileStore } from '../database/fileStore.js';
import { ApiError, idSchema, text } from '../validation.js';
import type { HealthRecord } from '../types/index.js';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Expected a valid YYYY-MM-DD date');

export const patientInput = z.object({
  name: text(160), age: z.number().int().min(0).max(130),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  phone: z.string().trim().regex(/^\+?[0-9]{10,15}$/),
  village: text(160), district: text(160),
  languagePreference: z.enum(['en', 'hi', 'mr']),
  // An empty ABHA means not supplied, never an invented government identifier.
  abhaId: z.union([z.literal(''), z.string().regex(/^(?:\d{14}|\d{2}-\d{4}-\d{4}-\d{4})$/)]).default(''),
  trimester: z.number().int().min(1).max(3).optional(),
  nextVisitDate: date.optional(), lastVisit: date.optional(),
}).strict().refine(p => !p.lastVisit || !p.nextVisitDate || p.nextVisitDate >= p.lastVisit,
  { message: 'Next visit must not precede last visit', path: ['nextVisitDate'] });

const visitProjectionInput = z.object({
  patientId: idSchema, visitId: idSchema,
  timestamp: z.string().datetime({ offset: true }), recordedAt: z.string().datetime({ offset: true }),
  trimester: z.union([z.literal(1), z.literal(2), z.literal(3)]), lastVisit: date, nextVisitDate: date.optional(),
}).strict().refine(p => p.lastVisit === p.timestamp.slice(0, 10) && (!p.nextVisitDate || p.nextVisitDate >= p.lastVisit),
  'Visit dates do not match the projection');
export type PatientVisitProjection = z.infer<typeof visitProjectionInput>;
export type SavedPatient = z.infer<typeof patientInput> & {
  id: string; createdAt: string;
  visitProjection?: Pick<PatientVisitProjection, 'visitId' | 'timestamp' | 'recordedAt'>;
};
export const recordInput = z.object({
  facilityId: idSchema, visitDate: date, doctorName: text(160), diagnosis: text(2000),
  prescription: z.string().trim().max(4000).default(''),
  documents: z.array(z.string().url().max(2000)).max(20).default([]),
  notes: z.string().trim().max(4000).default(''),
}).strict();

// One server process per store directory, matching the existing fileStore contract.
export function createPatientRepository(path = resolve(process.env.PATIENTS_STORE_PATH || 'data/patients.json')) {
  const patients = new FileStore<SavedPatient>(path);
  const records = new FileStore<HealthRecord>(`${path}.records`);
  const get = (id: string) => {
    const patient = patients.get(id);
    if (!patient) throw new ApiError(404, 'Patient not found');
    return patient;
  };
  return {
    all: () => patients.all().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    get,
    create(body: unknown, key?: unknown) {
      const data = patientInput.parse(body);
      return patients.transact(key, data, () => ({ ...data, id: `patient-${randomUUID()}`, createdAt: new Date().toISOString() }));
    },
    updateVisitProjection(input: PatientVisitProjection) {
      const projection = visitProjectionInput.parse(input);
      const patient = get(projection.patientId);
      const previous = patient.visitProjection;
      if (previous?.visitId === projection.visitId) {
        if (previous.timestamp !== projection.timestamp || previous.recordedAt !== projection.recordedAt ||
            patient.trimester !== projection.trimester || patient.lastVisit !== projection.lastVisit ||
            patient.nextVisitDate !== projection.nextVisitDate) throw new ApiError(409, 'Visit projection ID already used with different data');
        return;
      }
      // Synchronous read/compare/save keeps the schedule and its replay marker atomic.
      // Match the field service ordering, including deterministic equal-time visits.
      if (previous) {
        const order = Date.parse(projection.timestamp) - Date.parse(previous.timestamp) ||
          Date.parse(projection.recordedAt) - Date.parse(previous.recordedAt) || projection.visitId.localeCompare(previous.visitId);
        if (order <= 0) return;
      } else if (patient.lastVisit && patient.lastVisit > projection.lastVisit) return;
      patients.save({ ...patient, trimester: projection.trimester, lastVisit: projection.lastVisit,
        // An omitted next date means unscheduled, not the old completed due date.
        nextVisitDate: projection.nextVisitDate,
        visitProjection: { visitId: projection.visitId, timestamp: projection.timestamp, recordedAt: projection.recordedAt } });
    },
    records(id: string) {
      get(id);
      return records.all().filter(record => record.patientId === id)
        .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());
    },
    addRecord(id: string, body: unknown, key?: unknown) {
      get(id);
      const data = recordInput.parse(body);
      return records.transact(key, { patientId: id, ...data }, () => ({ ...data, patientId: id, id: `record-${randomUUID()}` }));
    },
  };
}

export const patientRepository = createPatientRepository();
