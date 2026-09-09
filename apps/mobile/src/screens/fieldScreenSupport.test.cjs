// Contract tests with a small hook/host-element harness; no native runtime or server required.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(name, mocks = {}) {
  const file = path.join(__dirname, name);
  const source = fs.readFileSync(file, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => {
    if (id in mocks) return mocks[id];
    if (id.startsWith('./')) return load(`${id.slice(2)}.ts`, mocks);
    return require(id);
  }, mod, mod.exports);
  return mod.exports;
}

const logic = load('ashaVisitLogic.ts');
const inventory = load('inventoryScreenLogic.ts');
const flush = () => new Promise(resolve => setImmediate(resolve));

function screen(name, role, api = {}, props = {}) {
  let cursor = 0;
  const slots = [];
  const effects = [];
  const state = { persona: { role, staffId: `${role}-1` }, actions: [] };
  const calls = [];
  const syncService = {
    async discardRejected(id) {
      if (syncService.fail) throw new Error('Storage unavailable');
      const action = state.actions.find(entry => entry.id === id);
      if (!action || action.status !== 'error' || ![400, 422].includes(action.rejectionStatus)) throw new Error('Not a definite rejection');
      action.discarded = true;
    },
    async enqueue(action) {
      calls.push(action);
      if (syncService.fail) throw new Error('Storage unavailable');
      state.actions.push({ ...action, id: `q-${calls.length}`, status: 'pending' });
    },
  };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) { return react.useState(() => ({ current: initial }))[0]; },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => value !== slots[index][i])) {
        slots[index] = deps;
        effects.push(callback);
      }
    },
  };
  const native = new Proxy({}, { get: (_, key) => key });
  const mocks = {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': native,
    '../services/api': { api },
    '../services/fieldClient': {
      inventoryOrderStatuses: ['PO', 'APPROVED', 'ORDERED', 'RECEIVED', 'VERIFIED', 'STOCKED'],
      fieldClient: {
        async inventory(id) {
          if (api.fieldInventory) return api.fieldInventory(id);
          const value = await api.getFacilityInventory(id);
          if (!value?.success || !Array.isArray(value.data)) throw new Error('Invalid response');
          return { stocks: value.data.map(m => ({ ...m, maxCapacity: 100 })), orders: [], log: [], usage: [], mode: 'manual' };
        },
        async visits(id) { return api.fieldVisits ? api.fieldVisits(id) : { visits: [], patientProjection: 'pending' }; },
      },
    },
    '../i18n/translations/fieldWorkflows': { fieldText: (_, key) => `field.${key}` },
    '../services/syncService': { syncService },
    '../services/personas': { getActivePersona: () => state.persona },
    '../i18n': { useTranslation: () => ({ t: value => value, language: 'en' }) },
    '../components/VoiceInputButton': { VoiceInputButton: 'VoiceInputButton' },
    './fieldScreenSupport': { useFieldScreenState: () => state, FieldQueue: 'FieldQueue', fieldStyles: {}, responseList(value) { if (!value?.success || !Array.isArray(value.data)) throw new Error('Invalid response'); return value.data; } },
  };
  const Component = load(`${name}.tsx`, mocks)[name];
  let tree;
  const render = () => { cursor = 0; tree = Component(props); return tree; };
  const nodes = () => {
    const all = [];
    function walk(node) { if (Array.isArray(node)) node.forEach(walk); else if (node && typeof node === 'object') { all.push(node); walk(node.props?.children); } }
    walk(tree);
    return all;
  };
  const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : text(node?.props?.children || '');
  // Prefer the foreground modal when the background list has the same label.
  const findButton = label => nodes().reverse().find(node => node.type === 'TouchableOpacity' && text(node).includes(label));
  const click = label => { const node = findButton(label); assert.ok(node, `Missing button ${label}`); assert.ok(!node.props.disabled, `Disabled button ${label}`); node.props.onPress(); render(); };
  const input = (label, value) => { const node = nodes().find(node => node.type === 'TextInput' && node.props.accessibilityLabel === label); assert.ok(node, `Missing input ${label}`); node.props.onChangeText(value); render(); };
  const settle = async () => { for (let i = 0; i < 5; i++) { render(); effects.splice(0).forEach(fn => fn()); await flush(); } render(); };
  render();
  return { state, calls, syncService, render, nodes, click, input, settle, text: () => text(tree), button: findButton };
}

