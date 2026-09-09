// Run from the repo root: node --test apps/mobile/tests/outbox-integration.cjs
// Native storage/connectivity are mocked; every request uses real loopback HTTP.
// Retry tests discard a real acknowledgement only after the server has committed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { setTimeout: delay } = require('node:timers/promises');
const ts = require('typescript');

const serverDirectory = path.resolve(__dirname, '../../../server');
const outboxKey = 'medisync_offline_actions';
const code = ts.transpileModule(readFileSync(path.join(__dirname, '../src/services/syncService.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;

test('mobile outbox integrates with local Fastify patient, field and diagnostic lifecycles', { timeout: 90000 }, async t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'medisync-outbox-integration-'));
  // Do not inherit provider credentials, DB configuration, or Node preload hooks.
  const env = {};
  for (const name of ['PATH', 'SystemRoot', 'WINDIR', 'SystemDrive', 'COMSPEC', 'TEMP', 'TMP', 'HOME', 'USERPROFILE']) {
    if (process.env[name] !== undefined) env[name] = process.env[name];
  }
  Object.assign(env, {
    HOST: '127.0.0.1', PORT: '0', DATABASE_URL: '', GEMINI_API_KEY: '',
    VITALS_MODE: 'demo', ENABLE_SIMULATOR: 'false', FIELD_WORKFLOWS_DEMO: 'false',
    DIAGNOSTICS_STORE_PATH: path.join(directory, 'diagnostics.json'),
    REFERRALS_STORE_PATH: path.join(directory, 'referrals.json'),
    TELECONSULT_STORE_PATH: path.join(directory, 'teleconsult.json'),
    FIELD_WORKFLOWS_STORE_PATH: path.join(directory, 'field-workflows.json'),
    PATIENTS_STORE_PATH: path.join(directory, 'patients.json'),
  });
  const facilityId = 'synthetic-outbox-facility';
  const medicineId = 'synthetic-outbox-medicine';
  const catalogue = [{
    id: medicineId, facilityId, name: 'Synthetic integration medicine', category: 'other',
    currentStock: 100, minThreshold: 20, maxCapacity: 200, unit: 'tablets',
    lastRestocked: '2026-01-01T00:00:00.000Z', status: 'ADEQUATE',
  }];
  let child;
  let closed;
  let didClose = false;
  let spawnError;
  let output = '';
  try {
    const loader = pathToFileURL(require.resolve('tsx', { paths: [serverDirectory] })).href;
    // Seed only this temporary store via the real manual catalogue import, before startup.
    const bootstrap = `
      const { setInventory } = await import(${JSON.stringify(pathToFileURL(path.join(serverDirectory, 'src/services/inventoryService.ts')).href)});
      setInventory(${JSON.stringify(facilityId)}, ${JSON.stringify(catalogue)});
    `;
    child = spawn(process.execPath, ['--import', loader, '--import', `data:text/javascript,${encodeURIComponent(bootstrap)}`, path.join(serverDirectory, 'src/server.ts')], {
      cwd: serverDirectory, env, stdio: ['ignore', 'pipe', 'pipe'],
    });
    closed = new Promise(resolve => child.once('close', () => { didClose = true; resolve(); }));
    child.on('error', error => { spawnError = error; });
    child.stdout.on('data', data => { output += data.toString(); });
    child.stderr.on('data', data => { output += data.toString(); });

    const until = async (predicate, description) => {
      const deadline = Date.now() + 15000;
      while (!predicate()) {
        if (spawnError) throw spawnError;
        assert.ok(!didClose && child.exitCode === null && child.signalCode === null, `Backend exited: ${output}`);
        assert.ok(Date.now() < deadline, `Timed out: ${description}`);
        await delay(20);
      }
    };

    await until(() => /http:\/\/127\.0\.0\.1:\d+/.test(output), 'backend startup');
    const origin = output.match(/http:\/\/127\.0\.0\.1:\d+/)[0];
    const http = async (endpoint, options = {}) => {
      const response = await fetch(`${origin}${endpoint}`, {
        ...options, redirect: 'error', signal: AbortSignal.timeout(5000),
      });
      return { status: response.status, replayed: response.headers.get('idempotency-replayed'), body: await response.json() };
    };
    const get = async (endpoint) => {
      const response = await http(endpoint);
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.success, true);
      return response.body.data;
    };

    const health = await http('/');
    assert.equal(health.status, 200);
    assert.equal(health.body.status, 'ok');
    assert.equal(health.body.mode, 'demo');
    for (const field of ['authentication', 'abdm', 'externalNotifications']) {
      assert.equal(health.body[field], 'unconfigured');
    }
    assert.deepEqual(await get('/api/diagnostics/orders'), [], 'The backend must start with an isolated empty store');
    assert.deepEqual(await get('/api/patients'), [], 'Patient tests must never load user data');
    const inventoryEndpoint = `/api/field-workflows/inventory?facilityId=${facilityId}`;
    const initialInventory = await get(inventoryEndpoint);
    assert.deepEqual(initialInventory.stocks, catalogue);
    assert.equal(initialInventory.mode, 'manual');
    assert.equal(initialInventory.notificationsSent, false);
    assert.deepEqual(initialInventory.orders, []);
    assert.equal(initialInventory.log.length, 1);
    assert.equal(initialInventory.log[0].kind, 'seed');
    t.diagnostic(`Local Fastify ready at ${origin}; isolated stores, no database/providers, simulator disabled`);

    const values = new Map();
    const storage = {
      async getItem(name) { return values.get(name) ?? null; },
      async setItem(name, value) { values.set(name, value); },
    };
    let networkListener;
    const mocks = {
      './demoMode': { isDemoActive: () => false, onDemoModeChange: () => () => {} },
      '@react-native-async-storage/async-storage': storage,
      '@react-native-community/netinfo': {
        addEventListener(listener) {
          networkListener = listener;
          listener({ isConnected: false, isInternetReachable: false });
          return () => {};
        },
      },
    };
    const requests = [];
    let loseAcknowledgementFor;
    const send = async (url, options) => {
      assert.equal(new URL(url).origin, origin, 'Outbox must never contact an external origin');
      const id = options.headers['Idempotency-Key'];
      const saved = JSON.parse(values.get(outboxKey)).find(action => action.id === id);
      assert.ok(saved, 'Idempotency-Key must be the persisted action ID');
      assert.equal(saved.status, 'syncing');
      const response = await fetch(url, { ...options, redirect: 'error' });
      requests.push({
        endpoint: new URL(url).pathname, method: options.method, headers: options.headers,
        body: options.body, status: response.status,
        replayed: response.headers.get('idempotency-replayed'), response: await response.clone().json(),
      });
      if (id === loseAcknowledgementFor) {
        loseAcknowledgementFor = undefined;
        throw new TypeError('Synthetic lost acknowledgement after server commit');
      }
      return response;
    };
    const mod = { exports: {} };
    new Function('require', 'module', 'exports', 'process', 'fetch', code)(
      name => { if (Object.hasOwn(mocks, name)) return mocks[name]; throw new Error(`Unexpected import: ${name}`); },
      mod, mod.exports, { env: {} }, send,
    );
    const service = mod.exports.createSyncService(storage, `${origin}/api/`, send);
    await service.init();
    assert.equal(service.isOnline(), false);

    const queue = async (type, payload, expectedStatus = 'synced', loseAcknowledgement = false) => {
      assert.equal(service.isSyncing(), false);
      networkListener({ isConnected: false, isInternetReachable: false });
      const before = requests.length;
      await service.enqueue({ type, payload, timestamp: Date.now() });
      const pending = service.getActions().at(-1);
      assert.equal(pending.status, 'pending');
      assert.equal(pending.demo, false, 'The factory defaults to real actions, not demo actions');
      if (loseAcknowledgement) loseAcknowledgementFor = pending.id;
      assert.deepEqual(JSON.parse(values.get(outboxKey)), service.getActions());
      await service.syncAll();
      assert.equal(requests.length, before, 'Offline queue must not send');
      networkListener({ isConnected: true, isInternetReachable: true });
      await until(() => {
        const action = service.getActions().find(item => item.id === pending.id);
        return !service.isSyncing() && ['synced', 'error'].includes(action.status);
      }, `${type} acknowledgement`);
      const action = service.getActions().find(item => item.id === pending.id);
      assert.equal(action.status, expectedStatus, JSON.stringify(action));
      assert.deepEqual(JSON.parse(values.get(outboxKey)), service.getActions());
      const request = requests.find(item => item.headers['Idempotency-Key'] === action.id);
      assert.ok(request, `No real HTTP request for ${type}: ${action.error}`);
      assert.equal(request.headers['Content-Type'], 'application/json');
      if (expectedStatus === 'synced') {
        assert.equal(request.status, ['CREATE_DIAGNOSTIC_ORDER', 'CREATE_PATIENT'].includes(type) ? 201 : 200);
        assert.equal(request.replayed, 'false');
        assert.equal(typeof action.response.id, 'string', 'A confirmed action requires data.id');
        assert.ok(action.response.id);
        assert.deepEqual(action.response, request.response.data);
        assert.equal(action.retryCount, 0);
      }
      return { action, request };
    };
    const replay = async (request) => {
      const response = await http(request.endpoint, {
        method: request.method, headers: request.headers, body: request.body,
      });
      assert.equal(response.status, request.status, JSON.stringify(response.body));
      assert.equal(response.replayed, 'true');
      assert.deepEqual(response.body, {
        ...request.response,
        ...(Object.hasOwn(request.response, 'replayed') ? { replayed: true } : {}),
      }, 'Replay must return the original acknowledgement data');
    };
    const fieldQueue = async (type, payload, loseAcknowledgement = false) => {
      const result = await queue(type, payload, loseAcknowledgement ? 'error' : 'synced', loseAcknowledgement);
      const { action, request } = result;
      assert.equal(request.status, 200);
      assert.equal(request.method, 'POST');
      assert.equal(request.endpoint, '/api/field-workflows/actions');
      assert.deepEqual(JSON.parse(request.body), { id: action.id, type, payload });
      assert.equal(request.response.success, true);
      assert.equal(request.replayed, 'false');
      assert.equal(request.response.data.id, action.id);
      assert.equal(request.response.data.type, type);
      assert.equal(request.response.data.entityId, payload.orderId || action.id);
      assert.equal(request.response.data.notificationsSent, false);
      return result;
    };
    const retryLostAcknowledgement = async ({ action, request }) => {
      assert.equal(action.response, undefined);
      assert.equal(action.retryCount, 1);
      assert.match(action.error, /lost acknowledgement after server commit/);
      assert.equal(service.getPendingCount(), 1);
      const before = requests.length;
      await service.syncAll();
      assert.equal(requests.length, before + 1);
      const retriedRequest = requests.at(-1);
      assert.equal(retriedRequest.headers['Idempotency-Key'], action.id);
      assert.equal(retriedRequest.body, request.body);
      assert.equal(retriedRequest.status, 200);
      assert.equal(retriedRequest.replayed, 'true');
      const confirmed = service.getActions().find(item => item.id === action.id);
      assert.equal(confirmed.status, 'synced');
      assert.equal(confirmed.retryCount, 1);
      assert.equal(confirmed.error, undefined);
      assert.deepEqual(confirmed.response, request.response.data);
      assert.deepEqual(JSON.parse(values.get(outboxKey)), service.getActions());
      assert.equal(service.getPendingCount(), 0);
    };
    const orderPayload = {
      patientId: 'synthetic-outbox-patient', facilityId: 'facility-2', tests: ['malaria_rdt'],
      orderedBy: 'Synthetic Integration Tester', notes: 'Synthetic test only; not clinical data',
    };

    await t.test('queued creation, POST replay, SAMPLE_COLLECTED and NORMAL result complete exactly once', async () => {
      const created = await queue('CREATE_DIAGNOSTIC_ORDER', orderPayload);
      const orderId = created.action.response.id;
      const endpoint = `/api/diagnostics/orders/${orderId}`;
      assert.equal(created.request.method, 'POST');
      assert.equal(created.request.endpoint, '/api/diagnostics/orders');
      assert.deepEqual(JSON.parse(created.request.body), orderPayload);
      assert.equal(created.action.response.status, 'ORDERED');
      assert.deepEqual(created.action.response.results, []);
      assert.deepEqual(await get(endpoint), created.action.response);
      await replay(created.request);
      assert.deepEqual((await get('/api/diagnostics/orders')).map(order => order.id), [orderId]);

      const collected = await queue('UPDATE_DIAGNOSTIC_STATUS', { orderId, status: 'SAMPLE_COLLECTED' });
      assert.equal(collected.request.method, 'PATCH');
      assert.equal(collected.request.endpoint, `${endpoint}/status`);
      assert.deepEqual(JSON.parse(collected.request.body), { status: 'SAMPLE_COLLECTED' });
      assert.equal(collected.action.response.status, 'SAMPLE_COLLECTED');
      assert.deepEqual(collected.action.response.results, []);
      assert.equal(collected.action.response.completedAt, undefined);
      assert.deepEqual(await get(endpoint), collected.action.response);

      const result = { testCode: 'malaria_rdt', value: 'Negative', unit: '', flag: 'NORMAL' };
      const completed = await queue('ADD_DIAGNOSTIC_RESULT', { orderId, ...result });
      assert.equal(completed.request.method, 'PATCH');
      assert.equal(completed.request.endpoint, `${endpoint}/result`);
      assert.deepEqual(JSON.parse(completed.request.body), result);
      assert.equal(completed.action.response.status, 'COMPLETED');
      assert.ok(Number.isFinite(Date.parse(completed.action.response.completedAt)));
      assert.equal(completed.action.response.results.length, 1);
      for (const [name, value] of Object.entries(result)) assert.equal(completed.action.response.results[0][name], value);
      assert.equal(service.getPendingCount(), 0);
      assert.equal(new Set([created.action.id, collected.action.id, completed.action.id]).size, 3);

      // Old POST/status snapshots must replay even after completion, without rollback.
      for (const { request } of [created, collected, completed]) await replay(request);
      assert.deepEqual(await get(endpoint), completed.action.response);
      assert.deepEqual((await get('/api/diagnostics/orders')).map(order => order.id), [orderId]);
      const sent = requests.length;
      await service.syncAll();
      assert.equal(requests.length, sent, 'Confirmed actions must not be resent by syncAll');
      t.diagnostic(`Order ${orderId}: queued POST 201, same-key replay 201, queued PATCH status/result 200; COMPLETED with one NORMAL result; POST/PATCH replays unchanged`);
    });

    await t.test('queued patient confirmation feeds an ASHA checklist visit and projects lastVisit exactly once', async () => {
      const patientPayload = {
        name: 'Synthetic Outbox Patient', age: 27, gender: 'FEMALE', phone: '0000000000',
        village: 'Synthetic Village', district: 'Synthetic District', languagePreference: 'en',
        abhaId: '', trimester: 1,
      };
      const created = await queue('CREATE_PATIENT', patientPayload);
      const patientId = created.action.response.id;
      assert.notEqual(patientId, created.action.id, 'Use the confirmed patient ID, not the outbox ID');
      assert.equal(created.request.method, 'POST');
      assert.equal(created.request.endpoint, '/api/patients');
      assert.deepEqual(JSON.parse(created.request.body), patientPayload);
      const patientEndpoint = `/api/patients/${patientId}`;
      assert.deepEqual(await get(patientEndpoint), created.action.response);
      const visitsEndpoint = `/api/field-workflows/visits?patientId=${patientId}`;
      assert.deepEqual((await get(visitsEndpoint)).visits, []);

      const timestamp = new Date(Date.now() - 60000).toISOString();
      const nextVisitDate = new Date(Date.parse(timestamp) + 7 * 86400000).toISOString().slice(0, 10);
      const visitPayload = {
        patientId, ashaId: 'synthetic-asha', trimester: 2,
        checklist: { bp: '145/95', weight: '62', hb: '10.5', fundalHeight: '24', ifa: true, tt1: true, tt2: false },
        voiceNotes: 'Synthetic integration observation; not clinical data', timestamp, nextVisitDate,
        reviewed: true, highRisk: true, highRiskFlags: ['hbReview', 'bpReview'], requiresClinicianReview: true,
      };
      const visit = await fieldQueue('CREATE_ASHA_VISIT', visitPayload);
      assert.equal(visit.action.response.patientProjection, 'updated');
      // Read the patient first: GET visits can repair a missed projection and hide a POST bug.
      const projected = await get(patientEndpoint);
      assert.equal(projected.lastVisit, timestamp.slice(0, 10));
      assert.equal(projected.nextVisitDate, nextVisitDate);
      assert.equal(projected.trimester, 2);
      assert.equal(projected.visitProjection.visitId, visit.action.response.entityId);
      assert.equal(projected.visitProjection.timestamp, timestamp);
      const visits = await get(visitsEndpoint);
      assert.equal(visits.patientProjection, 'updated');
      assert.equal(visits.visits.length, 1);
      assert.ok(Number.isFinite(Date.parse(visits.visits[0].recordedAt)));
      assert.deepEqual(visits.visits[0], {
        ...visitPayload, id: visit.action.response.entityId, recordedAt: projected.visitProjection.recordedAt,
      });
      await replay(created.request);
      await replay(visit.request);
      assert.deepEqual(await get(patientEndpoint), projected, 'Old creation replay must not undo the visit projection');
      assert.deepEqual(await get(visitsEndpoint), visits, 'Visit replay must not create another visit');
      assert.deepEqual((await get('/api/patients')).map(patient => patient.id), [patientId]);
      assert.equal(service.getPendingCount(), 0);
      t.diagnostic('Patient POST 201 confirmed a server ID; queued checklist visit updated lastVisit/nextVisitDate/trimester; duplicate creation and visit retained one patient and one visit');
    });

    await t.test('queued dispense and full purchase-order cycle audit stock once despite lost-ack retries', async () => {
      const timestamp = new Date(Date.now() - 60000).toISOString();
      const stockPayload = { facilityId, medicineId, staffId: 'synthetic-stock-staff', timestamp };
      const dispensed = await fieldQueue('DISPENSE_MEDICINE', { ...stockPayload, quantity: 7 }, true);
      const afterDispense = await get(inventoryEndpoint);
      assert.equal(afterDispense.stocks[0].currentStock, 93);
      assert.equal(afterDispense.log.length, 2);
      const dispenseLog = afterDispense.log[1];
      assert.ok(Number.isFinite(Date.parse(dispenseLog.recordedAt)));
      assert.deepEqual(dispenseLog, {
        id: dispensed.action.id, medicineId, kind: 'dispense', quantity: 7, before: 100, after: 93,
        timestamp, recordedAt: dispenseLog.recordedAt, staffId: stockPayload.staffId,
      });
      assert.deepEqual(afterDispense.usage, [{ medicineId, total7: 7, total30: 7, dailyAverage7: 1, dailyAverage30: 7 / 30 }]);
      await retryLostAcknowledgement(dispensed);
      assert.deepEqual(await get(inventoryEndpoint), afterDispense, 'Dispense retry must not subtract or log twice');

      const created = await fieldQueue('CREATE_INVENTORY_ORDER', { ...stockPayload, quantity: 25, status: 'PO' });
      const orderId = created.action.response.entityId;
      const afterCreate = await get(inventoryEndpoint);
      assert.equal(afterCreate.orders.length, 1);
      assert.equal(afterCreate.orders[0].id, orderId);
      assert.equal(afterCreate.orders[0].quantity, 25);
      assert.equal(afterCreate.orders[0].medicineId, medicineId);
      assert.equal(afterCreate.orders[0].facilityId, facilityId);
      assert.equal(afterCreate.orders[0].status, 'PO');
      assert.deepEqual(afterCreate.orders[0].history.map(item => item.status), ['PO']);
      assert.deepEqual(afterCreate.stocks, afterDispense.stocks);
      assert.deepEqual(afterCreate.log, afterDispense.log);
      await replay(created.request);
      assert.deepEqual(await get(inventoryEndpoint), afterCreate);

      const transitions = [];
      const statuses = ['PO', 'APPROVED', 'ORDERED', 'RECEIVED', 'VERIFIED', 'STOCKED'];
      let finalInventory;
      for (const status of statuses.slice(1)) {
        const stocked = status === 'STOCKED';
        const updated = await fieldQueue('UPDATE_INVENTORY_ORDER', {
          facilityId, orderId, staffId: stockPayload.staffId, timestamp, status,
        }, stocked);
        transitions.push(updated);
        const inventory = await get(inventoryEndpoint);
        assert.equal(inventory.orders.length, 1);
        const order = inventory.orders[0];
        assert.equal(order.id, orderId);
        assert.equal(order.status, status);
        assert.deepEqual(order.history.map(item => item.status), statuses.slice(0, statuses.indexOf(status) + 1));
        for (const entry of order.history) {
          assert.equal(entry.staffId, stockPayload.staffId);
          assert.ok(Number.isFinite(Date.parse(entry.timestamp)));
        }
        assert.equal(inventory.stocks[0].currentStock, stocked ? 118 : 93);
        assert.equal(inventory.log.length, stocked ? 3 : 2);
        if (stocked) {
          const log = inventory.log[2];
          assert.ok(Number.isFinite(Date.parse(log.recordedAt)));
          assert.deepEqual(log, {
            id: updated.action.id, medicineId, kind: 'stock_order', quantity: 25, before: 93, after: 118,
            timestamp, recordedAt: log.recordedAt, staffId: stockPayload.staffId, orderId,
          });
          assert.equal(inventory.stocks[0].lastRestocked, log.recordedAt);
          await retryLostAcknowledgement(updated);
        } else {
          assert.deepEqual(inventory.stocks, afterDispense.stocks);
          assert.deepEqual(inventory.log, afterDispense.log);
        }
        await replay(updated.request);
        assert.deepEqual(await get(inventoryEndpoint), inventory, `${status} replay must not repeat its side effects`);
        finalInventory = inventory;
      }
      for (const { request } of [dispensed, created, ...transitions]) await replay(request);
      assert.deepEqual(await get(inventoryEndpoint), finalInventory, 'Old receipts must not roll back order state or change stock');
      assert.deepEqual(finalInventory.usage, afterDispense.usage, 'Order restocking is not medicine consumption');
      assert.equal(new Set([dispensed, created, ...transitions].map(result => result.action.id)).size, 7);
      const sent = requests.length;
      await service.syncAll();
      assert.equal(requests.length, sent, 'Confirmed field actions must not be resent');
      assert.equal(service.getPendingCount(), 0);
      t.diagnostic('Stock 100 -> dispense 7 -> 93 -> PO/APPROVED/ORDERED/RECEIVED/VERIFIED/STOCKED +25 -> 118; lost-ack retries preserved one dispense and one stock-order audit entry');
    });

    await t.test('missing result cannot complete and the rejected queued action remains unsynced', async () => {
      const created = await queue('CREATE_DIAGNOSTIC_ORDER', { ...orderPayload, patientId: 'synthetic-missing-result' });
      const orderId = created.action.response.id;
      await queue('UPDATE_DIAGNOSTIC_STATUS', { orderId, status: 'SAMPLE_COLLECTED' });
      const inProgress = await queue('UPDATE_DIAGNOSTIC_STATUS', { orderId, status: 'IN_PROGRESS' });
      // IN_PROGRESS -> COMPLETED is a legal transition, so this tests the result guard, not transition validation.
      const rejected = await queue('UPDATE_DIAGNOSTIC_STATUS', { orderId, status: 'COMPLETED' }, 'error');
      assert.equal(rejected.request.status, 409);
      assert.equal(rejected.request.response.success, false);
      assert.match(rejected.request.response.error, /Completion requires one actual result for every ordered test/);
      assert.match(rejected.action.error, /Server conflict.*not synced/);
      assert.equal(rejected.action.response, undefined);
      assert.equal(rejected.action.retryCount, 1);
      assert.equal(service.getPendingCount(), 1);
      assert.deepEqual(inProgress.action.response.results, []);
      assert.equal(inProgress.action.response.completedAt, undefined);
      assert.deepEqual(await get(`/api/diagnostics/orders/${orderId}`), inProgress.action.response);
      await service.syncAll();
      const retried = service.getActions().find(action => action.id === rejected.action.id);
      assert.equal(retried.status, 'error');
      assert.equal(retried.retryCount, 2);
      assert.equal(requests.at(-1).headers['Idempotency-Key'], rejected.action.id);
      assert.equal(requests.at(-1).status, 409);
      assert.deepEqual(JSON.parse(values.get(outboxKey)), service.getActions());
      assert.deepEqual(await get(`/api/diagnostics/orders/${orderId}`), inProgress.action.response);
      t.diagnostic(`Order ${orderId}: completion without a result returned HTTP 409 twice with the same action key; remains IN_PROGRESS, no results/completedAt; outbox retained as error`);
    });
  } catch (error) {
    t.diagnostic(`Backend output:\n${output}`);
    throw error;
  } finally {
    if (child && !didClose) {
      child.kill('SIGTERM');
      const timer = setTimeout(() => { if (!didClose) child.kill('SIGKILL'); }, 3000);
      try { await closed; } finally { clearTimeout(timer); }
    }
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
