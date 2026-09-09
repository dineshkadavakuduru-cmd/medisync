import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtempSync, rmSync, mkdirSync, renameSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { FastifyInstance } from 'fastify';

const directory = mkdtempSync(join(tmpdir(), 'medisync-server-test-'));
process.env.DIAGNOSTICS_STORE_PATH = join(directory, 'diagnostics.json');
process.env.REFERRALS_STORE_PATH = join(directory, 'referrals.json');
process.env.TELECONSULT_STORE_PATH = join(directory, 'teleconsult.json');
process.env.DATABASE_URL = '';
process.env.VITALS_MODE = 'demo';
process.env.ENABLE_SIMULATOR = 'false';
process.env.GEMINI_API_KEY = '';
const { buildServer } = await import('../src/server.js');
const { FileStore } = await import('../src/database/fileStore.js');
const diagnostics = await import('../src/services/diagnosticsService.js');
const { SYMPTOM_DATABASE, getRecommendedDiagnostics } = await import('../src/services/triageService.js');
const { emergencies, sendSMS, sendPushNotification, dispatchEmergencyAlert } = await import('../src/services/emergencyService.js');
const { createVitalsService } = await import('../src/services/vitalsService.js');
let app: FastifyInstance;
const orderBody = { patientId: 'patient-1', facilityId: 'facility-2', tests: ['cbc', 'blood_sugar'], orderedBy: 'tester' };
const referralBody = { patientId: 'patient-1', fromFacilityId: 'facility-2', symptoms: ['cough'], patientAge: 30, patientGender: 'MALE' };
const post = (url: string, payload: unknown, key?: string) => app.inject({ method: 'POST', url, payload: payload as object, headers: key !== undefined ? { 'Idempotency-Key': key } : {} });
async function newOrder() {
  const response = await post('/api/diagnostics/orders', orderBody);
  assert.equal(response.statusCode, 201, response.body);
  return response.json().data;
}
const status = (id: string, value: string, key?: string) => app.inject({ method: 'PATCH', url: `/api/diagnostics/orders/${id}/status`, payload: { status: value }, headers: key !== undefined ? { 'Idempotency-Key': key } : {} });
const result = (id: string, payload: object, key?: string) => app.inject({ method: 'PATCH', url: `/api/diagnostics/orders/${id}/result`, payload, headers: key !== undefined ? { 'Idempotency-Key': key } : {} });
const cbc = { testCode: 'cbc', value: 'WBC 12000/uL, platelets 110000/uL', unit: '', flag: 'ABNORMAL' };

before(async () => { app = await buildServer(); });
after(async () => { await app?.close(); rmSync(directory, { recursive: true, force: true }); });

test('no-DB demo boot registers vitals and exposes unconfigured providers', async () => {
  const health = await app.inject('/');
  assert.equal(health.statusCode, 200);
  assert.equal(health.json().authentication, 'unconfigured');
  assert.equal(app.hasRoute({ method: 'POST', url: '/api/emergencies/:id/vitals' }), true);
  assert.equal((await app.inject('/api/emergencies/absent/vitals')).statusCode, 404);
  assert.equal((await app.inject('/api/diagnostics/orders')).json().data.length, 0);
});

test('diagnostic validation rejects invalid catalogue, duplicate codes, types and extras', async () => {
  for (const body of [null, {}, { ...orderBody, tests: [] }, { ...orderBody, tests: ['unknown'] },
    { ...orderBody, tests: ['cbc', 'cbc'] }, { ...orderBody, tests: 'cbc' }, { ...orderBody, priority: 'FAST' },
    { ...orderBody, orderedBy: ' ' }, { ...orderBody, facilityId: 'missing' }, { ...orderBody, extra: true },
    { ...orderBody, notes: 'x'.repeat(2001) }]) {
    assert.equal((await post('/api/diagnostics/orders', body)).statusCode, 400, JSON.stringify(body));
  }
  assert.equal((await post('/api/diagnostics/orders', { ...orderBody, notes: 'x'.repeat(17000) })).statusCode, 413);
  assert.equal((await app.inject('/api/diagnostics/orders?status=UNKNOWN')).statusCode, 400);
  assert.equal((await app.inject('/api/diagnostics/orders?extra=true')).statusCode, 400);
});

