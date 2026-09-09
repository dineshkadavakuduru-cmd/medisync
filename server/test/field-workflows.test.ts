import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { mkdtempSync, rmSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { FileStore } from '../src/database/fileStore.js';
import { setInventory, type FieldRecord } from '../src/services/inventoryService.js';
import fieldWorkflowsRoutes from '../src/routes/fieldWorkflows.js';
import { createFieldWorkflows, type FieldWorkflowOptions } from '../src/services/fieldWorkflows.js';
import { createPatientRepository, patientRepository } from '../src/services/patientRepository.js';

const now = Date.parse('2026-09-09T12:00:00Z');
const base = { facilityId: 'f1', medicineId: 'm1', staffId: 'staff1', timestamp: new Date(now).toISOString() };
async function fixture(options: FieldWorkflowOptions = {}, path?: string) {
  const dir = path ? undefined : mkdtempSync(join(tmpdir(), 'field-workflows-'));
  const store = new FileStore<FieldRecord>(path || join(dir!, 'store.json'));
  setInventory('f1', [{ id: 'm1', facilityId: 'f1', name: 'Medicine', category: 'other', unit: 'tablets',
    currentStock: 10, minThreshold: 5, maxCapacity: 30, lastRestocked: base.timestamp, status: 'ADEQUATE' }], store);
  const app = Fastify();
  await app.register(fieldWorkflowsRoutes, { store, now: () => now, patientExists: id => id === 'p1', ...options });
  const post = (id: string, type: string, payload: unknown) => app.inject({ method: 'POST', url: '/api/field-workflows/actions',
    headers: { 'Idempotency-Key': id }, payload: { id, type, payload } });
  const inventory = async () => (await app.inject('/api/field-workflows/inventory?facilityId=f1')).json().data;
  return { app, store, post, inventory, async close() { await app.close(); if (dir) rmSync(dir, { recursive: true, force: true }); } };
}
const visit = { patientId: 'p1', ashaId: 'asha1', trimester: 1, checklist: { hb: '10', bp: '140/90' }, voiceNotes: '',
  reviewed: true, highRisk: true, requiresClinicianReview: true, highRiskFlags: ['hbReview', 'bpReview'],
  timestamp: base.timestamp, nextVisitDate: '2026-10-09' };

test('actual inject dispense is atomic, concurrent replay is once, conflict preserves stock and usage is confirmed only', async () => {
  const f = await fixture();
  try {
    const responses = await Promise.all([f.post('dispense1', 'DISPENSE_MEDICINE', { ...base, quantity: 7 }), f.post('dispense1', 'DISPENSE_MEDICINE', { ...base, quantity: 7 })]);
    responses.forEach(r => assert.equal(r.statusCode, 200, r.body));
    assert.equal(responses.filter(r => r.json().replayed).length, 1);
    assert.equal((await f.post('dispense1', 'DISPENSE_MEDICINE', { ...base, quantity: 6 })).statusCode, 409);
    assert.equal((await f.post('dispense2', 'DISPENSE_MEDICINE', { ...base, quantity: 4 })).statusCode, 400);
    const stock = await f.inventory();
    assert.equal(stock.stocks[0].currentStock, 3);
    assert.equal(stock.log.filter((l: any) => l.kind === 'dispense').length, 1);
    assert.equal(stock.usage[0].dailyAverage7, 1);
    assert.equal(stock.usage[0].dailyAverage30, 7 / 30);
    const competing = await Promise.all([f.post('other1', 'DISPENSE_MEDICINE', { ...base, quantity: 2 }), f.post('other2', 'DISPENSE_MEDICINE', { ...base, quantity: 2 })]);
    assert.deepEqual(competing.map(r => r.statusCode).sort(), [200, 400]);
    assert.equal((await f.inventory()).stocks[0].currentStock, 1);
  } finally { await f.close(); }
});

test('integer validation, capacity, unknown medicine and key contract fail without mutations; definite 400 can be corrected with new action', async () => {
  const f = await fixture();
  try {
    for (const quantity of [-1, 1.5, '2', Number.MAX_SAFE_INTEGER + 1]) {
      assert.equal((await f.post('invalid', 'DISPENSE_MEDICINE', { ...base, quantity })).statusCode, 400);
    }
    assert.equal((await f.post('bad-count', 'UPDATE_INVENTORY', { ...base, quantity: 31, newStock: 31, operation: 'physical_count' })).statusCode, 400);
    assert.equal((await f.post('unknown', 'DISPENSE_MEDICINE', { ...base, medicineId: 'missing', quantity: 1 })).statusCode, 400);
    const payload = { id: 'key', type: 'DISPENSE_MEDICINE', payload: { ...base, quantity: 1 } };
    assert.equal((await f.app.inject({ method: 'POST', url: '/api/field-workflows/actions', payload })).statusCode, 400);
    assert.equal((await f.app.inject({ method: 'POST', url: '/api/field-workflows/actions', headers: { 'Idempotency-Key': 'other' }, payload })).statusCode, 400);
    assert.equal((await f.inventory()).stocks[0].currentStock, 10);
    assert.equal((await f.post('correction', 'UPDATE_INVENTORY', { ...base, quantity: 0, newStock: 0, operation: 'physical_count' })).statusCode, 200);
    assert.equal((await f.inventory()).stocks[0].currentStock, 0);
    assert.equal((await f.post('zero-dispense', 'DISPENSE_MEDICINE', { ...base, quantity: 0 })).statusCode, 200);
  } finally { await f.close(); }
});

test('PO lifecycle retains history, rejects skipping, and stocks exactly once even using another key', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.post('po1', 'CREATE_INVENTORY_ORDER', { ...base, quantity: 15, status: 'PO' })).statusCode, 200);
    const transition = (id: string, status: string) => f.post(id, 'UPDATE_INVENTORY_ORDER', { facilityId: 'f1', orderId: 'po1', staffId: 'staff1', timestamp: base.timestamp, status });
    assert.equal((await transition('skip', 'STOCKED')).statusCode, 400);
    for (const status of ['APPROVED', 'ORDERED', 'RECEIVED', 'VERIFIED', 'STOCKED']) {
      assert.equal((await transition(status, status)).statusCode, 200);
      assert.equal((await transition(status, status)).json().replayed, true);
    }
    assert.equal((await transition('again', 'STOCKED')).statusCode, 400);
    const inventory = await f.inventory();
    assert.equal(inventory.stocks[0].currentStock, 25);
    assert.equal(inventory.orders[0].history.length, 6);
    assert.equal(inventory.log.filter((l: any) => l.kind === 'stock_order').length, 1);
    assert.equal(inventory.usage[0].total7, 0);
  } finally { await f.close(); }
});

