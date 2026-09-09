const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const key = 'medisync_offline_actions';
const verifiedKey = 'medisync_outbox_verified_v2';
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/syncService.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
const timestamp = '2025-06-15T15:06:40.000Z';
const payloads = {
  CREATE_REFERRAL: { patientId: 'patient-1', fromFacilityId: 'facility-2', symptoms: ['fever'], patientAge: 30, patientGender: 'FEMALE' },
  CREATE_DIAGNOSTIC_ORDER: { patientId: 'patient-1', facilityId: 'facility-2', tests: ['cbc', 'blood_sugar'], orderedBy: 'staff-1', priority: 'ROUTINE' },
  ADD_DIAGNOSTIC_RESULT: { orderId: 'dx-1', testCode: 'blood_sugar', value: '90', unit: 'mg/dL', flag: 'NORMAL', referenceRange: '70-100' },
  UPDATE_DIAGNOSTIC_STATUS: { orderId: 'dx-1', status: 'SAMPLE_COLLECTED' },
  CREATE_PATIENT: { name: 'Test Patient', age: 30, gender: 'FEMALE', phone: '9876543210', village: 'Test Village', district: 'Pune', languagePreference: 'en', abhaId: '' },
  CREATE_ASHA_VISIT: { patientId: 'patient-1', ashaId: 'staff-1', trimester: 2, checklist: { weight: '60' }, voiceNotes: '', timestamp, reviewed: true, highRisk: false, highRiskFlags: [], requiresClinicianReview: false },
  UPDATE_INVENTORY: { facilityId: 'facility-2', medicineId: 'medicine-1', staffId: 'staff-1', quantity: 10, newStock: 10, operation: 'physical_count', timestamp },
  DISPENSE_MEDICINE: { facilityId: 'facility-2', medicineId: 'medicine-1', staffId: 'staff-1', quantity: 2, timestamp },
  CREATE_INVENTORY_ORDER: { facilityId: 'facility-2', medicineId: 'medicine-1', staffId: 'staff-1', quantity: 10, status: 'PO', timestamp },
  UPDATE_INVENTORY_ORDER: { facilityId: 'facility-2', orderId: 'purchase-1', staffId: 'staff-1', status: 'APPROVED', timestamp },
};
const input = (label = 'first', type = 'CREATE_REFERRAL') => ({ type,
  payload: { ...payloads[type], ...(type === 'CREATE_REFERRAL' ? { reason: label } : {}) }, timestamp: 1750000000000 });
const savedAction = (status = 'pending') => ({ ...input(), id: 'saved-action-1', status, retryCount: 0 });
function receipt(action = savedAction(), id = 'server-1') {
  const payload = action.payload;
  if (['CREATE_ASHA_VISIT', 'UPDATE_INVENTORY', 'DISPENSE_MEDICINE', 'CREATE_INVENTORY_ORDER', 'UPDATE_INVENTORY_ORDER'].includes(action.type)) {
    return { id: action.id, type: action.type, entityId: action.type === 'UPDATE_INVENTORY_ORDER' ? payload.orderId : action.id,
      ...(action.type === 'CREATE_ASHA_VISIT' ? { patientProjection: 'updated' } : {}), notificationsSent: false };
  }
  if (action.type.includes('DIAGNOSTIC')) {
    const { orderId, ...result } = payload;
    return { ...payloads.CREATE_DIAGNOSTIC_ORDER, id: orderId || id, status: payload.status || (orderId ? 'IN_PROGRESS' : 'ORDERED'),
      results: action.type === 'ADD_DIAGNOSTIC_RESULT' ? [{ id: 'result-1', testName: 'Blood Sugar (Fasting)', ...result }] : [], createdAt: timestamp };
  }
  if (action.type === 'CREATE_PATIENT') return { ...payload, id, abhaId: payload.abhaId ?? '', createdAt: timestamp };
  return { id, patientId: payload.patientId, fromFacilityId: payload.fromFacilityId, toFacilityId: 'facility-3',
    severity: 'YELLOW', status: 'CREATED', reason: payload.reason, qrCode: 'MEDISYNC-REF-1', createdAt: timestamp, updatedAt: timestamp };
}
const ack = (id = 'server-1', data = receipt(savedAction(), id)) => ({ ok: true, status: 201, json: async () => ({ success: true, data }) });
const flush = () => new Promise(resolve => setImmediate(resolve));

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function until(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await flush();
  }
  assert.fail('Expected async state was not reached');
}

