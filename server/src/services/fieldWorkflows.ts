import { z } from 'zod';
import { ApiError, idSchema, keySchema } from '../validation.js';
import { computeStatus, emptyFieldRecord, fieldStore, orderStatuses } from './inventoryService.js';
import type { FieldRecord } from './inventoryService.js';
import type { FileStore } from '../database/fileStore.js';
import type { PatientVisitProjection } from './patientRepository.js';
export type { PatientVisitProjection } from './patientRepository.js';

const quantity = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const timestamp = z.string().datetime({ offset: true });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');
const numeric = (min: number, max: number) => z.string().trim().refine(value => value === '' ||
  (/^\d+(\.\d+)?$/.test(value) && Number(value) >= min && Number(value) <= max), 'Measurement outside accepted range').optional();
const checklistSchema = z.object({
  bp: z.string().trim().refine(value => {
    if (!value) return true;
    if (!/^\d{2,3}\s*\/\s*\d{2,3}$/.test(value)) return false;
    const [s, d] = value.split('/').map(Number);
    return s >= 50 && s <= 300 && d >= 30 && d <= 200 && s > d;
  }, 'Invalid blood pressure').optional(),
  weight: numeric(1, 500), hb: numeric(1, 25), fundalHeight: numeric(1, 60),
  urineAlbumin: z.string().trim().max(200).optional(), hivSyphilis: z.string().trim().max(200).optional(),
  presentation: z.string().trim().max(200).optional(), tt1: z.boolean().optional(), tt2: z.boolean().optional(),
  ifa: z.boolean().optional(), ttBooster: z.boolean().optional(),
}).strict();
const visitSchema = z.object({
  patientId: idSchema, ashaId: idSchema, trimester: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  checklist: checklistSchema, voiceNotes: z.string().trim().max(4000).default(''), timestamp,
  nextVisitDate: date.optional(), reviewed: z.literal(true),
  highRisk: z.boolean(), highRiskFlags: z.array(z.enum(['hbReview', 'bpReview', 'presentationReview'])).max(3),
  requiresClinicianReview: z.boolean(),
}).strict().refine(v => Object.values(v.checklist).some(value => typeof value === 'boolean' || !!value) || !!v.voiceNotes,
  'At least one observation is required').refine(v => !v.nextVisitDate || v.nextVisitDate >= v.timestamp.slice(0, 10), 'Next visit precedes this visit');