test('quantities reject partial numbers, fractions, negatives and overflow; physical zero allowed', () => {
  for (const value of ['', '1x', '1.5', '-1', '1e3', 'Infinity', '9007199254740992', '0']) assert.equal(inventory.parseStockQuantity(value), null);
  assert.equal(inventory.parseStockQuantity(' 12 '), 12);
  assert.equal(inventory.parseStockQuantity('0', true), 0);
});

test('seven-day usage uses actual retained logs and excludes future, old and invalid entries', () => {
  const now = Date.now();
  assert.deepEqual(inventory.inventoryUsage([{ timestamp: now, quantity: 14 }, { timestamp: now + 1, quantity: 100 }, { timestamp: now - 7 * 86400000, quantity: 100 }, { timestamp: now, quantity: '5' }], now), { total: 14, dailyAverage: 2 });
  assert.deepEqual(inventory.inventoryUsage([], now), { total: 0, dailyAverage: 0 });
});

test('due dates use calendar boundaries and missing/invalid dates are unknown', () => {
  const today = new Date(2026, 8, 9, 12);
  assert.equal(logic.visitDueState('2026-09-09', today), 'due');
  assert.equal(logic.visitDueState('2026-09-08', today), 'due');
  assert.equal(logic.visitDueState('2026-09-10', today), 'upcoming');
  for (const date of [undefined, '', 'bad', '2026-02-30']) assert.equal(logic.visitDueState(date, today), 'unknown');
  assert.deepEqual(logic.parseAncPatients([{ id: 'p', name: 'P' }, { id: 'q', name: 'Q', trimester: 4 }]), []);
});

test('typed checklist mapping preserves camel-case keys and review flags never equate breech with preterm', () => {
  assert.ok(logic.TRIMESTER_CHECKLISTS[1].some(field => field.key === 'urineAlbumin'));
  assert.ok(logic.TRIMESTER_CHECKLISTS[3].some(field => field.key === 'ttBooster'));
  assert.deepEqual(logic.visitReviewFlags({ hb: '10', bp: '140/90', presentation: 'breech' }), ['hbReview', 'bpReview', 'presentationReview']);
  assert.deepEqual(logic.visitReviewFlags({ hb: '12', bp: '120/80' }), []);
  assert.equal(logic.visitChecklistError({ bp: '120', hb: '10x' }), true);
});

const catalog = [{ code: 'cbc', name: 'CBC', unit: 'g/dL', normalRange: '11-15' }];
const order = { id: 'dx1', patientId: 'p1', facilityId: 'f1', tests: ['cbc'], results: [], status: 'ORDERED', priority: 'ROUTINE' };

test('diagnostics explicitly fetches on mount and unavailable catalogue disables create', async () => {
  let reads = 0;
  const view = screen('DiagnosticsScreen', 'DOCTOR', { getDiagnosticsTests: async () => { reads++; throw new Error('404'); }, getDiagnosticsOrders: async () => ({ success: false }) });
  await view.settle();
  assert.equal(reads, 1);
  assert.match(view.text(), /catalogUnavailable/);
  assert.match(view.text(), /ordersUnavailable/);
  assert.equal(view.button('diagnostics.newOrder').props.disabled, true);
});

test('diagnostic create retains draft on storage failure and queues only after persistence', async () => {
  const view = screen('DiagnosticsScreen', 'DOCTOR', { getDiagnosticsTests: async () => ({ success: true, data: catalog }), getDiagnosticsOrders: async () => ({ success: true, data: [] }) });
  await view.settle(); view.click('diagnostics.newOrder');
  view.input('diagnostics.patientId', 'patient-real'); view.input('diagnostics.facilityId', 'facility-real'); view.click('CBC');
  view.syncService.fail = true; view.click('fieldSync.saveToQueue'); await view.settle();
  assert.match(view.text(), /saveFailed/); assert.ok(view.nodes().some(node => node.type === 'Modal'));
  view.syncService.fail = false; view.click('fieldSync.saveToQueue'); await view.settle();
  assert.equal(view.calls[1].type, 'CREATE_DIAGNOSTIC_ORDER');
  assert.equal(view.calls[1].payload.patientId, 'patient-real');
  assert.equal(view.state.actions[0].status, 'pending');
  assert.ok(!view.nodes().some(node => node.type === 'Modal'));
});