function storage(actions = [], verified = true) {
  const values = new Map([[key, JSON.stringify(actions)]]);
  if (verified) values.set(verifiedKey, 'true');
  return {
    values,
    writes: [],
    async getItem(name) { return values.get(name) ?? null; },
    async setItem(name, value) {
      if (this.beforeSet) await this.beforeSet(name, value);
      values.set(name, value);
      this.writes.push({ name, value });
    },
    actions() { return JSON.parse(values.get(key)); },
  };
}

function harness({ store = storage(), origin = 'https://backend.example.test/api/', send = async () => ack(), online = false, demoMode = () => false } = {}) {
  let networkListener;
  const requests = [];
  const fetchMock = async (url, options) => {
    requests.push({ url, options, persisted: store.actions() });
    return send(url, options);
  };
  const mocks = {
    './demoMode': { isDemoActive: () => false, onDemoModeChange: () => () => {} },
    '@react-native-async-storage/async-storage': store,
    '@react-native-community/netinfo': {
      addEventListener(listener) {
        networkListener = listener;
        listener({ isConnected: online, isInternetReachable: online });
        return () => {};
      },
    },
  };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', 'process', 'fetch', code)(
    id => { if (id in mocks) return mocks[id]; throw new Error(`Unexpected import: ${id}`); },
    mod, mod.exports, { env: {} }, fetchMock,
  );
  return {
    service: mod.exports.createSyncService(store, origin, fetchMock, demoMode), store, requests,
    connect() { networkListener({ isConnected: true, isInternetReachable: true }); },
  };
}

test('enqueue persists durably before resolving or sending, and survives a new service instance', async t => {
  const h = harness({ online: true });
  await h.service.init();
  await until(() => !h.service.isSyncing());
  const gate = deferred();
  const entered = deferred();
  t.after(() => gate.resolve());
  h.store.beforeSet = async (name, value) => {
    if (name === key && JSON.parse(value).some(a => a.status === 'pending')) {
      entered.resolve();
      await gate.promise;
    }
  };
  let resolved = false;
  const enqueue = h.service.enqueue(input()).then(() => { resolved = true; });
  await entered.promise;
  await flush();
  assert.equal(resolved, false);
  assert.equal(h.requests.length, 0);
  assert.deepEqual(h.store.actions(), []);
  assert.deepEqual(h.service.getActions(), []);
  gate.resolve();
  await enqueue;
  await until(() => h.requests.length === 1 && !h.service.isSyncing());
  const pendingWrite = h.store.writes.filter(w => w.name === key).map(w => JSON.parse(w.value))
    .find(actions => actions.some(a => a.status === 'pending'));
  assert.equal(pendingWrite[0].payload.reason, 'first');
  assert.equal(h.requests[0].persisted[0].id, pendingWrite[0].id);
  assert.equal(h.requests[0].persisted[0].status, 'syncing');
  const restarted = harness({ store: h.store });
  await restarted.service.init();
  assert.deepEqual(restarted.service.getActions(), h.store.actions());
  assert.equal(restarted.service.getActions()[0].status, 'synced');
});

test('offline enqueue survives restart with its original ID and payload', async () => {
  const h = harness();
  await h.service.init();
  await h.service.enqueue(input());
  assert.equal(h.requests.length, 0);
  const saved = h.store.actions();
  assert.equal(saved[0].status, 'pending');
  const restarted = harness({ store: h.store });
  await restarted.service.init();
  assert.deepEqual(restarted.service.getActions(), saved);
  assert.equal(restarted.service.getPendingCount(), 1);
});

test('demo mode pauses saved server actions and resuming server mode replays the original ID', async () => {
  let demo = true;
  const h = harness({ store: storage([savedAction()]), demoMode: () => demo });
  await h.service.syncAll();
  assert.equal(h.requests.length, 0);
  assert.notEqual(h.store.actions()[0].status, 'synced');
  demo = false;
  await h.service.syncAll();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].options.headers['Idempotency-Key'], 'saved-action-1');
  assert.equal(h.store.actions()[0].status, 'synced');
});

