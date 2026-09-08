import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { z } from 'zod';
import { getEmergencyById } from './emergencyService.js';
import { broadcast } from '../websocket/realtime.js';

export const vitalReadingSchema = z.object({
  source: z.enum(['measured', 'demo']),
  measuredAt: z.string().datetime(),
  heartRate: z.number().finite().min(20).max(300).optional(),
  oxygenSaturation: z.number().finite().min(50).max(100).optional(),
  bloodPressureSystolic: z.number().finite().min(40).max(300).optional(),
  bloodPressureDiastolic: z.number().finite().min(20).max(200).optional(),
}).strict().superRefine((value, context) => {
  if ([value.heartRate, value.oxygenSaturation, value.bloodPressureSystolic].every(v => v === undefined)) {
    context.addIssue({ code: 'custom', message: 'At least one measurement is required' });
  }
  if ((value.bloodPressureSystolic === undefined) !== (value.bloodPressureDiastolic === undefined)
      || (value.bloodPressureSystolic !== undefined && value.bloodPressureSystolic <= value.bloodPressureDiastolic!)) {
    context.addIssue({ code: 'custom', message: 'Provide a BP pair with systolic greater than diastolic' });
  }
});
export type VitalReading = z.infer<typeof vitalReadingSchema>;
export interface StoredVital extends VitalReading { id: string; emergencyId: string; receivedAt: string }
export class VitalsError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}
export function isInTransit(status: string) { return status === 'IN_TRANSIT' || status === 'EN_ROUTE_TO_HOSPITAL'; }

export function validateReading(input: unknown, now = Date.now()): VitalReading {
  const parsed = vitalReadingSchema.safeParse(input);
  if (!parsed.success) throw new VitalsError(400, 'Invalid vitals: numeric supported ranges and a complete BP pair are required');
  const time = Date.parse(parsed.data.measuredAt);
  if (time < now - 300000 || time > now + 30000) throw new VitalsError(400, 'Measurement must be within the last 5 minutes, with at most 30 seconds clock skew');
  return parsed.data;
}

// Existing emergencies are memory-backed, not PG-backed. Demo history shares that
// lifetime and is bounded globally. Measured mode explicitly requires durable PG.
export function createVitalsService(options: {
  mode?: 'demo' | 'measured'; databaseUrl?: string;
  getEmergency?: typeof getEmergencyById; publish?: typeof broadcast;
} = {}) {
  const mode = options.mode || 'demo';
  const lookup = options.getEmergency || getEmergencyById;
  const publish = options.publish || broadcast;
  const histories = new Map<string, StoredVital[]>();
  const writing = new Set<string>();
  const pool = mode === 'measured' && options.databaseUrl ? new Pool({ connectionString: options.databaseUrl, max: 3, connectionTimeoutMillis: 5000, statement_timeout: 5000 }) : null;
  const check = (id: string, transit = false) => {
    const emergency = lookup(id);
    if (!emergency) throw new VitalsError(404, 'Emergency not found');
    if (transit && !isInTransit(emergency.status)) throw new VitalsError(409, 'Vitals are accepted only IN_TRANSIT (EN_ROUTE_TO_HOSPITAL)');
    return emergency;
  };
  return {
    mode,
    async init() {
      if (mode === 'measured' && !pool) throw new Error('Measured vitals require DATABASE_URL; refusing an in-memory fallback');
      if (pool) await pool.query(`CREATE TABLE IF NOT EXISTS emergency_vitals (
        id UUID PRIMARY KEY, emergency_id TEXT NOT NULL, received_at TIMESTAMPTZ NOT NULL,
        reading JSONB NOT NULL CHECK (reading->>'source' = 'measured'))`);
      if (pool) await pool.query('CREATE INDEX IF NOT EXISTS emergency_vitals_recent ON emergency_vitals (emergency_id, received_at DESC, id DESC)');
    },
    async append(emergencyId: string, input: unknown, demoRequest: boolean): Promise<StoredVital> {
      check(emergencyId, true);
      const reading = validateReading(input);
      if (mode === 'demo' && (reading.source !== 'demo' || !demoRequest)) throw new VitalsError(403, 'Demo mode accepts only explicit demo readings with X-Demo-Mode: true');
      if (mode === 'measured' && (reading.source !== 'measured' || demoRequest)) throw new VitalsError(403, 'Measured mode rejects demo readings and demo requests');
      if (writing.has(emergencyId)) throw new VitalsError(429, 'A reading is already being saved; wait for completion');
      writing.add(emergencyId);
      try {
        const stored: StoredVital = { ...reading, id: randomUUID(), emergencyId, receivedAt: new Date().toISOString() };
        if (mode === 'demo') {
          if (!histories.has(emergencyId) && histories.size >= 100) histories.delete(histories.keys().next().value!);
          histories.set(emergencyId, [...(histories.get(emergencyId) || []), stored].slice(-120));
          return stored; // Never publish simulated readings onto real-time clinical channels.
        }
        if (!pool) throw new VitalsError(503, 'Measured storage unavailable');
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('INSERT INTO emergency_vitals (id, emergency_id, received_at, reading) VALUES ($1,$2,$3,$4::jsonb)',
            [stored.id, emergencyId, stored.receivedAt, JSON.stringify(reading)]);
          await client.query(`DELETE FROM emergency_vitals WHERE emergency_id = $1 AND id NOT IN
            (SELECT id FROM emergency_vitals WHERE emergency_id = $1 ORDER BY received_at DESC, id DESC LIMIT 120)`, [emergencyId]);
          check(emergencyId, true);
          await client.query('COMMIT');
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
        const emergency = lookup(emergencyId);
        if (emergency && isInTransit(emergency.status)) {
          // Preserve the existing EMERGENCY_UPDATE data shape and raw WS envelope.
          const data = { ...emergency, event: 'VITALS_READING', vitals: stored };
          for (const facilityId of new Set([emergency.originFacilityId, emergency.destinationFacilityId].filter((id): id is string => Boolean(id)))) {
            publish({ type: 'EMERGENCY_UPDATE', facilityId, data, timestamp: stored.receivedAt });
          }
        }
        return stored;
      } finally { writing.delete(emergencyId); }
    },
    async history(emergencyId: string, limit: number, demoRequest: boolean): Promise<StoredVital[]> {
      check(emergencyId);
      if (!Number.isInteger(limit) || limit < 1 || limit > 120) throw new VitalsError(400, 'limit must be an integer from 1 to 120');
      if (demoRequest !== (mode === 'demo')) throw new VitalsError(403, 'Demo and measured histories are separate');
      if (mode === 'demo') return (histories.get(emergencyId) || []).slice(-limit).map(row => ({ ...row }));
      if (!pool) throw new VitalsError(503, 'Measured storage unavailable');
      const result = await pool.query('SELECT id, emergency_id, received_at, reading FROM emergency_vitals WHERE emergency_id = $1 ORDER BY received_at DESC, id DESC LIMIT $2', [emergencyId, limit]);
      return result.rows.reverse().map(row => ({ ...row.reading, id: row.id, emergencyId: row.emergency_id, receivedAt: row.received_at.toISOString() }));
    },
    async close() { histories.clear(); if (pool) await pool.end(); },
  };
}
