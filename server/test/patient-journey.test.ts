import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import Fastify from 'fastify';

const directory = mkdtempSync(join(tmpdir(), 'medisync-patient-test-'));
process.env.PATIENTS_STORE_PATH = join(directory, 'patients.json');
process.env.TELECONSULT_STORE_PATH = join(directory, 'teleconsult.json');
const { default: patientsRoutes } = await import('../src/routes/patients.js');
const { default: teleconsultRoutes } = await import('../src/routes/teleconsult.js');
const { createPatientRepository } = await import('../src/services/patientRepository.js');
const tc = await import('../src/services/teleconsultService.js');
const app = Fastify();
await app.register(patientsRoutes);
await app.register(teleconsultRoutes);
after(async () => { await app.close(); rmSync(directory, { recursive: true, force: true }); });
const input = { name: 'Synthetic Patient', age: 28, gender: 'FEMALE', phone: '9000000000', village: 'Test village', district: 'Test district', languagePreference: 'mr', trimester: 2, lastVisit: '2026-09-01', nextVisitDate: '2026-10-01' };
const post = (url: string, payload: object, key?: string) => app.inject({ method: 'POST', url, payload, headers: key ? { 'Idempotency-Key': key } : {} });

test('empty live store has no fabricated patients, records or ABHA; concurrent creates replay', async () => {
  assert.deepEqual((await app.inject('/api/patients')).json().data, []);
  const responses = await Promise.all(Array.from({ length: 5 }, () => post('/api/patients', input, 'patient-replay')));
  assert.ok(responses.every(r => r.statusCode === 201));
  assert.equal(new Set(responses.map(r => r.json().data.id)).size, 1);
  assert.equal(responses.filter(r => r.headers['idempotency-replayed'] === 'false').length, 1);
  const p = responses[0].json().data;
  assert.equal(p.abhaId, '');
  assert.match(p.id, /^patient-/);
  assert.equal(p.trimester, 2);
  assert.deepEqual((await app.inject(`/api/patients/${p.id}/records`)).json().data, []);
  assert.deepEqual((await app.inject(`/api/patients/${p.id}/prescriptions`)).json().data, []);
  assert.equal((await post('/api/patients', { ...input, age: 29 }, 'patient-replay')).statusCode, 409);
  assert.equal((await app.inject('/api/patients/absent/records')).statusCode, 404);
  assert.equal((await app.inject('/api/patients/absent/prescriptions')).statusCode, 404);
});

test('strict patient and optional ANC validation', async () => {
  for (const invalid of [{ age: '28' }, { age: -1 }, { age: 131 }, { age: 1.5 }, { name: ' ' },
    { gender: 'unknown' }, { phone: '123' }, { trimester: 0 }, { trimester: 4 }, { trimester: '2' },
    { nextVisitDate: '2026-02-30' }, { lastVisit: '2026-11-01' }, { nextVisitDate: null },
    { abhaId: 'ABHA-PN-FAKE' }, { extra: true }, { id: 'client-chosen' }]) {
    assert.equal((await post('/api/patients', { ...input, ...invalid })).statusCode, 400, JSON.stringify(invalid));
  }
  const withoutAnc = { name: input.name, age: input.age, gender: input.gender, phone: input.phone, village: input.village, district: input.district, languagePreference: input.languagePreference };
  assert.equal((await post('/api/patients', withoutAnc)).statusCode, 201);
  assert.equal((await app.inject('/api/patients?unsupported=true')).statusCode, 400);
});

test('records persist with replay and cannot override the route patient ID', async () => {
  const p = (await post('/api/patients', input, 'record-patient')).json().data;
  const record = { facilityId: 'facility-2', visitDate: '2026-09-09', doctorName: 'Test doctor', diagnosis: 'Recorded assessment', notes: 'Actual saved note' };
  const created = await post(`/api/patients/${p.id}/records`, record, 'record-key');
  assert.equal(created.statusCode, 201, created.body);
  assert.equal((await post(`/api/patients/${p.id}/records`, { ...record, patientId: 'someone-else' })).statusCode, 400);
  const reopened = createPatientRepository(process.env.PATIENTS_STORE_PATH);
  assert.deepEqual(reopened.get(p.id), p);
  assert.deepEqual(reopened.records(p.id), [created.json().data]);
  assert.equal((await reopened.addRecord(p.id, record, 'record-key')).replayed, true);
});