test('diagnostic status/result actions stay separate from server snapshot', async () => {
  const view = screen('DiagnosticsScreen', 'DOCTOR', { getDiagnosticsTests: async () => ({ success: true, data: catalog }), getDiagnosticsOrders: async () => ({ success: true, data: [order] }) });
  await view.settle(); view.click('p1');
  assert.equal(view.button('diagnostics.addResult').props.disabled, true);
  view.click('diagnostics.status.sample_collected'); await view.settle();
  assert.equal(view.calls[0].type, 'UPDATE_DIAGNOSTIC_STATUS');
  assert.equal(view.calls[0].payload.status, 'SAMPLE_COLLECTED');
  assert.equal(order.status, 'ORDERED');
  assert.equal(view.button('diagnostics.status.sample_collected').props.disabled, true);
});

test('inventory initial render has no null modal crash; role guard prevents reads', async () => {
  const view = screen('InventoryScreen', 'DOCTOR', { getFacilityInventory: () => { throw new Error('Must not fetch'); } }, { route: { params: { facilityId: 'f1' } } });
  await view.settle(); assert.match(view.text(), /roleRequired/); assert.equal(view.nodes().filter(node => node.type === 'Modal').length, 0);
});

test('diagnostic result requires a staff-selected flag and retains values on persistence failure', async () => {
  const active = { ...order, status: 'SAMPLE_COLLECTED' };
  const view = screen('DiagnosticsScreen', 'DOCTOR', { getDiagnosticsTests: async () => ({ success: true, data: catalog }), getDiagnosticsOrders: async () => ({ success: true, data: [active] }) });
  await view.settle(); view.click('p1'); view.click('diagnostics.addResult'); view.input('diagnostics.value', '8.5');
  assert.equal(view.button('fieldSync.saveToQueue').props.disabled, true);
  view.click('diagnostics.flags.CRITICAL'); assert.match(view.text(), /criticalWarning/);
  view.syncService.fail = true; view.click('fieldSync.saveToQueue'); await view.settle();
  assert.match(view.text(), /saveFailed/);
  assert.equal(view.nodes().find(node => node.type === 'TextInput' && node.props.accessibilityLabel === 'diagnostics.value').props.value, '8.5');
  view.syncService.fail = false; view.click('fieldSync.saveToQueue'); await view.settle();
  assert.equal(view.calls[1].type, 'ADD_DIAGNOSTIC_RESULT'); assert.equal(view.calls[1].payload.flag, 'CRITICAL');
  assert.equal(active.results.length, 0);
  assert.equal(view.button('diagnostics.addResult').props.disabled, true);
});

test('diagnostic result validates trimmed server limits and placeholders before enqueue, including handler calls', async () => {
  const view = screen('DiagnosticsScreen', 'DOCTOR', { getDiagnosticsTests: async () => ({ success: true, data: catalog }), getDiagnosticsOrders: async () => ({ success: true, data: [{ ...order, status: 'IN_PROGRESS' }] }) });
  await view.settle(); view.click('p1'); view.click('diagnostics.addResult'); view.click('diagnostics.flags.NORMAL');
  for (const value of ['', '   ', 'pending', ' PENDING ', 'NA', ' n/a ', 'Not Yet Added', 'x'.repeat(2001)]) {
    view.input('diagnostics.value', value);
    assert.equal(view.button('fieldSync.saveToQueue').props.disabled, true, value);
    view.button('fieldSync.saveToQueue').props.onPress(); await view.settle();
    assert.equal(view.calls.length, 0);
  }
  view.input('diagnostics.value', ` ${'x'.repeat(2000)} `);
  for (const [label, maximum] of [['diagnostics.unit', 50], ['diagnostics.reference', 200]]) {
    view.input(label, 'x'.repeat(maximum + 1));
    assert.equal(view.button('fieldSync.saveToQueue').props.disabled, true);
    view.button('fieldSync.saveToQueue').props.onPress(); await view.settle(); assert.equal(view.calls.length, 0);
    view.input(label, ` ${'x'.repeat(maximum)} `);
    assert.equal(view.button('fieldSync.saveToQueue').props.disabled, false);
  }
  view.click('fieldSync.saveToQueue'); await view.settle();
  assert.equal(view.calls[0].payload.value.length, 2000);
  assert.equal(view.calls[0].payload.unit.length, 50);
  assert.equal(view.calls[0].payload.referenceRange.length, 200);
});