test('every triage recommendation exists in the diagnostics catalogue', () => {
  const codes = new Set(diagnostics.getTestsCatalog().map(test => test.code));
  for (const symptom of Object.keys(SYMPTOM_DATABASE)) {
    for (const code of getRecommendedDiagnostics([symptom])) assert.ok(codes.has(code), `${symptom}: ${code}`);
  }
});

test('diagnostics require collection and actual unique ordered results, never fabricate completion', async () => {
  const order = await newOrder();
  assert.deepEqual(order.results, []);
  assert.equal((await status(order.id, 'IN_PROGRESS')).statusCode, 409);
  assert.equal((await status(order.id, 'COMPLETED')).statusCode, 409);
  assert.equal((await result(order.id, cbc)).statusCode, 409);
  assert.equal((await status(order.id, 'SAMPLE_COLLECTED')).statusCode, 200);
  assert.equal((await status(order.id, 'ORDERED')).statusCode, 409);
  assert.equal((await status(order.id, 'IN_PROGRESS')).statusCode, 200);
  assert.equal((await status(order.id, 'COMPLETED')).statusCode, 409);
  assert.equal((await result(order.id, { ...cbc, testCode: 'ecg' })).statusCode, 400);
  assert.equal((await result(order.id, { ...cbc, value: 'Not yet added' })).statusCode, 400);
  assert.equal((await result(order.id, { ...cbc, value: ' ' })).statusCode, 400);
  assert.equal((await result(order.id, { ...cbc, flag: 'OK' })).statusCode, 400);
  assert.equal((await result(order.id, { ...cbc, extra: 1 })).statusCode, 400);
  const partial = await result(order.id, cbc);
  assert.equal(partial.json().data.status, 'IN_PROGRESS');
  assert.equal((await result(order.id, cbc)).statusCode, 409);
  assert.equal((await status(order.id, 'COMPLETED')).statusCode, 409);
  const completed = await result(order.id, { testCode: 'blood_sugar', value: '118', unit: 'mg/dL', flag: 'ABNORMAL' });
  assert.equal(completed.json().data.status, 'COMPLETED');
  assert.equal(completed.json().data.results.length, 2);
  assert.ok(completed.json().data.completedAt);
  assert.equal((await status(order.id, 'COMPLETED')).statusCode, 200);
  assert.equal((await status(order.id, 'CANCELLED')).statusCode, 409);
  assert.equal((await result(order.id, cbc)).statusCode, 409);
});

test('all diagnostic state pairs obey the transition matrix', () => {
  const states = ['ORDERED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
  const allowed = new Set(['ORDERED:SAMPLE_COLLECTED', 'ORDERED:CANCELLED', 'SAMPLE_COLLECTED:IN_PROGRESS', 'SAMPLE_COLLECTED:CANCELLED', 'IN_PROGRESS:CANCELLED']);
  for (const from of states) for (const to of states) {
    const order = diagnostics.createOrder(orderBody);
    if (from !== 'ORDERED') diagnostics.updateOrderStatus(order.id, 'SAMPLE_COLLECTED');
    if (from === 'IN_PROGRESS' || from === 'COMPLETED') diagnostics.updateOrderStatus(order.id, 'IN_PROGRESS');
    if (from === 'COMPLETED') {
      diagnostics.addTestResult(order.id, 'cbc', cbc.value, '', 'ABNORMAL');
      diagnostics.addTestResult(order.id, 'blood_sugar', '118', 'mg/dL', 'ABNORMAL');
    }
    if (from === 'CANCELLED') diagnostics.updateOrderStatus(order.id, 'CANCELLED');
    if (from === to || allowed.has(`${from}:${to}`)) assert.equal(diagnostics.updateOrderStatus(order.id, to)?.status, to);
    else assert.throws(() => diagnostics.updateOrderStatus(order.id, to), error => (error as { statusCode: number }).statusCode === 409);
  }
});

test('diagnostic POST retries are concurrent-safe, reject mismatched payloads, and preserve original response', async () => {
  const responses = await Promise.all(Array.from({ length: 8 }, () => post('/api/diagnostics/orders', orderBody, 'dx-retry')));
  assert.ok(responses.every(response => response.statusCode === 201));
  assert.equal(new Set(responses.map(response => response.json().data.id)).size, 1);
  assert.equal(responses.filter(response => response.headers['idempotency-replayed'] === 'false').length, 1);
  const initial = responses[0].json();
  await status(initial.data.id, 'SAMPLE_COLLECTED');
  const replay = await post('/api/diagnostics/orders', { orderedBy: 'tester', tests: ['cbc', 'blood_sugar'], facilityId: 'facility-2', patientId: 'patient-1', priority: 'ROUTINE' }, 'dx-retry');
  assert.deepEqual(replay.json(), initial);
  assert.equal((await post('/api/diagnostics/orders', { ...orderBody, patientId: 'other' }, 'dx-retry')).statusCode, 409);
  for (const key of ['', 'x'.repeat(129), 'contains space']) assert.equal((await post('/api/diagnostics/orders', orderBody, key)).statusCode, 400);
});

test('diagnostic list filters intersect instead of silently ignoring status or facility', async () => {
  const order = await newOrder();
  await status(order.id, 'CANCELLED');
  const rows = (await app.inject('/api/diagnostics/orders?patientId=patient-1&facilityId=facility-2&status=CANCELLED')).json().data;
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row: { patientId: string; facilityId: string; status: string }) => row.patientId === 'patient-1' && row.facilityId === 'facility-2' && row.status === 'CANCELLED'));
});