test('actions created in demo remain local after switching back to server mode', async () => {
  let demo = true;
  const h = harness({ demoMode: () => demo });
  await h.service.init();
  await h.service.enqueue(input());
  assert.equal(h.store.actions()[0].demo, true);
  demo = false;
  h.connect();
  await until(() => !h.service.isSyncing() && h.store.actions()[0].status === 'error');
  assert.equal(h.requests.length, 0);
  assert.match(h.store.actions()[0].error, /local only/);
});

test('entering demo while persisting an outgoing action blocks the send', async () => {
  let demo = false;
  const h = harness({ store: storage([savedAction()]), demoMode: () => demo });
  h.store.beforeSet = async (name, value) => {
    if (name === key && JSON.parse(value).some(action => action.status === 'syncing')) demo = true;
  };
  await h.service.syncAll();
  assert.equal(h.requests.length, 0);
  assert.notEqual(h.store.actions()[0].status, 'synced');
});

test('missing backend remains a durable error across retries, never synced', async () => {
  const h = harness({ store: storage([savedAction()]), origin: '   ' });
  for (let attempt = 1; attempt <= 2; attempt++) {
    await h.service.syncAll();
    const [action] = h.service.getActions();
    assert.equal(action.status, 'error');
    assert.equal(action.retryCount, attempt);
    assert.match(action.error, /Backend not configured/);
    assert.equal(h.service.getPendingCount(), 1);
    assert.deepEqual(h.store.actions(), [action]);
  }
  assert.equal(h.requests.length, 0);
});

for (const [name, response] of [
  ['HTTP 503', { ok: false, status: 503, json: async () => ({ success: true, data: { id: 'not-accepted' } }) }],
  ['HTTP 409', { ok: false, status: 409, json: async () => ({ error: 'Conflict' }) }],
  ['negative acknowledgement', { ok: true, status: 200, json: async () => ({ success: false, error: 'Denied' }) }],
  ['missing server ID', { ok: true, status: 200, json: async () => ({ success: true, data: {} }) }],
  ['null body', { ok: true, status: 200, json: async () => null }],
  ['invalid JSON', { ok: true, status: 200, json: async () => { throw new SyntaxError('Invalid JSON'); } }],
]) {
  test(`${name} never marks an action synced`, async () => {
    const h = harness({ store: storage([savedAction()]), send: async () => response });
    await h.service.syncAll();
    const [action] = h.service.getActions();
    assert.equal(h.requests.length, 1);
    assert.equal(action.status, 'error');
    assert.equal(action.retryCount, 1);
    assert.ok(action.error);
    assert.equal(action.response, undefined);
    assert.equal(h.service.getPendingCount(), 1);
    assert.deepEqual(h.store.actions(), [action]);
    assert.ok(h.store.writes.filter(w => w.name === key).every(w => JSON.parse(w.value).every(a => a.status !== 'synced')));
  });
}

for (const [type, endpoint] of [['CREATE_REFERRAL', '/referrals'], ['CREATE_DIAGNOSTIC_ORDER', '/diagnostics/orders']]) {
  test(`${type} waits for acknowledgement and sends the persisted ID as Idempotency-Key`, async t => {
    const gate = deferred();
    t.after(() => gate.resolve(ack()));
    const action = { ...savedAction(), ...input('first', type) };
    const h = harness({ store: storage([action]), send: () => gate.promise });
    const syncing = h.service.syncAll();
    await until(() => h.requests.length === 1);
    assert.equal(h.service.getActions()[0].status, 'syncing');
    assert.equal(h.service.getPendingCount(), 1);
    const { url, options, persisted } = h.requests[0];
    assert.equal(url, `https://backend.example.test/api${endpoint}`);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Idempotency-Key'], action.id);
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), action.payload);
    assert.equal(persisted[0].status, 'syncing');
    const data = receipt(action, 'confirmed-1');
    gate.resolve(ack('confirmed-1', data));
    await syncing;
    assert.equal(h.service.getActions()[0].status, 'synced');
    assert.deepEqual(h.service.getActions()[0].response, data);
    assert.deepEqual(h.store.actions(), h.service.getActions());
    assert.equal(h.service.getPendingCount(), 0);
    await h.service.syncAll();
    assert.equal(h.requests.length, 1);
  });
}

test('transport rejection stays retryable and retries use the same Idempotency-Key', async () => {
  let attempts = 0;
  const h = harness({ store: storage([savedAction()]), send: async () => {
    if (++attempts === 1) throw new Error('Network disconnected');
    return ack();
  } });
  await h.service.syncAll();
  assert.equal(h.store.actions()[0].status, 'error');
  await h.service.syncAll();
  assert.equal(h.store.actions()[0].status, 'synced');
  assert.deepEqual(h.requests.map(r => r.options.headers['Idempotency-Key']), ['saved-action-1', 'saved-action-1']);
});