test('diagnostic results allow empty unit and omit blank optional reference range', async () => {
  const view = screen('DiagnosticsScreen', 'DOCTOR', { getDiagnosticsTests: async () => ({ success: true, data: catalog }), getDiagnosticsOrders: async () => ({ success: true, data: [{ ...order, status: 'IN_PROGRESS' }] }) });
  await view.settle(); view.click('p1'); view.click('diagnostics.addResult');
  view.input('diagnostics.value', ' Negative '); view.input('diagnostics.unit', ' '); view.input('diagnostics.reference', ' ');
  assert.equal(view.button('fieldSync.saveToQueue').props.disabled, true);
  view.click('diagnostics.flags.NORMAL'); view.click('fieldSync.saveToQueue'); await view.settle();
  assert.equal(view.calls[0].payload.value, 'Negative'); assert.equal(view.calls[0].payload.unit, '');
  assert.equal(view.calls[0].payload.referenceRange, undefined);
});

test('400/422 rejected diagnostic results can be discarded with audit preserved and corrected input unblocked', async () => {
  for (const rejectionStatus of [400, 422]) {
    const view = screen('DiagnosticsScreen', 'DOCTOR', { getDiagnosticsTests: async () => ({ success: true, data: catalog }), getDiagnosticsOrders: async () => ({ success: true, data: [{ ...order, status: 'IN_PROGRESS' }] }) });
    const rejected = { id: 'rejected', type: 'ADD_DIAGNOSTIC_RESULT', status: 'error', rejectionStatus, timestamp: Date.now(), payload: { orderId: 'dx1', testCode: 'cbc', value: 'pending' } };
    view.state.actions.push(rejected);
    await view.settle(); view.click('p1'); assert.equal(view.button('diagnostics.addResult').props.disabled, true);
    view.syncService.fail = true; view.click('diagnostics.discardRejected'); await view.settle();
    assert.match(view.text(), /discardFailed/); assert.equal(rejected.discarded, undefined);
    assert.equal(view.button('diagnostics.addResult').props.disabled, true);
    view.syncService.fail = false; view.click('diagnostics.discardRejected'); await view.settle();
    assert.equal(rejected.status, 'error'); assert.equal(rejected.discarded, true);
    assert.equal(rejected.payload.value, 'pending'); assert.equal(view.state.actions.length, 1);
    assert.match(view.text(), /discardedAudit/); assert.equal(view.button('diagnostics.discardRejected'), undefined);
    assert.ok(view.nodes().filter(node => node.type === 'FieldQueue').every(node => node.props.actions.includes(rejected)));
    view.click('diagnostics.addResult'); view.input('diagnostics.value', '12'); view.click('diagnostics.flags.NORMAL');
    view.click('fieldSync.saveToQueue'); await view.settle();
    assert.equal(view.state.actions.length, 2); assert.equal(view.state.actions[1].payload.value, '12');
  }
});

test('ambiguous failures, conflicts and in-flight diagnostics remain blocked and cannot be discarded', async () => {
  const view = screen('DiagnosticsScreen', 'DOCTOR', { getDiagnosticsTests: async () => ({ success: true, data: catalog }), getDiagnosticsOrders: async () => ({ success: true, data: [{ ...order, status: 'IN_PROGRESS' }] }) });
  const action = { id: 'blocked', type: 'ADD_DIAGNOSTIC_RESULT', status: 'error', timestamp: Date.now(), payload: { orderId: 'dx1', testCode: 'cbc' } };
  view.state.actions.push(action); await view.settle(); view.click('p1');
  for (const [status, rejectionStatus] of [['error', undefined], ['error', 409], ['error', 500], ['pending', 400], ['syncing', 422]]) {
    Object.assign(action, { status, rejectionStatus }); view.render();
    assert.equal(view.button('diagnostics.addResult').props.disabled, true);
    assert.equal(view.button('diagnostics.discardRejected'), undefined);
  }
});