test('result and status PATCH receipts replay after completion without changing the completed record', async () => {
  const order = await newOrder();
  const collected = await status(order.id, 'SAMPLE_COLLECTED', 'patch-collected');
  const partial = await result(order.id, cbc, 'patch-partial');
  const finalBody = { testCode: 'blood_sugar', value: '118', unit: 'mg/dL', flag: 'ABNORMAL' };
  const completed = await result(order.id, finalBody, 'patch-complete');
  assert.equal(completed.json().data.status, 'COMPLETED');
  for (const [original, retry] of [
    [collected, await status(order.id, 'SAMPLE_COLLECTED', 'patch-collected')],
    [partial, await result(order.id, cbc, 'patch-partial')],
    [completed, await result(order.id, finalBody, 'patch-complete')],
  ]) {
    assert.equal(original.statusCode, 200, original.body);
    assert.equal(original.headers['idempotency-replayed'], 'false');
    assert.equal(retry.statusCode, 200, retry.body);
    assert.equal(retry.headers['idempotency-replayed'], 'true');
    assert.deepEqual(retry.json(), original.json());
  }
  assert.deepEqual((await app.inject(`/api/diagnostics/orders/${order.id}`)).json(), completed.json());
  assert.equal((await status(order.id, 'CANCELLED', 'patch-collected')).statusCode, 409);
  assert.equal((await result(order.id, { ...cbc, value: 'Changed result' }, 'patch-partial')).statusCode, 409);
  assert.equal((await result(order.id, finalBody, 'patch-collected')).statusCode, 409);
  const other = await newOrder();
  assert.equal((await status(other.id, 'SAMPLE_COLLECTED', 'patch-collected')).statusCode, 409);
  assert.equal((await post('/api/diagnostics/orders', orderBody, 'patch-partial')).statusCode, 409);
});

test('concurrent result PATCHes preserve both mutations and duplicate requests share one receipt', async () => {
  const order = await newOrder();
  const collected = await Promise.all(Array.from({ length: 4 }, () => status(order.id, 'SAMPLE_COLLECTED', 'parallel-status')));
  assert.ok(collected.every(response => response.statusCode === 200));
  assert.equal(collected.filter(response => response.headers['idempotency-replayed'] === 'false').length, 1);
  const requests = await Promise.all([
    result(order.id, cbc, 'parallel-cbc'),
    result(order.id, { testCode: 'blood_sugar', value: '118', unit: 'mg/dL', flag: 'ABNORMAL' }, 'parallel-glucose'),
    result(order.id, cbc, 'parallel-cbc'),
  ]);
  assert.ok(requests.every(response => response.statusCode === 200));
  assert.deepEqual(requests[0].json(), requests[2].json());
  const current = (await app.inject(`/api/diagnostics/orders/${order.id}`)).json().data;
  assert.equal(current.status, 'COMPLETED');
  assert.deepEqual(current.results.map((row: { testCode: string }) => row.testCode).sort(), ['blood_sugar', 'cbc']);
});

