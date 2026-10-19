import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

const directory = mkdtempSync(join(tmpdir(), 'medisync-appointments-test-'));
process.env.TELECONSULT_STORE_PATH = join(directory, 'teleconsult.json');
process.env.DATABASE_URL = '';
process.env.VITALS_MODE = 'demo';
process.env.ENABLE_SIMULATOR = 'false';
process.env.GEMINI_API_KEY = '';
const { buildServer } = await import('../src/server.js');

const IST_OFFSET = 330 * 60_000;

// A weekday strictly in the future, so IST slot checks are deterministic.
function nextWeekdayIst(offsetStart: number): string {
  for (let offset = offsetStart; offset < offsetStart + 14; offset++) {
    const shifted = new Date(Date.now() + IST_OFFSET + offset * 86_400_000);
    const day = shifted.getUTCDay();
    if (day >= 1 && day <= 5) {
      return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
    }
  }
  throw new Error('No weekday found');
}

let app: FastifyInstance;
before(async () => { app = await buildServer(); });
after(async () => { await app?.close(); rmSync(directory, { recursive: true, force: true }); });

const post = (url: string, payload: unknown) => app.inject({ method: 'POST', url, payload: payload as object });

test('appointments reject malformed bodies, past times and off-schedule slots', async () => {
  const base = { patientId: 'patient-1', patientName: 'Test patient', facilityId: 'facility-2', doctorId: 'doc-1', type: 'OUTPATIENT', priority: 'GREEN' };
  assert.equal((await post('/api/appointments', { ...base, dateTime: '2030-01-01T09:00:00', extra: true })).statusCode, 400);
  assert.equal((await post('/api/appointments', { ...base, type: 'UNKNOWN', dateTime: '2030-01-01T09:00:00' })).statusCode, 400);
  assert.equal((await post('/api/appointments', { ...base, priority: 'BLUE', dateTime: '2030-01-01T09:00:00' })).statusCode, 400);
  assert.equal((await post('/api/appointments', { ...base, doctorId: undefined, dateTime: '2000-01-01T09:00:00' })).statusCode, 400);
  const date = nextWeekdayIst(1);
  assert.equal((await post('/api/appointments', { ...base, dateTime: `${date}T03:00:00` })).statusCode, 400);
  assert.equal((await post('/api/appointments', { ...base, facilityId: 'facility-unknown', dateTime: `${date}T09:00:00` })).statusCode, 400);
});

test('appointments enforce double-booking and reflect bookings in available slots', async () => {
  const date = nextWeekdayIst(1);
  const slots = (await app.inject(`/api/appointments/slots/facility-2/${date}?doctorId=doc-1`)).json().data.slots as string[];
  assert.ok(slots.length, 'expected available slots for a future weekday');
  const time = slots[0];
  const body = { patientId: 'patient-1', patientName: 'Test patient', facilityId: 'facility-2', doctorId: 'doc-1', dateTime: `${date}T${time}:00`, type: 'OUTPATIENT', priority: 'GREEN' };
  const first = await post('/api/appointments', body);
  assert.equal(first.statusCode, 201, first.body);
  assert.equal(first.json().data.status, 'BOOKED');
  assert.equal((await post('/api/appointments', body)).statusCode, 409, 'same slot must conflict');
  const after = (await app.inject(`/api/appointments/slots/facility-2/${date}?doctorId=doc-1`)).json().data.slots as string[];
  assert.ok(!after.includes(time), 'booked slot must disappear from availability');
});

test('teleconsult sessions reject unavailable future slots and double-booking', async () => {
  const date = nextWeekdayIst(1);
  const build = (time: string) => ({ patientName: 'Test patient', fromFacilityId: 'facility-2', doctorId: 'doc-1', scheduledTime: `${date}T${time}:00+05:30` });
  const invalid = await post('/api/teleconsult/sessions', build('22:00'));
  assert.equal(invalid.statusCode, 409, invalid.body);
  const valid = await post('/api/teleconsult/sessions', build('10:00'));
  assert.equal(valid.statusCode, 201, valid.body);
  const duplicate = await post('/api/teleconsult/sessions', build('10:00'));
  assert.equal(duplicate.statusCode, 409, duplicate.body);
});