test('discarded diagnostic status audit no longer blocks a new status action', async () => {
  const view = screen('DiagnosticsScreen', 'DOCTOR', { getDiagnosticsTests: async () => ({ success: true, data: catalog }), getDiagnosticsOrders: async () => ({ success: true, data: [order] }) });
  view.state.actions.push({ id: 'status-error', type: 'UPDATE_DIAGNOSTIC_STATUS', status: 'error', rejectionStatus: 422, timestamp: Date.now(), payload: { orderId: 'dx1', status: 'IN_PROGRESS' } });
  await view.settle(); view.click('p1'); assert.equal(view.button('diagnostics.status.sample_collected').props.disabled, true);
  view.click('diagnostics.discardRejected'); await view.settle(); view.click('diagnostics.status.sample_collected'); await view.settle();
  assert.equal(view.calls[0].payload.status, 'SAMPLE_COLLECTED'); assert.equal(view.state.actions[0].discarded, true);
});

test('diagnostics preserves recommendedTests and patient/facility route values', async () => {
  const view = screen('DiagnosticsScreen', 'DOCTOR', { getDiagnosticsTests: async () => ({ success: true, data: catalog }), getDiagnosticsOrders: async () => ({ success: true, data: [] }) }, { route: { params: { patientId: 'patient-route', facilityId: 'facility-route', recommendedTests: ['cbc'] } } });
  await view.settle(); view.click('diagnostics.newOrder'); view.click('fieldSync.saveToQueue'); await view.settle();
  assert.deepEqual(view.calls[0].payload.tests, ['cbc']); assert.equal(view.calls[0].payload.patientId, 'patient-route');
  assert.equal(view.calls[0].payload.facilityId, 'facility-route');
});

test('inventory always queues dispense, keeps server count unchanged and guards pending quantity', async () => {
  const view = screen('InventoryScreen', 'PHARMACIST', { getFacilityInventory: async () => ({ success: true, data: [{ id: 'm1', name: 'Medicine', currentStock: 10, minThreshold: 5, category: 'other', unit: 'tablets' }] }) }, { route: { params: { facilityId: 'f1' } } });
  await view.settle(); view.click('inventory.dispense'); view.input('inventory.quantity', '7'); view.click('fieldSync.saveToQueue'); await view.settle();
  assert.equal(view.calls[0].type, 'DISPENSE_MEDICINE'); assert.equal(view.calls[0].payload.facilityId, 'f1');
  assert.match(view.text(), /serverStock: 10/);
  view.click('inventory.dispense'); view.input('inventory.quantity', '7'); view.click('fieldSync.saveToQueue'); await view.settle();
  assert.equal(view.calls.length, 1); assert.match(view.text(), /invalidQuantity/);
});

test('inventory purchase/count writes remain pending and storage failure leaves modal open', async () => {
  const view = screen('InventoryScreen', 'PHARMACIST', { getFacilityInventory: async () => ({ success: true, data: [{ id: 'm1', name: 'Medicine', currentStock: 10, minThreshold: 5, category: 'other', unit: 'tablets' }] }) }, { route: { params: { facilityId: 'f1' } } });
  await view.settle(); view.click('inventory.reorder'); view.input('inventory.quantity', '20');
  view.syncService.fail = true; view.click('fieldSync.saveToQueue'); await view.settle();
  assert.match(view.text(), /saveFailed/); assert.ok(view.nodes().some(node => node.type === 'Modal'));
  view.syncService.fail = false; view.click('fieldSync.saveToQueue'); await view.settle();
  assert.equal(view.state.actions[0].type, 'CREATE_INVENTORY_ORDER'); assert.equal(view.state.actions[0].status, 'pending');
  view.click('inventory.recordCount'); view.input('inventory.quantity', '0'); view.click('fieldSync.saveToQueue'); await view.settle();
  assert.equal(view.state.actions[1].type, 'UPDATE_INVENTORY'); assert.equal(view.state.actions[1].payload.newStock, 0);
  assert.match(view.text(), /serverStock: 10/); assert.doesNotMatch(view.text(), /stockVerified/);
});

test('inventory failed API does not become an empty success', async () => {
  const view = screen('InventoryScreen', 'PHARMACIST', { getFacilityInventory: async () => ({ success: false, data: [] }) }, { route: { params: { facilityId: 'f1' } } });
  await view.settle(); assert.match(view.text(), /inventory.unavailable/); assert.doesNotMatch(view.text(), /inventory.noMedicines/);
});