test('failed or malformed PATCH requests do not consume replay keys', async () => {
  const order = await newOrder();
  for (const key of ['', 'with space', 'x'.repeat(129)]) {
    assert.equal((await status(order.id, 'SAMPLE_COLLECTED', key)).statusCode, 400);
    assert.equal((await result(order.id, cbc, key)).statusCode, 400);
  }
  assert.equal((await status(order.id, 'IN_PROGRESS', 'retry-transition')).statusCode, 409);
  assert.equal((await result(order.id, cbc, 'retry-result')).statusCode, 409);
  await status(order.id, 'SAMPLE_COLLECTED');
  assert.equal((await status(order.id, 'IN_PROGRESS', 'retry-transition')).headers['idempotency-replayed'], 'false');
  assert.equal((await result(order.id, cbc, 'retry-result')).headers['idempotency-replayed'], 'false');
});

test('PATCH persistence failures commit neither mutation nor receipt; retry commits both together', async () => {
  const order = await newOrder();
  const path = process.env.DIAGNOSTICS_STORE_PATH!;
  for (const [operation, body, key] of [
    ['status', { status: 'SAMPLE_COLLECTED' }, 'atomic-status'],
    ['result', cbc, 'atomic-result'],
  ] as const) {
    const before = diagnostics.getOrder(order.id);
    renameSync(path, `${path}.backup`);
    mkdirSync(path); // Force atomic rename to fail, without altering the original file.
    try {
      const failed = await app.inject({ method: 'PATCH', url: `/api/diagnostics/orders/${order.id}/${operation}`, payload: body, headers: { 'Idempotency-Key': key } });
      assert.equal(failed.statusCode, 503, failed.body);
      assert.deepEqual(diagnostics.getOrder(order.id), before);
      assert.equal(JSON.parse(readFileSync(`${path}.backup`, 'utf8')).replays.some((row: { key: string }) => row.key === key), false);
    } finally {
      rmSync(path, { recursive: true });
      renameSync(`${path}.backup`, path);
    }
    const saved = await app.inject({ method: 'PATCH', url: `/api/diagnostics/orders/${order.id}/${operation}`, payload: body, headers: { 'Idempotency-Key': key } });
    assert.equal(saved.statusCode, 200, saved.body);
    assert.equal(saved.headers['idempotency-replayed'], 'false');
    const disk = JSON.parse(readFileSync(path, 'utf8'));
    assert.deepEqual(disk.records.find((row: { id: string }) => row.id === order.id), saved.json().data);
    assert.deepEqual(disk.replays.find((row: { key: string }) => row.key === key).data, saved.json().data);
  }
});

test('triage returns recommendations without unsolicited diagnostic orders even on retry', async () => {
  const before = diagnostics.getAllOrders();
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await post('/api/triage', { patientId: 'patient-1', symptoms: ['high_fever'], patientAge: 30, patientGender: 'MALE' });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(response.json().data.recommendedDiagnostics.includes('cbc'));
  }
  assert.deepEqual(diagnostics.getAllOrders(), before);
});

test('referrals validate bodies, vitals, status and query strictly', async () => {
  for (const body of [{}, { ...referralBody, patientAge: '30' }, { ...referralBody, patientAge: 121 },
    { ...referralBody, patientGender: 'invalid' }, { ...referralBody, symptoms: [] }, { ...referralBody, symptoms: [' '] },
    { ...referralBody, fromFacilityId: 'unknown' }, { ...referralBody, vitalSigns: { heartRate: '90' } },
    { ...referralBody, vitalSigns: { bloodPressureSystolic: 120 } }, { ...referralBody, vitalSigns: { bloodPressureSystolic: 80, bloodPressureDiastolic: 90 } },
    { ...referralBody, extra: true }]) assert.equal((await post('/api/referrals', body)).statusCode, 400);
  const created = await post('/api/referrals', referralBody);
  assert.equal(created.statusCode, 200, created.body);
  assert.equal((await app.inject({ method: 'PATCH', url: `/api/referrals/${created.json().data.id}/status`, payload: { status: 'invalid' } })).statusCode, 400);
  assert.equal((await app.inject('/api/referrals?status=invalid')).statusCode, 400);
});