export type AshaVisit = z.infer<typeof visitSchema> & { id: string; recordedAt: string };
const stockPayload = z.object({
  facilityId: idSchema, medicineId: idSchema, staffId: idSchema, quantity, timestamp,
  medicineName: z.string().trim().max(200).optional(),
});
const schemas = {
  CREATE_ASHA_VISIT: visitSchema,
  UPDATE_INVENTORY: stockPayload.extend({ newStock: quantity, currentStock: quantity.optional(), operation: z.literal('physical_count') }).strict()
    .refine(v => v.quantity === v.newStock && (v.currentStock === undefined || v.currentStock === v.newStock), 'Conflicting counts'),
  DISPENSE_MEDICINE: stockPayload.extend({ dispensedBy: idSchema.optional() }).strict(),
  CREATE_INVENTORY_ORDER: stockPayload.extend({ quantity: quantity.positive(), orderedBy: idSchema.optional(), status: z.literal('PO') }).strict(),
  UPDATE_INVENTORY_ORDER: z.object({ facilityId: idSchema, orderId: idSchema, staffId: idSchema, timestamp, status: z.enum(orderStatuses) }).strict(),
};
const actionSchema = z.object({ id: idSchema, type: z.enum(['CREATE_ASHA_VISIT', 'UPDATE_INVENTORY', 'DISPENSE_MEDICINE', 'CREATE_INVENTORY_ORDER', 'UPDATE_INVENTORY_ORDER']), payload: z.unknown() }).strict();
// The patient repository applies an idempotent, chronological projection. It is retried
// on receipt replay and GET visits; the visit receipt remains authoritative if it fails.
export interface FieldWorkflowOptions {
  store?: FileStore<FieldRecord>;
  projectPatientVisit?: (projection: PatientVisitProjection) => void | Promise<void>;
  patientExists?: (patientId: string) => boolean | Promise<boolean>;
  now?: () => number;
}
export function createFieldWorkflows(options: FieldWorkflowOptions = {}) {
  const store = options.store || fieldStore;
  const now = options.now || Date.now;
  const project = async (visits: AshaVisit[]) => {
    // Synthetic visits never look up or project into the ordinary patient repository,
    // including receipt replays, history-read repairs, and injected callbacks.
    if (process.env.FIELD_WORKFLOWS_DEMO === 'true') return 'pending' as const;
    const latest = visits.slice().sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp) ||
      Date.parse(b.recordedAt) - Date.parse(a.recordedAt) || b.id.localeCompare(a.id))[0];
    if (!latest || !options.projectPatientVisit) return 'pending' as const;
    try {
      await options.projectPatientVisit({ patientId: latest.patientId, trimester: latest.trimester,
        visitId: latest.id, timestamp: latest.timestamp, recordedAt: latest.recordedAt,
        lastVisit: latest.timestamp.slice(0, 10), nextVisitDate: latest.nextVisitDate });
      return 'updated' as const;
    } catch { return 'pending' as const; }
  };
  return {
    async apply(input: unknown, keyInput: unknown) {
      const action = actionSchema.parse(input);
      const key = keySchema.parse(keyInput);
      if (!key || key !== action.id) throw new ApiError(400, 'Idempotency-Key must equal action id');
      const payload = schemas[action.type].parse(action.payload);
      if (Date.parse(payload.timestamp) > now() + 300000) throw new ApiError(400, 'Future action timestamp');
      // Resolve async patient validation before entering the synchronous read/modify/commit.
      if (process.env.FIELD_WORKFLOWS_DEMO !== 'true' && 'patientId' in payload && options.patientExists && !await options.patientExists(payload.patientId)) throw new ApiError(400, 'Unknown patient');
      const result = await store.transact(key, action, () => {
        const recordedAt = new Date(now()).toISOString();
        if (action.type === 'CREATE_ASHA_VISIT') {
          const visit = visitSchema.parse(payload);
          const flags: string[] = [];
          if (visit.checklist.hb && Number(visit.checklist.hb) < 11) flags.push('hbReview');
          if (visit.checklist.bp) {
            const [s, d] = visit.checklist.bp.split('/').map(Number);
            if (s >= 140 || d >= 90) flags.push('bpReview');
          }
          if (visit.checklist.presentation) flags.push('presentationReview');
          if (visit.highRisk !== !!flags.length || visit.requiresClinicianReview !== !!flags.length ||
              [...visit.highRiskFlags].sort().join(',') !== flags.sort().join(',')) throw new ApiError(400, 'Review flags do not match measurements');
          const record = store.get(`visits:${visit.patientId}`) || emptyFieldRecord(`visits:${visit.patientId}`);
          record.visits.push({ ...visit, id: action.id, recordedAt });
          record.receipt = { id: action.id, type: action.type, entityId: action.id };
          return record;
        }
        const p = payload as z.infer<typeof stockPayload> & { newStock?: number; orderId?: string; status?: typeof orderStatuses[number] };
        const record = store.get(`inventory:${p.facilityId}`);
        if (!record) throw new ApiError(400, 'Unknown facility inventory; import a catalogue first');
        let entityId = action.id;
        if (action.type === 'UPDATE_INVENTORY_ORDER') {
          const order = record.orders.find(o => o.id === p.orderId);
          if (!order) throw new ApiError(400, 'Unknown purchase order');
          if (orderStatuses[orderStatuses.indexOf(order.status) + 1] !== p.status) throw new ApiError(400, 'Purchase order must follow PO > APPROVED > ORDERED > RECEIVED > VERIFIED > STOCKED');
          const medicine = record.stocks.find(item => item.id === order.medicineId)!;
          if (p.status === 'STOCKED') {
            if (order.quantity > medicine.maxCapacity - medicine.currentStock) throw new ApiError(400, 'Stock exceeds maximum capacity');
            const before = medicine.currentStock;
            medicine.currentStock += order.quantity;
            medicine.status = computeStatus(medicine.currentStock, medicine.minThreshold);
            medicine.lastRestocked = recordedAt;
            record.log.push({ id: action.id, medicineId: medicine.id, kind: 'stock_order', quantity: order.quantity, before,
              after: medicine.currentStock, timestamp: p.timestamp, recordedAt, staffId: p.staffId, orderId: order.id });
          }
          order.status = p.status!;
          order.history.push({ status: order.status, timestamp: recordedAt, staffId: p.staffId });
          entityId = order.id;
        } else {
          const medicine = record.stocks.find(item => item.id === p.medicineId);
          if (!medicine) throw new ApiError(400, 'Unknown medicine');
          if (action.type === 'CREATE_INVENTORY_ORDER') {
            if (p.quantity > medicine.maxCapacity) throw new ApiError(400, 'Order exceeds maximum capacity');
            record.orders.push({ id: action.id, facilityId: p.facilityId, medicineId: p.medicineId, quantity: p.quantity,
              status: 'PO', history: [{ status: 'PO', timestamp: recordedAt, staffId: p.staffId }] });
          } else {
            const before = medicine.currentStock;
            const after = action.type === 'DISPENSE_MEDICINE' ? before - p.quantity : p.newStock!;
            if (after < 0 || after > medicine.maxCapacity) throw new ApiError(400, 'Quantity exceeds available stock or capacity');
            medicine.currentStock = after;
            medicine.status = computeStatus(after, medicine.minThreshold);
            if (after > before) medicine.lastRestocked = recordedAt;
            record.log.push({ id: action.id, medicineId: medicine.id, kind: action.type === 'DISPENSE_MEDICINE' ? 'dispense' : 'physical_count',
              quantity: p.quantity, before, after, timestamp: p.timestamp, recordedAt, staffId: p.staffId });
          }
        }
        record.receipt = { id: action.id, type: action.type, entityId };
        return record;
      }, record => {
        if (!record.receipt) throw new ApiError(503, 'Field workflow receipt unavailable; no write confirmed');
        return { ...record.receipt, recordId: record.id };
      });
      const { recordId, ...receipt } = result.data;
      const patientProjection = action.type === 'CREATE_ASHA_VISIT'
        ? await project(store.get(recordId)!.visits) : undefined;
      return { data: { ...receipt, patientProjection, notificationsSent: false }, replayed: result.replayed };
    },
    inventory(facilityId: string) {
      const record = store.get(`inventory:${idSchema.parse(facilityId)}`) || emptyFieldRecord(`inventory:${facilityId}`);
      const usage = record.stocks.map(item => {
        const total = (days: number) => record.log.filter(log => log.kind === 'dispense' && log.medicineId === item.id &&
          Date.parse(log.timestamp) > now() - days * 86400000 && Date.parse(log.timestamp) <= now()).reduce((sum, log) => sum + log.quantity, 0);
        const total7 = total(7), total30 = total(30);
        return { medicineId: item.id, total7, total30, dailyAverage7: total7 / 7, dailyAverage30: total30 / 30 };
      });
      return { stocks: record.stocks, log: record.log, orders: record.orders, usage,
        mode: process.env.FIELD_WORKFLOWS_DEMO === 'true' ? 'demo' : 'manual', notificationsSent: false };
    },
    async visits(patientId: string) {
      const visits = store.get(`visits:${idSchema.parse(patientId)}`)?.visits || [];
      return { visits, patientProjection: await project(visits) };
    },
  };
}