test('STOCKED capacity rejection leaves order VERIFIED and original audit untouched', async () => {
  const f = await fixture();
  try {
    await f.post('po1', 'CREATE_INVENTORY_ORDER', { ...base, quantity: 25, status: 'PO' });
    for (const status of ['APPROVED', 'ORDERED', 'RECEIVED', 'VERIFIED', 'STOCKED']) {
      const r = await f.post(status, 'UPDATE_INVENTORY_ORDER', { facilityId: 'f1', orderId: 'po1', staffId: 'staff1', timestamp: base.timestamp, status });
      assert.equal(r.statusCode, status === 'STOCKED' ? 400 : 200, r.body);
    }
    const inventory = await f.inventory();
    assert.equal(inventory.stocks[0].currentStock, 10);
    assert.equal(inventory.orders[0].status, 'VERIFIED');
    assert.equal(inventory.orders[0].history.length, 5);
  } finally { await f.close(); }
});

test('actual 7/30 day averages exclude future and old logs, include older valid replayed dispense', async () => {
  const f = await fixture();
  try {
    for (const [id, age, quantity] of [['today', 0, 1], ['week', 8, 2], ['old', 31, 3]] as const) {
      assert.equal((await f.post(id, 'DISPENSE_MEDICINE', { ...base, quantity, timestamp: new Date(now - age * 86400000).toISOString() })).statusCode, 200);
    }
    const usage = (await f.inventory()).usage[0];
    assert.equal(usage.total7, 1); assert.equal(usage.total30, 3);
    assert.equal(usage.dailyAverage30, 0.1);
    assert.equal((await f.post('future', 'DISPENSE_MEDICINE', { ...base, quantity: 1, timestamp: '2099-01-01T00:00:00Z' })).statusCode, 400);
  } finally { await f.close(); }
});