test('referral POST replays create one record and conflict on changed payloads', async () => {
  const responses = await Promise.all(Array.from({ length: 8 }, () => post('/api/referrals', referralBody, 'ref-retry')));
  assert.ok(responses.every(response => response.statusCode === 200));
  assert.equal(new Set(responses.map(response => response.json().data.id)).size, 1);
  assert.equal(responses.filter(response => response.headers['idempotency-replayed'] === 'false').length, 1);
  assert.equal((await post('/api/referrals', { ...referralBody, patientAge: 31 }, 'ref-retry')).statusCode, 409);
  const id = responses[0].json().data.id;
  assert.equal((await app.inject({ method: 'PATCH', url: `/api/referrals/${id}/status`, payload: { status: 'ACCEPTED' } })).statusCode, 200);
  assert.deepEqual((await post('/api/referrals', referralBody, 'ref-retry')).json(), responses[0].json());
  assert.equal((await app.inject(`/api/referrals/${id}`)).json().data.status, 'ACCEPTED');
});

test('POST and diagnostic PATCH receipts and mutations survive a separate process restart', () => {
  for (const mode of ['create', 'replay']) {
    const child = spawnSync(process.execPath, ['--import', 'tsx', 'test/restart-fixture.ts', mode], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 30000,
      env: { ...process.env, DIAGNOSTICS_STORE_PATH: join(directory, 'restart-dx.json'), REFERRALS_STORE_PATH: join(directory, 'restart-ref.json') },
    });
    assert.equal(child.status, 0, child.stderr + child.stdout);
  }
});

test('failed persistence returns 503 and does not leave an entity or consume its replay key', async () => {
  const path = join(directory, 'blocker');
  const blocker = new FileStore<{ id: string }>(path);
  blocker.save({ id: 'blocker' });
  const store = new FileStore<{ id: string }>(join(path, 'unwritable.json'));
  await assert.rejects(store.transact('retry', {}, () => ({ id: 'failed' })), error => (error as { statusCode: number }).statusCode === 503);
  assert.deepEqual(store.all(), []);
  rmSync(path);
  const saved = await store.transact('retry', {}, () => ({ id: 'saved' }));
  assert.equal(saved.replayed, false);
  assert.deepEqual(new FileStore<{ id: string }>(join(path, 'unwritable.json')).get('saved'), { id: 'saved' });
});

test('in-flight replay waits for the same operation and conflicts before another factory runs', async () => {
  const store = new FileStore<{ id: string }>(join(directory, 'pending.json'));
  let release!: (value: { id: string }) => void;
  let calls = 0;
  const first = store.transact('pending', { value: 1 }, () => {
    calls++;
    return new Promise(resolve => { release = resolve; });
  });
  await Promise.resolve();
  const duplicate = store.transact('pending', { value: 1 }, () => { throw new Error('Must not run'); });
  await assert.rejects(store.transact('pending', { value: 2 }, () => { throw new Error('Must not run'); }), error => (error as { statusCode: number }).statusCode === 409);
  release({ id: 'one' });
  assert.equal((await first).replayed, false);
  assert.equal((await duplicate).replayed, true);
  assert.equal(calls, 1);
});

test('auth and ABDM never issue tokens, fabricate identity, or claim OTP delivery', async () => {
  for (const [url, payload] of [
    ['/api/auth/login', { phone: '9876543210' }], ['/api/auth/verify-otp', { phone: '9876543210', otp: '123456' }],
    ['/api/abdm/verify/12345678901234', undefined], ['/api/abdm/generate-otp/12345678901234', undefined],
    ['/api/abdm/verify-otp', { txnId: 'transaction', otp: '123456' }],
  ] as const) {
    const response = await post(url, payload);
    assert.equal(response.statusCode, 503, response.body);
    const body = response.json();
    assert.equal(body.success, false);
    assert.equal((body.data || body).mode, 'unconfigured');
    assert.equal(body.token, undefined);
    assert.equal(body.data?.token, undefined);
    assert.equal(body.data?.name, undefined);
    assert.equal(body.data?.txnId, undefined);
  }
  assert.equal((await post('/api/auth/login', { phone: 9876543210 })).statusCode, 400);
  assert.equal((await post('/api/auth/verify-otp', { phone: '9876543210', otp: 'abcdef' })).statusCode, 400);
  assert.equal((await post('/api/abdm/verify/bad', undefined)).statusCode, 400);
});