test('ASHA filters trimester/due and queues current checklist flags without auto referral', async () => {
  const view = screen('AshaHomeVisitScreen', 'ASHA', { getPatients: async () => ({ success: true, data: [{ id: 'p1', name: 'Due patient', trimester: 1, nextVisitDate: '2020-01-01' }, { id: 'p2', name: 'Future patient', trimester: 2, nextVisitDate: '2099-01-01' }] }) });
  await view.settle(); assert.match(view.text(), /Due patient/); assert.doesNotMatch(view.text(), /Future patient/);
  view.click('asha.trimester 2'); assert.doesNotMatch(view.text(), /Due patient/);
  view.click('asha.upcoming'); assert.match(view.text(), /Future patient/);
  view.click('asha.trimester 1'); view.click('asha.due'); view.click('Due patient');
  view.input('asha.fields.hb', '10'); view.input('asha.fields.bp', '140/90');
  view.click('field.reviewed');
  view.syncService.fail = true; view.click('fieldSync.saveToQueue'); await view.settle(); assert.match(view.text(), /saveFailed/);
  view.syncService.fail = false; view.click('fieldSync.saveToQueue'); await view.settle();
  const saved = view.state.actions[0];
  assert.equal(saved.type, 'CREATE_ASHA_VISIT'); assert.deepEqual(saved.payload.highRiskFlags, ['hbReview', 'bpReview']);
  assert.equal(saved.payload.checklist.bp, '140/90'); assert.equal(saved.status, 'pending');
  assert.equal(view.state.actions.length, 1);
  assert.match(view.text(), /Due patient/);
});

test('ASHA guard denies other roles', async () => {
  const view = screen('AshaHomeVisitScreen', 'PHARMACIST', { getPatients: () => { throw new Error('Must not fetch'); } });
  await view.settle(); assert.match(view.text(), /roleRequired/);
});

test('a confirmed background action refreshes inventory without discarding an open form', async () => {
  let reads = 0;
  const view = screen('InventoryScreen', 'PHARMACIST', { getFacilityInventory: async () => { reads++; return { success: true, data: [{ id: 'm1', name: 'Medicine', currentStock: 10, minThreshold: 5, category: 'other', unit: 'tablets' }] }; } }, { route: { params: { facilityId: 'f1' } } });
  await view.settle(); view.click('inventory.reorder'); view.input('inventory.quantity', '20');
  view.state.actions.push({ id: 'old-action', type: 'UPDATE_INVENTORY', status: 'synced', timestamp: Date.now(), payload: { facilityId: 'f1', medicineId: 'm1' } });
  await view.settle(); assert.equal(reads, 2);
  assert.equal(view.nodes().find(node => node.type === 'TextInput' && node.props.accessibilityLabel === 'inventory.quantity').props.value, '20');
});

test('queue hook refreshes after mount, subscribes to action/persona changes and unsubscribes', () => {
  const values = [];
  const effects = [];
  let actionListener, personaListener;
  let actions = [];
  let unsubscribed = 0;
  const hooks = {
    useState(initial) { const index = values.length; values.push(typeof initial === 'function' ? initial() : initial); return [values[index], next => { values[index] = next; }]; },
    useEffect(callback) { effects.push(callback); },
  };
  const support = load('fieldScreenSupport.tsx', {
    react: hooks,
    'react-native': { StyleSheet: { create: value => value } },
    '@medisync/shared': { COLORS: {} },
    '../services/syncService': { syncService: { getActions: () => actions, subscribe(listener) { actionListener = listener; return () => { unsubscribed++; }; } } },
    '../services/personas': { getActivePersona: () => ({ role: 'ASHA' }), onPersonaChange(listener) { personaListener = listener; return () => { unsubscribed++; }; } },
    '../i18n': { useTranslation: () => ({ t: value => value }) },
    '../i18n/translations/fieldWorkflows': { fieldText: (_, key) => key },
  });
  support.useFieldScreenState();
  const cleanups = effects.map(effect => effect());
  actions = [{ id: 'q1', status: 'error' }]; actionListener();
  assert.equal(values[1][0].status, 'error');
  personaListener({ role: 'PHARMACIST' }); assert.equal(values[0].role, 'PHARMACIST');
  cleanups.forEach(cleanup => cleanup()); assert.equal(unsubscribed, 2);
  assert.throws(() => support.responseList({ success: false, data: [] }));
  assert.throws(() => support.responseList(null));
  assert.deepEqual(support.responseList({ success: true, data: [] }), []);
});