test('visits validate reviewed measurements, preserve flags without referral, and retry failed patient projection', async () => {
  let fail = true;
  const projections: unknown[] = [];
  const f = await fixture({ projectPatientVisit(p) { if (fail) throw new Error('Store down'); projections.push(p); } });
  try {
    for (const patch of [{ reviewed: false }, { checklist: { hb: '10x' } }, { checklist: { bp: '80/120' } },
      { checklist: { weight: '501' } }, { nextVisitDate: '2026-02-30' }, { highRisk: false }, { patientId: 'missing' }]) {
      assert.equal((await f.post('bad', 'CREATE_ASHA_VISIT', { ...visit, ...patch })).statusCode, 400);
    }
    const saved = await f.post('visit1', 'CREATE_ASHA_VISIT', visit);
    assert.equal(saved.statusCode, 200, saved.body);
    assert.equal(saved.json().data.patientProjection, 'pending');
    assert.equal(saved.json().data.notificationsSent, false);
    fail = false;
    const replay = await f.post('visit1', 'CREATE_ASHA_VISIT', visit);
    assert.equal(replay.json().replayed, true);
    assert.equal(replay.json().data.patientProjection, 'updated');
    const older = { ...visit, timestamp: '2026-09-08T12:00:00Z', nextVisitDate: '2026-09-20' };
    await f.post('older', 'CREATE_ASHA_VISIT', older);
    assert.deepEqual(projections.at(-1), { patientId: 'p1', trimester: 1, lastVisit: '2026-09-09', nextVisitDate: '2026-10-09',
      visitId: 'visit1', timestamp: base.timestamp, recordedAt: base.timestamp });
    const data = (await f.app.inject('/api/field-workflows/visits?patientId=p1')).json().data;
    assert.equal(data.visits.length, 2);
    assert.equal(data.visits[0].referralId, undefined);
    assert.deepEqual(data.visits[0].highRiskFlags, ['hbReview', 'bpReview']);
  } finally { await f.close(); }
});