test('concurrent enqueues during an in-flight send are not overwritten or duplicated', async t => {
  const gate = deferred();
  t.after(() => gate.resolve(ack()));
  let attempts = 0;
  const h = harness({ store: storage([savedAction()]), send: () => ++attempts === 1 ? gate.promise : Promise.resolve(ack()) });
  const syncing = h.service.syncAll();
  await until(() => h.requests.length === 1);
  await Promise.all([h.service.enqueue(input('second')), h.service.enqueue(input('third')), h.service.syncAll()]);
  assert.equal(h.requests.length, 1);
  assert.deepEqual(h.store.actions().map(a => a.payload.reason), ['first', 'second', 'third']);
  gate.resolve(ack());
  await syncing;
  assert.equal(h.store.actions().length, 3);
  assert.deepEqual(h.service.getActions(), h.store.actions());
  await h.service.syncAll();
  assert.ok(h.store.actions().every(a => a.status === 'synced'));
  assert.equal(h.requests.length, 3);
  assert.equal(new Set(h.requests.map(r => r.options.headers['Idempotency-Key'])).size, 3);
});

test('interrupted syncing recovers as pending and replays with the original ID', async () => {
  const action = { ...savedAction('syncing'), retryCount: 2 };
  const h = harness({ store: storage([action]) });
  await h.service.init();
  assert.deepEqual(h.store.actions(), [{ ...action, status: 'pending' }]);
  assert.equal(h.requests.length, 0);
  h.connect();
  await until(() => h.requests.length === 1 && !h.service.isSyncing());
  assert.equal(h.requests[0].options.headers['Idempotency-Key'], action.id);
  assert.equal(h.store.actions()[0].status, 'synced');
});

test('legacy fake synced actions are durably quarantined and never resent, including after restart', async () => {
  const legacy = savedAction('synced');
  const store = storage([legacy], false);
  for (let restart = 0; restart < 2; restart++) {
    const h = harness({ store });
    await h.service.init();
    const [action] = h.service.getActions();
    assert.equal(action.id, legacy.id);
    assert.deepEqual(action.payload, legacy.payload);
    assert.equal(action.status, 'error');
    assert.equal(action.demo, true);
    assert.match(action.error, /legacy|unverified/i);
    assert.equal(h.service.getPendingCount(), 1);
    h.connect();
    await until(() => store.actions()[0].retryCount > restart && !h.service.isSyncing());
    assert.equal(h.requests.length, 0);
    assert.equal(store.actions()[0].status, 'error');
    assert.equal(store.actions()[0].demo, true);
  }
});

test('enqueue storage rejection propagates and does not publish or send an unsaved action', async () => {
  const h = harness({ online: true });
  await h.service.init();
  await until(() => !h.service.isSyncing());
  const failure = new Error('Storage quota exceeded');
  h.store.beforeSet = async () => { throw failure; };
  await assert.rejects(h.service.enqueue(input()), error => error === failure);
  assert.deepEqual(h.store.actions(), []);
  assert.deepEqual(h.service.getActions(), []);
  assert.equal(h.service.lastError(), failure.message);
  assert.equal(h.requests.length, 0);
  h.store.beforeSet = undefined;
  await h.service.enqueue(input('retry'));
  await until(() => h.requests.length === 1 && !h.service.isSyncing());
  assert.equal(h.store.actions()[0].payload.reason, 'retry');
});

for (const phase of ['read', 'migration', 'verification marker', 'before send', 'after acknowledgement']) {
  test(`${phase} storage rejection propagates to the caller`, async () => {
    const h = harness({ store: storage([savedAction()]) });
    const failure = new Error(`Storage failed: ${phase}`);
    if (phase === 'read') h.store.getItem = async () => { throw failure; };
    h.store.beforeSet = async (name, value) => {
      const actions = name === key ? JSON.parse(value) : [];
      if ((phase === 'migration' && name === key) ||
          (phase === 'verification marker' && name === verifiedKey) ||
          (phase === 'before send' && actions.some(a => a.status === 'syncing')) ||
          (phase === 'after acknowledgement' && actions.some(a => a.status === 'synced'))) throw failure;
    };
    await assert.rejects(h.service.syncAll(), error => error === failure);
    assert.equal(h.requests.length, phase === 'after acknowledgement' ? 1 : 0);
    assert.equal(h.service.isSyncing(), false);
    assert.ok(h.store.actions().every(a => a.status !== 'synced'));
    assert.equal(h.service.lastError(), failure.message);
  });
}