test('Rx creation rejects patient/doctor mismatch and unlinked sessions, exposes only saved matching Rx', async () => {
  const p = (await post('/api/patients', input, 'rx-patient')).json().data;
  const other = (await post('/api/patients', input, 'rx-other-patient')).json().data;
  const session = tc.createSession({ patientId: p.id, patientName: p.name, fromFacilityId: 'facility-2', doctorId: 'doc-1', scheduledTime: '2026-09-10T10:00:00Z' });
  const body = { sessionId: session.id, patientId: p.id, doctorId: 'doc-1', medications: [{ name: 'Recorded medicine', dosage: 'Recorded dose', frequency: 'Recorded frequency', duration: 'Recorded duration' }] };
  assert.equal((await post('/api/teleconsult/prescriptions', { ...body, patientId: other.id })).statusCode, 400);
  assert.equal((await post('/api/teleconsult/prescriptions', { ...body, doctorId: 'doc-2' })).statusCode, 400);
  assert.equal(tc.getPrescriptionBySession(session.id), undefined);
  const unlinked = tc.createSession({ patientName: p.name, fromFacilityId: 'facility-2', doctorId: 'doc-1', scheduledTime: '2026-09-10T11:00:00Z' });
  assert.equal((await post('/api/teleconsult/prescriptions', { ...body, sessionId: unlinked.id })).statusCode, 400);
  const saved = await post('/api/teleconsult/prescriptions', body);
  assert.equal(saved.statusCode, 201, saved.body);
  const journey = (await app.inject(`/api/patients/${p.id}/prescriptions`)).json().data;
  assert.equal(journey.length, 1);
  assert.equal(journey[0].id, saved.json().data.id);
  assert.equal(journey[0].sessionStatus, 'REQUESTED'); // Never invent completion or dispensing.
  assert.deepEqual((await app.inject(`/api/patients/${other.id}/prescriptions`)).json().data, []);
  assert.equal((await post('/api/teleconsult/prescriptions', body)).statusCode, 400);
  const detached = tc.getSession(session.id)!;
  detached.prescription!.patientId = other.id;
  assert.equal(tc.getPrescriptionBySession(session.id)!.patientId, p.id);
});

test('patient create replay, records and prescription survive separate server processes', () => {
  const env = { ...process.env, PATIENTS_STORE_PATH: join(directory, 'restart-patients.json'), TELECONSULT_STORE_PATH: join(directory, 'restart-sessions.json') };
  for (const phase of ['create', 'replay']) {
    const child = spawnSync(process.execPath, ['--import', 'tsx', 'test/patient-restart-fixture.ts', phase], { env, encoding: 'utf8' });
    assert.equal(child.status, 0, child.stdout + child.stderr);
  }
  // Reopen the shipped array-format session store without losing its prescription.
  const current = JSON.parse(readFileSync(env.TELECONSULT_STORE_PATH, 'utf8'));
  writeFileSync(env.TELECONSULT_STORE_PATH, JSON.stringify(current.records));
  const migrated = spawnSync(process.execPath, ['--import', 'tsx', 'test/patient-restart-fixture.ts', 'replay'], { env, encoding: 'utf8' });
  assert.equal(migrated.status, 0, migrated.stdout + migrated.stderr);
  assert.ok(Array.isArray(JSON.parse(readFileSync(env.TELECONSULT_STORE_PATH, 'utf8')).records));
});

test('invalid file store is not silently reset', () => {
  const path = join(directory, 'corrupt.json');
  writeFileSync(path, 'not json');
  assert.throws(() => createPatientRepository(path).all(), /unavailable/);
});