test('unwritable store never acknowledges or mutates memory', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'field-unwritable-'));
  const f = await fixture();
  try {
    // A directory cannot be replaced with a JSON file by rename.
    const bad = new FileStore<FieldRecord>(dir);
    const app = Fastify();
    await app.register(fieldWorkflowsRoutes, { store: bad, now: () => now, patientExists: () => true });
    const r = await app.inject({ method: 'POST', url: '/api/field-workflows/actions', headers: { 'Idempotency-Key': 'failed' }, payload: { id: 'failed', type: 'CREATE_ASHA_VISIT', payload: visit } });
    assert.equal(r.statusCode, 503); assert.equal(r.json().success, false);
    await app.close();
  } finally { await f.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('rename failure after loading rolls back both stock and receipt; retry then commits once', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'field-rename-'));
  const path = join(dir, 'store.json');
  const f = await fixture({}, path);
  try {
    rmSync(path); mkdirSync(path);
    const rejected = await f.post('rename-fail', 'DISPENSE_MEDICINE', { ...base, quantity: 2 });
    assert.equal(rejected.statusCode, 503, rejected.body);
    assert.equal((await f.inventory()).stocks[0].currentStock, 10);
    rmSync(path, { recursive: true });
    const retried = await f.post('rename-fail', 'DISPENSE_MEDICINE', { ...base, quantity: 2 });
    assert.equal(retried.statusCode, 200); assert.equal(retried.json().replayed, false);
    assert.equal((await f.inventory()).stocks[0].currentStock, 8);
    assert.equal((await f.post('rename-fail', 'DISPENSE_MEDICINE', { ...base, quantity: 2 })).json().replayed, true);
  } finally { await f.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('patient create -> ASHA -> patient schedule, receipts and projection repair survive separate main server processes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'field-restart-'));
  try {
    for (const phase of ['create', 'replay', 'repair']) {
      const result = spawnSync(process.execPath, ['--import', 'tsx', 'test/field-workflows-restart.ts', phase], {
        cwd: process.cwd(), env: { ...process.env, FIELD_WORKFLOWS_STORE_PATH: join(dir, 'store.json'),
          PATIENTS_STORE_PATH: join(dir, 'patients.json'), TELECONSULT_STORE_PATH: join(dir, 'teleconsult.json'),
          DIAGNOSTICS_STORE_PATH: join(dir, 'diagnostics.json'), REFERRALS_STORE_PATH: join(dir, 'referrals.json'),
          FIELD_WORKFLOWS_DEMO: 'false', ENABLE_SIMULATOR: 'false' }, encoding: 'utf8', timeout: 30000,
      });
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('patient projection is durable and idempotent, ignores stale same-day visits, and clears missing next date', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'patient-projection-'));
  const path = join(dir, 'patients.json');
  try {
    let repository = createPatientRepository(path);
    const { data: patient } = await repository.create({ name: 'Projection patient', age: 25, gender: 'FEMALE', phone: '9876543210',
      village: 'Village', district: 'District', languagePreference: 'en', trimester: 1, nextVisitDate: '2026-09-01' }, 'patient');
    const projection = { patientId: patient.id, visitId: 'visit-b', timestamp: '2026-09-09T12:00:00Z', recordedAt: base.timestamp,
      trimester: 2 as const, lastVisit: '2026-09-09', nextVisitDate: '2026-10-09' };
    repository.updateVisitProjection(projection);
    repository = createPatientRepository(path);
    repository.updateVisitProjection(projection);
    assert.equal(repository.get(patient.id).nextVisitDate, '2026-10-09');
    assert.throws(() => repository.updateVisitProjection({ ...projection, nextVisitDate: '2026-11-09' }), /different data/);
    repository.updateVisitProjection({ ...projection, visitId: 'visit-old', timestamp: '2026-09-09T11:59:59Z', nextVisitDate: '2026-09-10' });
    repository.updateVisitProjection({ ...projection, visitId: 'visit-a', nextVisitDate: '2026-09-11' });
    assert.equal(repository.get(patient.id).nextVisitDate, '2026-10-09');
    repository.updateVisitProjection({ ...projection, visitId: 'visit-c', timestamp: '2026-09-09T12:01:00Z', nextVisitDate: undefined });
    repository.updateVisitProjection(projection);
    assert.equal(repository.get(patient.id).nextVisitDate, undefined);
    assert.equal(createPatientRepository(path).get(patient.id).visitProjection?.visitId, 'visit-c');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('demo POST, replay and GET repairs never read or project the ordinary patient repository', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'field-demo-isolation-'));
  const path = join(dir, 'ordinary-patients.json');
  const repository = createPatientRepository(path);
  const { data: patient } = await repository.create({ name: 'Ordinary patient', age: 25, gender: 'FEMALE', phone: '9876543210',
    village: 'Village', district: 'District', languagePreference: 'en', trimester: 1, nextVisitDate: '2026-09-01' });
  const before = readFileSync(path, 'utf8');
  const get = patientRepository.get, update = patientRepository.updateVisitProjection;
  const demo = process.env.FIELD_WORKFLOWS_DEMO;
  let reads = 0, writes = 0;
  patientRepository.get = id => { reads++; return repository.get(id); };
  patientRepository.updateVisitProjection = projection => { writes++; repository.updateVisitProjection(projection); };
  process.env.FIELD_WORKFLOWS_DEMO = 'true';
  const app = Fastify();
  const store = new FileStore<FieldRecord>(join(dir, 'demo-field.json'));
  try {
    await app.register(fieldWorkflowsRoutes, { store, now: () => now });
    for (const patientId of [patient.id, 'synthetic-patient']) {
      const payload = { id: `demo-${patientId}`, type: 'CREATE_ASHA_VISIT', payload: { ...visit, patientId } };
      for (const replayed of [false, true]) {
        const response = await app.inject({ method: 'POST', url: '/api/field-workflows/actions',
          headers: { 'Idempotency-Key': payload.id }, payload });
        assert.equal(response.statusCode, 200, response.body);
        assert.equal(response.json().data.id, payload.id);
        assert.equal(response.json().data.patientProjection, 'pending');
        assert.equal(response.json().replayed, replayed);
      }
      const history = await app.inject(`/api/field-workflows/visits?patientId=${patientId}`);
      assert.equal(history.json().data.patientProjection, 'pending');
      assert.equal(history.json().data.visits.length, 1);
    }
    // Direct service consumers cannot accidentally inject ordinary patient callbacks in demo either.
    const direct = createFieldWorkflows({ store, now: () => now, patientExists: id => !!patientRepository.get(id),
      projectPatientVisit: p => patientRepository.updateVisitProjection(p) });
    await direct.apply({ id: 'demo-direct', type: 'CREATE_ASHA_VISIT', payload: { ...visit, patientId: patient.id } }, 'demo-direct');
    await direct.visits(patient.id);
    assert.equal(reads, 0); assert.equal(writes, 0);
    assert.equal(readFileSync(path, 'utf8'), before);
    assert.equal(createPatientRepository(path).get(patient.id).nextVisitDate, '2026-09-01');
  } finally {
    await app.close();
    patientRepository.get = get; patientRepository.updateVisitProjection = update;
    if (demo === undefined) delete process.env.FIELD_WORKFLOWS_DEMO; else process.env.FIELD_WORKFLOWS_DEMO = demo;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('compact receipts grow linearly with retained inventory/visit history and replay original action IDs after reload', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'field-linear-'));
  const path = join(dir, 'field.json');
  let f = await fixture({ projectPatientVisit: undefined }, path);
  const sizes: number[] = [];
  try {
    for (let i = 0; i < 200; i++) {
      const id = String(i).padStart(4, '0');
      const count = await f.post(`count-${id}`, 'UPDATE_INVENTORY', { ...base, quantity: i % 30, newStock: i % 30, operation: 'physical_count' });
      assert.equal(count.statusCode, 200, count.body);
      const saved = await f.post(`visit-${id}`, 'CREATE_ASHA_VISIT', visit);
      assert.equal(saved.statusCode, 200, saved.body);
      assert.deepEqual(Object.keys(saved.json().data).sort(), ['entityId', 'id', 'notificationsSent', 'patientProjection', 'type']);
      if ([49, 99, 199].includes(i)) sizes.push(statSync(path).size);
    }
    t.diagnostic(`Serialized bytes at 100/200/400 actions: ${sizes.join(' / ')}`);
    assert.ok(sizes[1] < sizes[0] * 2.2, `${sizes}`);
    assert.ok(sizes[2] < sizes[1] * 2.2, `${sizes}`);
    const saved = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(saved.replays.length, 400);
    for (const replay of saved.replays) {
      assert.equal(replay.data, undefined);
      assert.deepEqual(Object.keys(replay.receipt).sort(), ['entityId', 'id', 'recordId', 'type']);
      assert.ok(JSON.stringify(replay.receipt).length < 200);
    }
    await f.close();
    f = await fixture({ projectPatientVisit: undefined }, path);
    const replay = await f.post('count-0000', 'UPDATE_INVENTORY', { ...base, quantity: 0, newStock: 0, operation: 'physical_count' });
    assert.equal(replay.json().replayed, true);
    assert.deepEqual(replay.json().data, { id: 'count-0000', type: 'UPDATE_INVENTORY', entityId: 'count-0000', notificationsSent: false });
    assert.equal((await f.inventory()).stocks[0].currentStock, 19);
    assert.equal((await f.inventory()).log.length, 201);
    const visitReplay = await f.post('visit-0000', 'CREATE_ASHA_VISIT', visit);
    assert.equal(visitReplay.json().replayed, true); assert.equal(visitReplay.json().data.id, 'visit-0000');
    assert.equal((await f.app.inject('/api/field-workflows/visits?patientId=p1')).json().data.visits.length, 200);
    assert.equal(statSync(path).size, sizes[2]);
  } finally { await f.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('legacy aggregate receipts replay original API acknowledgment without overwriting current history or keys', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'field-legacy-receipts-'));
  const path = join(dir, 'field.json');
  let f = await fixture({}, path);
  const action = { id: 'legacy-count', type: 'UPDATE_INVENTORY', payload: { ...base, quantity: 4, newStock: 4, operation: 'physical_count' } };
  try {
    // Write the previously shipped on-disk format through the unchanged default API.
    await f.store.transact(action.id, action, () => {
      const record = f.store.get('inventory:f1')!;
      record.stocks[0].currentStock = 4;
      record.receipt = { id: action.id, type: action.type, entityId: action.id };
      record.log.push({ id: action.id, medicineId: 'm1', kind: 'physical_count', quantity: 4, before: 10,
        after: 4, timestamp: base.timestamp, recordedAt: base.timestamp, staffId: 'staff1' });
      return record;
    });
    const legacy = JSON.parse(readFileSync(path, 'utf8')).replays[0];
    assert.ok(legacy.data.stocks); assert.equal(legacy.receipt, undefined);
    await f.close(); f = await fixture({}, path);
    await f.post('new-count', 'UPDATE_INVENTORY', { ...base, quantity: 8, newStock: 8, operation: 'physical_count' });
    await f.close(); f = await fixture({}, path);
    const response = await f.post(action.id, action.type, action.payload);
    assert.equal(response.statusCode, 200, response.body); assert.equal(response.json().replayed, true);
    assert.deepEqual(response.json().data, { id: action.id, type: action.type, entityId: action.id, notificationsSent: false });
    assert.equal((await f.inventory()).stocks[0].currentStock, 8);
    assert.equal((await f.inventory()).log.length, 3);
    assert.equal((await f.post(action.id, action.type, { ...action.payload, quantity: 5, newStock: 5 })).statusCode, 409);
    const persisted = JSON.parse(readFileSync(path, 'utf8'));
    assert.deepEqual(persisted.replays[0], legacy);
    assert.equal(persisted.replays.length, 2);
    assert.equal(persisted.replays[1].data, undefined);
  } finally { await f.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('receipt projection failure commits neither mutation nor replay key', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'receipt-failure-'));
  const store = new FileStore<{ id: string; values: number[] }>(join(dir, 'store.json'));
  try {
    await assert.rejects(store.transact('receipt', {}, () => ({ id: 'row', values: [1] }), () => { throw new Error('Cannot project'); }), /Cannot project/);
    assert.deepEqual(store.all(), []);
    const result = await store.transact('receipt', {}, () => ({ id: 'row', values: [1] }), row => ({ id: row.id }));
    assert.equal(result.replayed, false); assert.deepEqual(result.data, { id: 'row' });
    assert.deepEqual(store.get('row'), { id: 'row', values: [1] });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('legacy visit snapshot replay repairs the latest patient projection and returns the original visit ID', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'legacy-visit-'));
  const path = join(dir, 'field.json');
  let projected = '';
  const options = { projectPatientVisit(p: Parameters<typeof patientRepository.updateVisitProjection>[0]) { projected = p.visitId; } };
  let f = await fixture(options, path);
  const action = { id: 'legacy-visit', type: 'CREATE_ASHA_VISIT', payload: visit };
  try {
    await f.store.transact(action.id, action, () => ({ id: 'visits:p1', stocks: [], orders: [], log: [],
      visits: [{ ...visit, trimester: 1, reviewed: true, highRiskFlags: ['hbReview', 'bpReview'], id: action.id, recordedAt: base.timestamp }],
      receipt: { id: action.id, type: action.type, entityId: action.id } }));
    await f.close(); f = await fixture(options, path);
    const newer = { ...visit, timestamp: '2026-09-09T12:01:00Z' };
    assert.equal((await f.post('newer-visit', 'CREATE_ASHA_VISIT', newer)).statusCode, 200);
    projected = '';
    await f.close(); f = await fixture(options, path);
    const replay = await f.post(action.id, action.type, action.payload);
    assert.equal(replay.statusCode, 200, replay.body);
    assert.equal(replay.json().replayed, true);
    assert.equal(replay.json().data.id, 'legacy-visit');
    assert.equal(replay.json().data.patientProjection, 'updated');
    assert.equal(replay.json().data.visits, undefined);
    assert.equal(projected, 'newer-visit');
    assert.equal((await f.app.inject('/api/field-workflows/visits?patientId=p1')).json().data.visits.length, 2);
  } finally { await f.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('in-flight compact retries share the original receipt and changed bodies conflict before mutation', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'compact-pending-'));
  const store = new FileStore<{ id: string; history: number[] }>(join(dir, 'field.json'));
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const receipt = (row: { id: string }) => ({ id: row.id });
  try {
    const first = store.transact('pending', { value: 1 }, async () => { await gate; return { id: 'row', history: [1] }; }, receipt);
    const retry = store.transact('pending', { value: 1 }, () => { throw new Error('Must not mutate twice'); }, receipt);
    await assert.rejects(store.transact('pending', { value: 2 }, () => { throw new Error('Must not mutate'); }, receipt), /different request/);
    release();
    assert.deepEqual(await first, { data: { id: 'row' }, replayed: false });
    assert.deepEqual(await retry, { data: { id: 'row' }, replayed: true });
    assert.deepEqual(store.get('row'), { id: 'row', history: [1] });
  } finally { release(); rmSync(dir, { recursive: true, force: true }); }
});