for (const type of Object.keys(payloads)) {
  test(`${type} accepts and durably retains its matching acknowledgement`, async () => {
    const action = { ...savedAction(), ...input('first', type) };
    const data = receipt(action);
    const h = harness({ store: storage([action]), send: async () => ack(undefined, data) });
    await h.service.syncAll();
    assert.equal(h.store.actions()[0].status, 'synced');
    assert.deepEqual(h.store.actions()[0].response, data);
    await h.service.syncAll();
    assert.equal(h.requests.length, 1);
    const isPatch = ['ADD_DIAGNOSTIC_RESULT', 'UPDATE_DIAGNOSTIC_STATUS'].includes(type);
    assert.equal(h.requests[0].options.method, isPatch ? 'PATCH' : 'POST');
    assert.equal(h.requests[0].options.headers['Idempotency-Key'], action.id);
    if (isPatch) {
      const { orderId, ...body } = action.payload;
      assert.deepEqual(JSON.parse(h.requests[0].options.body), body);
      assert.match(h.requests[0].url, new RegExp(`/diagnostics/orders/${orderId}/${type === 'ADD_DIAGNOSTIC_RESULT' ? 'result' : 'status'}$`));
    }
  });

  const invalid = [undefined, null, '', '   ', 42, true, {}, ['server-1']]
    .map(id => [`invalid ID ${JSON.stringify(id)}`, data => ({ ...data, id })]);
  if (type === 'CREATE_REFERRAL') {
    invalid.push(['wrong patient', data => ({ ...data, patientId: 'patient-other' })],
      ['missing patient', data => ({ ...data, patientId: undefined })]);
  } else if (type === 'CREATE_PATIENT') {
    for (const field of Object.keys(payloads.CREATE_PATIENT)) {
      invalid.push([`mismatched ${field}`, data => ({ ...data, [field]: field === 'age' ? 31 : 'other' })],
        [`missing ${field}`, data => ({ ...data, [field]: undefined })]);
    }
  } else if (type === 'CREATE_DIAGNOSTIC_ORDER') {
    for (const field of ['patientId', 'facilityId']) {
      invalid.push([`wrong ${field}`, data => ({ ...data, [field]: 'other' })],
        [`missing ${field}`, data => ({ ...data, [field]: undefined })]);
    }
    for (const tests of [undefined, null, 'cbc', [], ['cbc'], ['cbc', 'cbc'], ['cbc', 'blood_sugar', 'ecg'], ['cbc', 1]]) {
      invalid.push([`wrong tests ${JSON.stringify(tests)}`, data => ({ ...data, tests })]);
    }
  } else if (type === 'ADD_DIAGNOSTIC_RESULT') {
    invalid.push(['wrong order', data => ({ ...data, id: 'dx-other' })]);
    for (const results of [undefined, null, {}, [], [null], [{ id: 'result-1' }]]) {
      invalid.push([`missing result ${JSON.stringify(results)}`, data => ({ ...data, results })]);
    }
    for (const field of ['id', 'testCode', 'value', 'unit', 'flag', 'referenceRange']) {
      invalid.push([`wrong result ${field}`, data => ({ ...data, results: [{ ...data.results[0], [field]: field === 'id' ? 42 : 'other' }] })]);
    }
  } else if (type === 'UPDATE_DIAGNOSTIC_STATUS') {
    invalid.push(['wrong order', data => ({ ...data, id: 'dx-other' })],
      ['wrong status', data => ({ ...data, status: 'COMPLETED' })],
      ['missing status', data => ({ ...data, status: undefined })]);
  } else {
    invalid.push(['wrong receipt ID', data => ({ ...data, id: 'action-other' })],
      ['wrong action type', data => ({ ...data, type: 'CREATE_REFERRAL' })],
      ['missing action type', data => ({ ...data, type: undefined })]);
    for (const entityId of [undefined, null, '', ' ', 42, {}, 'wrong-entity']) {
      invalid.push([`wrong entity ID ${JSON.stringify(entityId)}`, data => ({ ...data, entityId })]);
    }
    if (type === 'CREATE_ASHA_VISIT') {
      for (const patientProjection of [undefined, null, true, 'complete', '']) {
        invalid.push([`invalid projection ${JSON.stringify(patientProjection)}`, data => ({ ...data, patientProjection })]);
      }
    }
  }
  invalid.push(['ID-only receipt', data => ({ id: data.id })]);
  for (const [name, mutate] of invalid) {
    test(`${type}: ${name} is retained as retryable, not synced`, async () => {
      const action = { ...savedAction(), ...input('first', type) };
      let reject = true;
      const h = harness({ store: storage([action]), send: async () => ack(undefined, reject ? mutate(receipt(action)) : receipt(action)) });
      await h.service.syncAll();
      const [saved] = h.store.actions();
      assert.equal(saved.status, 'error');
      assert.equal(saved.retryCount, 1);
      assert.equal(saved.response, undefined);
      assert.deepEqual(saved.payload, action.payload);
      assert.equal(h.service.getPendingCount(), 1);
      await assert.rejects(h.service.discardRejected(action.id), /definitively rejected/);
      reject = false;
      await h.service.syncAll();
      assert.equal(h.store.actions()[0].status, 'synced');
      assert.deepEqual(h.requests.map(request => request.options.headers['Idempotency-Key']), [action.id, action.id]);
    });
  }
}