test('inventory uses server usage, queues each PO step and blocks duplicate pending transitions', async () => {
  const snapshot = { mode: 'manual', stocks: [{ id: 'm1', name: 'Medicine', category: 'other', unit: 'tablets', currentStock: 10, minThreshold: 5, maxCapacity: 30 }],
    orders: [{ id: 'po1', facilityId: 'f1', medicineId: 'm1', quantity: 5, status: 'PO', history: [{ status: 'PO', timestamp: '2026-09-09', staffId: 's1' }] }], log: [],
    usage: [{ medicineId: 'm1', dailyAverage7: 2, dailyAverage30: 1 }] };
  const view = screen('InventoryScreen', 'PHARMACIST', { fieldInventory: async () => snapshot }, { route: { params: { facilityId: 'f1' } } });
  await view.settle(); assert.match(view.text(), /2.0 \/ 1.0/);
  view.click('field.advance'); await view.settle();
  assert.equal(view.calls[0].type, 'UPDATE_INVENTORY_ORDER'); assert.equal(view.calls[0].payload.status, 'APPROVED');
  assert.equal(snapshot.orders[0].status, 'PO'); assert.equal(view.button('field.advance').props.disabled, true);
});

test('inventory discarded dispense releases reservation but pending dispense is not reported as actual usage', async () => {
  const view = screen('InventoryScreen', 'PHARMACIST', { getFacilityInventory: async () => ({ success: true, data: [{ id: 'm1', name: 'Medicine', currentStock: 10, minThreshold: 5, category: 'other', unit: 'tablets' }] }) }, { route: { params: { facilityId: 'f1' } } });
  view.state.actions.push({ id: 'rejected', type: 'DISPENSE_MEDICINE', status: 'error', discarded: true, payload: { facilityId: 'f1', medicineId: 'm1', quantity: 10 } });
  await view.settle(); view.click('inventory.dispense'); view.input('inventory.quantity', '10'); view.click('fieldSync.saveToQueue'); await view.settle();
  assert.equal(view.calls.length, 1); assert.match(view.text(), /field.usage: - \/ -/);
});

test('ASHA requires review, validates numeric bounds and optional date, and blocks duplicate unconfirmed visits', async () => {
  const view = screen('AshaHomeVisitScreen', 'ASHA', { getPatients: async () => ({ success: true, data: [{ id: 'p1', name: 'Patient', trimester: 1, nextVisitDate: '2020-01-01' }] }) });
  await view.settle(); view.click('Patient'); view.input('asha.fields.hb', '10');
  view.click('fieldSync.saveToQueue'); await view.settle(); assert.equal(view.calls.length, 0);
  view.click('field.reviewed'); view.input('field.nextVisit', '2026-02-30'); view.click('fieldSync.saveToQueue'); await view.settle(); assert.equal(view.calls.length, 0);
  view.input('field.nextVisit', '2099-01-01'); view.click('fieldSync.saveToQueue'); await view.settle();
  assert.equal(view.calls[0].payload.reviewed, true); assert.equal(view.calls[0].payload.nextVisitDate, '2099-01-01');
  assert.equal(view.button('Patient').props.disabled, true);
  for (const checklist of [{ bp: '80/120' }, { hb: '26' }, { weight: '501' }, { fundalHeight: '61' }]) assert.equal(logic.visitChecklistError(checklist), true);
});

test('new translation keys have matching en/hi/mr structure', () => {
  const languages = ['en', 'hi', 'mr'].map(lang => JSON.parse(fs.readFileSync(path.join(__dirname, `../i18n/translations/${lang}.json`), 'utf8')));
  const keys = value => Object.keys(value).sort().flatMap(key => typeof value[key] === 'object' ? keys(value[key]).map(child => `${key}.${child}`) : [key]);
  for (const section of ['diagnostics', 'inventory', 'asha', 'fieldSync']) {
    assert.deepEqual(keys(languages[0][section]), keys(languages[1][section]));
    assert.deepEqual(keys(languages[0][section]), keys(languages[2][section]));
  }
});