test('consents are explicitly non-binding demo records with bounded strict input', async () => {
  const body = { patientAbhaId: '12345678901234', patientName: 'Test', requesterId: 'tester', requesterName: 'Test', purpose: 'Demo', dataRequested: ['records'], validFrom: '2026-09-01T00:00:00Z', validTo: '2026-09-10T00:00:00Z' };
  const response = await post('/api/abdm/consent', body);
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().data.mode, 'demo');
  assert.equal(response.json().data.legallyValid, false);
  assert.equal((await post('/api/abdm/consent', { ...body, validTo: body.validFrom })).statusCode, 400);
  assert.equal((await app.inject({ method: 'PATCH', url: `/api/abdm/consent/${response.json().data.id}/status`, payload: { status: 'fake' } })).statusCode, 400);
});

test('notification stubs never claim external delivery or fabricate provider message IDs', async () => {
  const payload = { title: 'Test', body: 'Test', priority: 'high' as const, data: { type: 'GENERAL' as const }, recipients: [] };
  for (const result of [await sendSMS('9876543210', 'Test'), await sendPushNotification(payload)]) {
    assert.equal(result.success, false); assert.equal(result.delivered, false); assert.equal(result.mode, 'unconfigured');
    assert.equal('messageId' in result, false);
  }
  const dispatch = await dispatchEmergencyAlert([...emergencies.values()][0], [], []);
  assert.equal(dispatch.deliveryConfirmed, false);
  assert.equal(dispatch.recipientCount, 0);
  assert.deepEqual(dispatch.channels, ['WebSocket']);
});

test('vitals demo API enforces mode, time, ranges, transit and bounded history', async () => {
  const emergency = [...emergencies.values()][0];
  emergency.status = 'EN_ROUTE_TO_HOSPITAL';
  const url = `/api/emergencies/${emergency.id}/vitals`;
  const reading = { source: 'demo', measuredAt: new Date().toISOString(), heartRate: 80 };
  const headers = { 'X-Demo-Mode': 'true' };
  assert.equal((await post(url, reading)).statusCode, 403);
  const valid = await app.inject({ method: 'POST', url, payload: reading, headers });
  assert.equal(valid.statusCode, 201, valid.body);
  for (const payload of [{ ...reading, heartRate: '80' }, { ...reading, source: 'measured' }, { ...reading, heartRate: 301 },
    { ...reading, measuredAt: '2000-01-01T00:00:00Z' }, { ...reading, bloodPressureSystolic: 120 }, { ...reading, extra: true }]) {
    assert.ok([400, 403].includes((await app.inject({ method: 'POST', url, payload, headers })).statusCode));
  }
  assert.equal((await app.inject({ url: `${url}?limit=121`, headers })).statusCode, 400);
  assert.equal((await app.inject({ url: `${url}?limit=1&extra=x`, headers })).statusCode, 400);
  assert.equal((await app.inject(url)).statusCode, 403);
  const history = await app.inject({ url: `${url}?limit=1`, headers });
  assert.equal(history.json().data.length, 1);
  assert.equal(history.json().mode, 'demo');
  emergency.status = 'ARRIVED';
  assert.equal((await app.inject({ method: 'POST', url, payload: reading, headers })).statusCode, 409);
});

test('measured vitals without DB fail closed, never silently downgrade', async () => {
  const service = createVitalsService({ mode: 'measured' });
  await assert.rejects(service.init(), /require DATABASE_URL/);
  await service.close();
});

test('prescription types, persistence and strict medication validation work', async () => {
  const response = await post('/api/teleconsult/sessions', { patientId: 'patient-1', patientName: 'Test', doctorId: 'doc-1', fromFacilityId: 'facility-2', scheduledTime: '2026-09-10T10:00:00Z' });
  assert.equal(response.statusCode, 201, response.body);
  const body = { sessionId: response.json().data.id, patientId: 'patient-1', doctorId: 'doc-1', medications: [{ name: 'Test medicine', dosage: 'Test only', frequency: 'Test only', duration: 'Test only' }] };
  const prescription = await post('/api/teleconsult/prescriptions', body);
  assert.equal(prescription.statusCode, 201, prescription.body);
  assert.deepEqual((await app.inject(`/api/teleconsult/prescriptions/session/${body.sessionId}`)).json().data, prescription.json().data);
  assert.equal((await post('/api/teleconsult/prescriptions', { ...body, medications: [{ ...body.medications[0], extra: 1 }] })).statusCode, 400);
  assert.equal((await post('/api/teleconsult/prescriptions', { ...body, medications: [{ ...body.medications[0], name: ' ' }] })).statusCode, 400);
});