test('persisted visit receipt preserves pending projection across restart without claiming updated', async () => {
  const action = { ...savedAction(), ...input('first', 'CREATE_ASHA_VISIT') };
  const data = { ...receipt(action), patientProjection: 'pending' };
  const h = harness({ store: storage([action]), send: async () => ack(undefined, data) });
  await h.service.syncAll();
  assert.equal(h.store.actions()[0].status, 'synced');
  assert.equal(h.store.actions()[0].response.patientProjection, 'pending');
  const restarted = harness({ store: h.store });
  await restarted.service.syncAll();
  assert.deepEqual(restarted.service.getActions()[0].response, data);
  assert.equal(restarted.requests.length, 0);
});

test('status replay accepts the original snapshot after a lost response', async () => {
  const action = { ...savedAction(), ...input('first', 'UPDATE_DIAGNOSTIC_STATUS') };
  let attempts = 0;
  const h = harness({ store: storage([action]), send: async () => {
    if (++attempts === 1) throw new Error('Response lost after server commit');
    return { ...ack(undefined, receipt(action)), headers: { get: () => 'true' } };
  } });
  await h.service.syncAll();
  await h.service.syncAll();
  assert.equal(h.store.actions()[0].status, 'synced');
  assert.equal(h.store.actions()[0].response.status, 'SAMPLE_COLLECTED');
});

test('result acknowledgement may contain other results and server-defaulted reference range', async () => {
  const action = { ...savedAction(), ...input('first', 'ADD_DIAGNOSTIC_RESULT') };
  delete action.payload.referenceRange;
  action.payload.value = ' 90 ';
  action.payload.unit = ' mg/dL ';
  const data = receipt(action);
  data.results[0] = { ...data.results[0], value: '90', unit: 'mg/dL', referenceRange: '70-100' };
  data.results.unshift({ id: 'result-other', testCode: 'cbc', testName: 'Complete Blood Count', value: 'Normal', unit: '', flag: 'NORMAL' });
  const h = harness({ store: storage([action]), send: async () => ack(undefined, data) });
  await h.service.syncAll();
  assert.equal(h.store.actions()[0].status, 'synced');
});

test('patient acknowledgement matches trimmed identity and optional submitted fields', async () => {
  const action = { ...savedAction(), ...input('first', 'CREATE_PATIENT') };
  action.payload.name = ' Test Patient ';
  delete action.payload.abhaId;
  Object.assign(action.payload, { trimester: 2, lastVisit: '2025-06-15', nextVisitDate: '2025-07-15' });
  const data = { ...receipt(action), name: 'Test Patient' };
  for (const field of ['trimester', 'lastVisit', 'nextVisitDate', null]) {
    const h = harness({ store: storage([action]), send: async () => ack(undefined, field ? { ...data, [field]: undefined } : data) });
    await h.service.syncAll();
    assert.equal(h.store.actions()[0].status, field ? 'error' : 'synced');
  }
});
