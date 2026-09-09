const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(relative, mocks = {}, globals = {}) {
  const filename = path.resolve(__dirname, relative);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(id => id in mocks ? mocks[id] : require(id), mod, mod.exports, ...Object.values(globals));
  return mod.exports;
}

const service = load('../services/bedForecast.ts');
const i18n = load('bedForecastI18n.ts');
const sample = () => service.buildSyntheticBedHistory();
const history = (values, capacity = 100) => ({ ...sample(), capacity, history: values.map((value, i) => ({ timestamp: new Date(Date.UTC(2025, 0, 1, i)).toISOString(), occupied_beds: value })) });
const remote = (input = sample()) => ({ ...service.heuristicBedForecast(input), model_used: 'synthetic_lstm', fallback_reason: null });
const origin = 'https://ml.health.gov.in';

test('sample is reproducible, hourly, bounded and independent of current snapshot', () => {
  assert.deepEqual(sample(), sample());
  assert.equal(sample().facility_id, 'synthetic-demo-total-beds');
  assert.equal(sample().capacity, 100);
  assert.equal(service.validateBedHistory(sample()).history.length, 24);
  assert.equal(sample().history[23].timestamp, '2025-01-01T23:00:00.000Z');
});

test('validated history rejects snapshots, invalid capacities, counts, dates and intervals', () => {
  for (const bad of [null, {}, { ...sample(), history: [] }, history([4]), ...[0, -1, 1.5, NaN, Infinity, '100', 1_000_001].map(capacity => ({ ...sample(), capacity })), ...['', ' ', 'x'.repeat(129)].map(facility_id => ({ ...sample(), facility_id })), ...[-1, 101, 0.5, NaN, '4'].map(count => history([4, count])), history(Array(2161).fill(4))]) {
    assert.throws(() => service.validateBedHistory(bad));
    assert.throws(() => service.heuristicBedForecast(bad));
  }
  for (const timestamp of ['2025-01-01T00:00:00', '2025-02-30T00:00:00Z', 'bad', '2025-01-01T25:00:00Z', '0000-01-01T00:00:00Z', '2025-01-01T00:00:00+24:00']) {
    const input = history([4, 4]); input.history[0].timestamp = timestamp;
    assert.throws(() => service.validateBedHistory(input), timestamp);
  }
  for (const offset of [0, -1, 0.5, 2]) {
    const input = history([4, 4]); input.history[1].timestamp = new Date(Date.UTC(2025, 0, 1) + offset * 3600000).toISOString();
    assert.throws(() => service.validateBedHistory(input));
  }
  const tooLate = history([4, 4]);
  tooLate.history = [{ timestamp: '9999-12-31T22:00:00Z', occupied_beds: 4 }, { timestamp: '9999-12-31T23:00:00Z', occupied_beds: 4 }];
  assert.throws(() => service.validateBedHistory(tooLate));
});

test('timezone offsets normalize to UTC; input stays immutable', () => {
  const input = history([0, 100]);
  input.history[0].timestamp = '2025-01-01T05:30:00+05:30';
  const before = structuredClone(input);
  assert.equal(service.validateBedHistory(input).history[0].timestamp, '2025-01-01T00:00:00.000Z');
  service.heuristicBedForecast(input);
  assert.deepEqual(input, before);
});

test('heuristic matches constant/linear trend, bounds, four horizons and Python rounding', () => {
  const result = service.heuristicBedForecast(history([10, 11, 12]));
  assert.deepEqual(result.forecasts.map(p => p.occupied_beds), [18, 24, 36, 60]);
  assert.deepEqual(result.forecasts.map(p => p.horizon_hours), [6, 12, 24, 48]);
  assert.equal(result.forecasts[3].timestamp, '2025-01-03T02:00:00.000Z');
  for (const [values, expected] of [[Array(24).fill(42), 42], [[0, 100], 100], [[100, 0], 0]]) {
    for (const point of service.heuristicBedForecast(history(values)).forecasts) {
      assert.equal(point.occupied_beds, expected);
      assert.equal(point.available_beds + point.occupied_beds, 100);
      assert.equal(point.occupancy_rate, expected / 100);
    }
  }
  // Flat fitted trends at 1.5 and 0.5 exercise both directions of ties-to-even.
  const rounded = service.heuristicBedForecast(history([1, 2, 2, 1]));
  assert.deepEqual(rounded.forecasts.map(p => p.occupied_beds), [2, 2, 2, 2]);
  assert.deepEqual(service.heuristicBedForecast(history([0, 1, 1, 0])).forecasts.map(p => p.occupied_beds), [0, 0, 0, 0]);
  assert.deepEqual(service.heuristicBedForecast(history([99, ...Array(24).fill(8)])).forecasts.map(p => p.occupied_beds), [8, 8, 8, 8]);
});

test('POST uses the actual snake-case ML contract without application credentials', async () => {
  let calls = 0;
  const result = await service.fetchBedForecast(sample(), { origin: `${origin}/`, fetcher: async (url, options) => {
    calls++;
    assert.equal(url, `${origin}/predict/beds`);
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    assert.deepEqual(Object.keys(options.headers).sort(), ['Accept', 'Content-Type']);
    assert.deepEqual(JSON.parse(options.body), sample());
    return { ok: true, json: async () => remote() };
  } });
  assert.equal(calls, 1);
  assert.equal(result.source, 'ml');
  assert.equal(result.prediction.model_used, 'synthetic_lstm');
  assert.equal(result.localReason, null);
});

test('remote heuristic source and fallback reason remain distinguishable from local', async () => {
  for (const fallback_reason of ['insufficient_history', 'model_not_found', 'model_unavailable']) {
    const input = fallback_reason === 'insufficient_history' ? history([4, 5]) : sample();
    const result = await service.fetchBedForecast(input, { origin, fetcher: async () => ({ ok: true, json: async () => ({ ...service.heuristicBedForecast(input), fallback_reason }) }) });
    assert.equal(result.source, 'ml');
    assert.equal(result.prediction.fallback_reason, fallback_reason);
  }
});

test('configured EXPO_PUBLIC_ML_URL is used when no test origin is supplied', async () => {
  const previous = process.env.EXPO_PUBLIC_ML_URL;
  try {
    process.env.EXPO_PUBLIC_ML_URL = origin;
    const result = await service.fetchBedForecast(sample(), { fetcher: async url => {
      assert.equal(url, `${origin}/predict/beds`);
      return { ok: true, json: async () => remote() };
    } });
    assert.equal(result.source, 'ml');
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_ML_URL;
    else process.env.EXPO_PUBLIC_ML_URL = previous;
  }
});

test('missing/unsafe/placeholder origins do not fetch and explicitly fall back', async () => {
  for (const url of ['', 'http://ml.health.gov.in', 'https://example.com', 'https://ml.example.org', 'https://ml.invalid', 'https://localhost', 'https://ml.health.gov.in/path', 'https://ml.health.gov.in?q=1', 'https://ml.health.gov.in#x', 'https://user:pass@ml.health.gov.in']) {
    const result = await service.fetchBedForecast(sample(), { origin: url, fetcher: () => { assert.fail('Must not fetch'); } });
    assert.equal(result.source, 'local');
    assert.equal(result.localReason, url ? 'invalid_url' : 'not_configured');
  }
});

test('invalid history never fetches or receives fallback', async () => {
  await assert.rejects(service.fetchBedForecast(history([1]), { origin, fetcher: () => assert.fail('Must not fetch') }));
});

test('network and HTTP failures yield labelled local heuristic', async () => {
  for (const fetcher of [async () => { throw new Error('offline'); }, async () => ({ ok: false, status: 422 })]) {
    const result = await service.fetchBedForecast(sample(), { origin, fetcher });
    assert.equal(result.localReason, 'request_failed');
    assert.deepEqual(result.prediction, service.heuristicBedForecast(sample()));
  }
});

test('invalid response metadata, safety flags, counts, horizons and timestamps are rejected', async () => {
  const mutations = [
    value => { value.facility_id = 'other'; }, value => { value.capacity = 101; },
    value => { value.synthetic = false; }, value => { value.clinically_validated = true; },
    value => { value.model_used = 'lstm'; }, value => { value.fallback_reason = 'model_not_found'; },
    value => { value.disclaimer = ''; }, value => { value.forecasts.pop(); },
    value => { value.forecasts[1].horizon_hours = 6; }, value => { value.forecasts[0].timestamp = 'bad'; },
    value => { value.forecasts[0].occupied_beds = 1.5; }, value => { value.forecasts[0].available_beds = 999; },
    value => { value.forecasts[0].occupancy_rate = NaN; }, value => { value.forecasts[0].occupancy_rate = 0.123; },
  ];
  for (const mutate of mutations) {
    const value = remote(); mutate(value);
    const result = await service.fetchBedForecast(sample(), { origin, fetcher: async () => ({ ok: true, json: async () => value }) });
    assert.equal(result.localReason, 'invalid_response');
  }
  const result = await service.fetchBedForecast(sample(), { origin, fetcher: async () => ({ ok: true, json: async () => { throw new Error('bad json'); } }) });
  assert.equal(result.localReason, 'invalid_response');
});

test('timeout covers hung fetch and hung body; abort cancels instead of showing fallback', async () => {
  for (const bodyHangs of [false, true]) {
    let signal;
    const result = await service.fetchBedForecast(sample(), { origin, timeoutMs: 10, fetcher: async (_, options) => {
      signal = options.signal;
      return bodyHangs ? { ok: true, json: () => new Promise(() => {}) } : new Promise(() => {});
    } });
    assert.equal(result.localReason, 'timeout');
    assert.equal(signal.aborted, true);
  }
  const controller = new AbortController();
  const pending = service.fetchBedForecast(sample(), { origin, signal: controller.signal, fetcher: () => new Promise(() => {}) });
  controller.abort();
  await assert.rejects(pending, /cancelled/);
  await assert.rejects(service.fetchBedForecast(sample(), { origin: '', signal: controller.signal }), /cancelled/);
});

test('feature copy has complete en/hi/mr coverage and safe English fallback', () => {
  const en = i18n.bedForecastCopy('en');
  for (const lang of ['hi', 'mr']) {
    const copy = i18n.bedForecastCopy(lang);
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(en).sort());
    for (const key of Object.keys(en)) { assert.ok(copy[key].trim()); assert.notEqual(copy[key], en[key], key); }
  }
  assert.equal(i18n.bedForecastCopy('unknown'), en);
  assert.equal(en.tryDemo, 'Try synthetic forecast demo');
  assert.match(en.sample, /not ICU/);
  assert.match(en.disclaimer, /not clinically validated/);
});

function screen(options = {}) {
  let cursor = 0;
  const slots = [], effects = [], cleanups = [];
  const previousOrigin = process.env.EXPO_PUBLIC_API_URL;
  process.env.EXPO_PUBLIC_API_URL = options.origin ?? 'https://api.health.gov.in';
  const state = { facilityId: 'f1', language: 'en', calls: [], fail: false, pending: false, demo: false, apiCalls: 0, sockets: 0, releases: 0, apiFail: false, apiPending: false, navigation: [], ...options };
  const modeListeners = new Set();
  const hooks = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((dep, j) => dep !== slots[i].deps[j])) slots[i] = { deps, fn };
      return slots[i].fn;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((dep, j) => dep !== slots[i][j])) {
        slots[i] = deps;
        effects.push(() => { cleanups[i]?.(); cleanups[i] = fn(); });
      }
    },
  };
  const theme = { typography: { fontSize: {}, fontWeight: {} }, layout: {}, spacing: {}, borderRadius: {}, shadows: {} };
  const summary = () => ({ facility: { id: state.facilityId, name: 'Hospital', type: 'PHC', district: 'D', taluka: 'T', contactPhone: '123' }, beds: { total: 2, available: 1, occupied: 1 }, medicine: { overallAvailability: 50 }, staff: { total: 1, onDuty: 1 } });
  const facilities = ['f1', 'f2'].map(id => ({ ...summary().facility, id, name: `Sample ${id}`, beds: { total: 20, available: 12, occupied: 8 }, medicineAvailability: 80, specialists: ['General Physician', 'Pediatrician'], isActive: true }));
  const apiResponse = async data => {
    state.apiCalls++;
    if (state.apiFail) return { success: false, error: 'offline' };
    if (state.apiPending) return new Promise(resolve => { (state.apiResolvers ??= []).push(resolve); });
    return { success: true, data };
  };
  const module = load(options.list ? 'FacilityScreen.tsx' : 'FacilityDetailScreen.tsx', {
    react: hooks,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': new Proxy({ StyleSheet: { create: value => value }, Animated: { Value: class {}, sequence: () => ({ start() {} }), timing() {} } }, { get: (obj, key) => obj[key] ?? key }),
    '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
    '@react-navigation/native': { useRoute: () => ({ params: { facilityId: state.facilityId, facility: state.routeFacility, facilitySource: state.facilitySource } }), useNavigation: () => ({ goBack() {}, navigate: (...args) => state.navigation.push(args) }) },
    '@medisync/shared': { COLORS: {}, FacilityType: { SUB_CENTRE: 'SUB_CENTRE', PHC: 'PHC', CHC: 'CHC', DISTRICT_HOSPITAL: 'DISTRICT_HOSPITAL' } },
    '../styles/theme': { theme },
    '../services/api': { MOCK_FACILITIES: facilities, api: { getFacilities: () => apiResponse(facilities), getFacilitySummary: () => apiResponse(summary()), getFacilityInventory: () => apiResponse([]), getFacilityStaff: () => apiResponse([]), updateMedicineStock: () => { assert.fail('No demo writes'); } } },
    '../services/websocket': { wsClient: { connect() { state.sockets++; return () => { state.releases++; }; }, on() { return () => {}; } } },
    '../services/demoMode': { isDemoActive: () => state.demo, onDemoModeChange(fn) { modeListeners.add(fn); return () => modeListeners.delete(fn); } },
    '../i18n': { useTranslation: () => ({ language: state.language, t: key => key }) },
    './bedForecastI18n': i18n,
    '../services/bedForecast': { ...service, fetchBedForecast: async (input, options) => {
      state.calls.push({ input, options });
      if (state.fail) throw new Error('failed');
      if (state.pending) return new Promise(resolve => { state.resolve = resolve; });
      return { prediction: service.heuristicBedForecast(input), source: 'local', localReason: 'not_configured' };
    } },
  }, { setTimeout: (fn, ms) => setTimeout(fn, state.fastTimeout && ms === 8000 ? 10 : ms) });
  const Component = options.list ? module.FacilityScreen : module.FacilityDetailScreen;
  let tree;
  const expand = node => {
    if (Array.isArray(node)) return node.map(expand);
    if (!node || typeof node !== 'object') return node;
    if (typeof node.type === 'function') return expand(node.type(node.props));
    if (node.type === 'FlatList') return { ...node, props: { ...node.props, children: node.props.data.length ? node.props.data.map(item => expand(node.props.renderItem({ item }))) : expand(node.props.ListEmptyComponent) } };
    return { ...node, props: { ...node.props, children: expand(node.props?.children) } };
  };
  const render = () => { cursor = 0; tree = expand(Component()); };
  const text = node => node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(text).join(' ') : typeof node === 'object' ? text(node.props?.children) : String(node);
  const nodes = () => {
    const all = [];
    const walk = node => { if (Array.isArray(node)) node.forEach(walk); else if (node && typeof node === 'object') { all.push(node); walk(node.props?.children); } };
    walk(tree); return all;
  };
  const button = label => nodes().find(node => node.type === 'TouchableOpacity' && text(node).includes(label));
  const click = label => { const node = button(label); assert.ok(node, label); assert.ok(!node.props.disabled); node.props.onPress(); render(); };
  const settle = async () => { for (let i = 0; i < 4; i++) { render(); effects.splice(0).forEach(fn => fn()); await new Promise(resolve => setImmediate(resolve)); } render(); };
  return { state, render, settle, click, button, nodes, module, text: () => text(tree), mode: demo => { state.demo = demo; modeListeners.forEach(fn => fn()); }, unmount: () => {
    cleanups.forEach(fn => fn?.());
    if (previousOrigin === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = previousOrigin;
  } };
}

test('screen never forecasts a snapshot; explicit sample, retry and close work in all languages', async () => {
  const view = screen();
  try {
    await view.settle();
    assert.equal(view.state.calls.length, 0);
    assert.match(view.text(), /No real hourly occupancy history/);
    view.click('Try synthetic forecast demo'); await view.settle();
    assert.equal(view.state.calls.length, 1);
    assert.deepEqual(view.state.calls[0].input, sample());
    for (const lang of ['en', 'hi', 'mr']) {
      view.state.language = lang; view.render();
      const copy = i18n.bedForecastCopy(lang);
      assert.ok(view.text().includes(copy.sample));
      assert.ok(view.text().includes(copy.disclaimer));
      assert.ok(view.text().includes(copy.local));
      for (const horizon of [6, 12, 24, 48]) assert.ok(view.text().includes(`+ ${horizon}   ${copy.hours}`) || view.text().replace(/\s+/g, '').includes(`+${horizon}${copy.hours}`));
    }
    view.state.language = 'en'; view.render();
    view.click('Retry forecast'); await view.settle();
    assert.equal(view.state.calls.length, 2);
    view.click('Close demo');
    assert.ok(view.button('Try synthetic forecast demo'));
    assert.doesNotMatch(view.text(), /Occupied:/);
  } finally { view.unmount(); }
});

test('screen loading disables retry; closing or facility change ignores stale results', async () => {
  const view = screen();
  try {
    await view.settle(); view.state.pending = true;
    view.click('Try synthetic forecast demo');
    assert.match(view.text(), /Calculating sample forecast/);
    assert.equal(view.button('Retry forecast').props.disabled, true);
    view.click('Close demo');
    assert.equal(view.state.calls[0].options.signal.aborted, true);
    view.state.resolve({ prediction: remote(), source: 'ml', localReason: null }); await view.settle();
    assert.doesNotMatch(view.text(), /Synthetic-trained LSTM/);
    view.click('Try synthetic forecast demo');
    view.state.facilityId = 'f2'; await view.settle();
    assert.equal(view.state.calls[1].options.signal.aborted, true);
    assert.ok(view.button('Try synthetic forecast demo'));
    view.state.resolve({ prediction: remote(), source: 'ml', localReason: null }); await view.settle();
    assert.doesNotMatch(view.text(), /Synthetic-trained LSTM/);
  } finally { view.unmount(); }
});

test('screen error is recoverable and unmount aborts in-flight work', async () => {
  const view = screen();
  try {
    await view.settle(); view.state.fail = true;
    view.click('Try synthetic forecast demo'); await view.settle();
    assert.match(view.text(), /Could not calculate/);
    view.state.fail = false; view.click('Retry forecast'); await view.settle();
    assert.doesNotMatch(view.text(), /Could not calculate/);
    assert.match(view.text(), /On-device heuristic fallback/);
    view.state.pending = true; view.click('Retry forecast');
  } finally { view.unmount(); }
  assert.equal(view.state.calls[2].options.signal.aborted, true);
});

test('screen displays remote LSTM and server heuristic provenance without local-source labels', async () => {
  const view = screen();
  try {
    await view.settle(); view.state.pending = true;
    view.click('Try synthetic forecast demo');
    view.state.resolve({ prediction: remote(), source: 'ml', localReason: null }); await view.settle();
    assert.match(view.text(), /ML service \/predict\/beds/);
    assert.match(view.text(), /Synthetic-trained LSTM/);
    assert.doesNotMatch(view.text(), /On-device heuristic fallback/);
    view.click('Retry forecast');
    view.state.resolve({ prediction: { ...service.heuristicBedForecast(sample()), fallback_reason: 'model_not_found' }, source: 'ml', localReason: null }); await view.settle();
    assert.match(view.text(), /Heuristic, not LSTM/);
    assert.match(view.text(), /trained model files are missing/);
    assert.doesNotMatch(view.text(), /Synthetic-trained LSTM/);
  } finally { view.unmount(); }
});

test('demo details use selected bounded sample without API, sockets, live edits or implicit forecast', async () => {
  const selected = { id: 'custom', name: 'Selected sample facility', type: 'PHC', district: 'D', taluka: 'T', contactPhone: '123', beds: { total: 1e9, available: -10 }, medicineAvailability: 500 };
  const view = screen({ demo: true, facilityId: 'custom', routeFacility: selected, facilitySource: 'sample', origin: '' });
  try {
    await view.settle();
    assert.equal(view.state.apiCalls, 0);
    assert.equal(view.state.sockets, 0);
    assert.equal(view.state.calls.length, 0);
    assert.match(view.text(), /DEMO MODE: Synthetic selected facility/);
    assert.match(view.text(), /Selected sample facility/);
    const summary = view.module.sampleFacilitySummary(selected);
    assert.deepEqual(summary.beds, { total: 500, available: 0, occupied: 500, occupancyRate: 100 });
    assert.equal(summary.medicine.overallAvailability, 100);
    assert.deepEqual(view.module.sampleFacilitySummary({ ...selected, beds: { total: NaN, available: Infinity } }).beds, { total: 0, available: 0, occupied: 0, occupancyRate: 0 });
    assert.equal(view.button('Restock'), undefined);
    assert.equal(view.button('Call Facility'), undefined);
    assert.equal(view.button('Send Referral Here'), undefined);
    assert.equal(view.button('123').props.disabled, true);
    view.click('Try synthetic forecast demo'); await view.settle();
    assert.equal(view.state.calls.length, 1);
  } finally { view.unmount(); }
});

test('server mode never uses route sample and errors offer retry instead of permanent loading', async () => {
  const view = screen({ origin: '', routeFacility: { id: 'f1', name: 'Must not show' }, facilitySource: 'sample' });
  try {
    await view.settle();
    assert.match(view.text(), /Server not configured/);
    assert.doesNotMatch(view.text(), /Loading facility details|Must not show/);
    assert.ok(view.button('Retry'));
    process.env.EXPO_PUBLIC_API_URL = 'https://api.health.gov.in';
    view.state.apiFail = true; view.click('Retry'); await view.settle();
    assert.match(view.text(), /unavailable/);
    view.state.apiFail = false; view.click('Retry'); await view.settle();
    assert.match(view.text(), /Hospital/);
    assert.ok(view.button('Try synthetic forecast demo'));
  } finally { view.unmount(); }
});

test('hung detail reads time out; a late server response cannot overwrite demo state', async () => {
  const view = screen({ apiPending: true, fastTimeout: true });
  try {
    await view.settle(); await new Promise(resolve => setTimeout(resolve, 20)); await view.settle();
    assert.match(view.text(), /timed out/);
    view.mode(true); await view.settle();
    assert.match(view.text(), /DEMO MODE/);
    assert.equal(view.state.releases, 1);
    view.state.apiResolvers.forEach(resolve => resolve({ success: true, data: [] })); await view.settle();
    assert.match(view.text(), /DEMO MODE/);
    assert.doesNotMatch(view.text(), /timed out/);
    view.mode(false); view.state.apiPending = false; await view.settle();
    assert.doesNotMatch(view.text(), /DEMO MODE/);
    assert.match(view.text(), /Hospital/);
  } finally { view.unmount(); }
});

test('missing and unknown demo selections show explicit recoverable errors', async () => {
  for (const facilityId of [undefined, 'unknown']) {
    const view = screen({ demo: true, facilityId });
    try {
      await view.settle();
      assert.doesNotMatch(view.text(), /Loading facility details/);
      assert.ok(view.button('Retry'));
      assert.equal(view.state.apiCalls, 0);
    } finally { view.unmount(); }
  }
});

test('demo facility list is labelled, network-free and details link carries selected sample', async () => {
  const view = screen({ list: true, demo: true, origin: '' });
  try {
    await view.settle();
    assert.equal(view.state.apiCalls, 0);
    assert.equal(view.state.sockets, 0);
    assert.match(view.text(), /DEMO MODE/);
    // The nested details control itself must navigate, not rely on parent bubbling.
    const links = view.nodes().filter(node => node.type === 'TouchableOpacity' && node.props.children?.type === 'Text' && node.props.children.props.children?.[0] === 'facility.viewDetails');
    assert.equal(links.length, 2);
    links[1].props.onPress();
    assert.equal(view.state.navigation[0][0], 'FacilityDetail');
    assert.equal(view.state.navigation[0][1].facilityId, 'f2');
    assert.equal(view.state.navigation[0][1].facility.id, 'f2');
    assert.equal(view.state.navigation[0][1].facilitySource, 'sample');
    view.mode(false); view.state.apiFail = true; await view.settle();
    assert.doesNotMatch(view.text(), /Sample f1|Sample f2|DEMO MODE/);
    assert.ok(view.button('Retry'));
    view.state.apiFail = false; view.click('Retry'); await view.settle();
    assert.match(view.text(), /Sample f1/);
  } finally { view.unmount(); }
});

function socketHarness(origin = 'https://api.health.gov.in/api') {
  const state = { demo: false, sockets: [], timers: new Map(), listeners: [] };
  class Socket {
    static OPEN = 1;
    static CONNECTING = 0;
    readyState = 0;
    sent = [];
    constructor(url) { this.url = url; state.sockets.push(this); }
    send(message) { this.sent.push(JSON.parse(message)); }
    close() { this.readyState = 3; this.closed = true; this.onclose?.(); }
  }
  const { wsClient } = load('../services/websocket.ts', {
    '@medisync/shared': {},
    './demoMode': { isDemoActive: () => state.demo, onDemoModeChange: listener => state.listeners.push(listener) },
  }, {
    process: { env: { EXPO_PUBLIC_API_URL: origin } }, WebSocket: Socket,
    setTimeout: fn => { const token = Symbol(); state.timers.set(token, fn); return token; }, clearTimeout: token => state.timers.delete(token),
  });
  return { state, wsClient, mode: demo => { state.demo = demo; state.listeners.forEach(fn => fn()); } };
}

test('WebSocket never connects without valid configuration or in demo; HTTPS becomes WSS', () => {
  for (const origin of ['', 'bad', 'ws://host/ws', 'https://user:pass@api.health.gov.in', 'https://api.health.gov.in/other', 'https://api.health.gov.in?q=x']) {
    const { wsClient, state } = socketHarness(origin);
    wsClient.connect(); assert.equal(state.sockets.length, 0);
  }
  const harness = socketHarness();
  harness.mode(true); harness.wsClient.connect(); assert.equal(harness.state.sockets.length, 0);
  harness.mode(false); const release = harness.wsClient.connect('f1');
  const socket = harness.state.sockets[0];
  assert.equal(socket.url, 'wss://api.health.gov.in/ws');
  socket.readyState = 1; socket.onopen();
  assert.deepEqual(socket.sent[0], { action: 'subscribe', facilityId: 'f1' });
  release(); assert.equal(socket.closed, true); assert.equal(harness.state.timers.size, 0);
});

test('socket mode changes and explicit disconnect clear reconnect timers and suppress stale events', () => {
  const { wsClient, state, mode } = socketHarness();
  let messages = 0;
  const off = wsClient.on('BED_UPDATE', () => messages++);
  wsClient.connect();
  const socket = state.sockets[0];
  const staleClose = socket.onclose, staleMessage = socket.onmessage;
  socket.onmessage({ data: JSON.stringify({ type: 'BED_UPDATE' }) }); assert.equal(messages, 1);
  mode(true);
  staleClose(); staleMessage({ data: JSON.stringify({ type: 'BED_UPDATE' }) });
  assert.equal(messages, 1); assert.equal(state.timers.size, 0);
  mode(false); wsClient.connect(); state.sockets[1].close();
  assert.equal(state.timers.size, 1);
  wsClient.disconnect(); assert.equal(state.timers.size, 0);
  off(); wsClient.connect(); state.sockets[2].onmessage({ data: JSON.stringify({ type: 'BED_UPDATE' }) });
  assert.equal(messages, 1);
  wsClient.disconnect();
});

test('list and details share a socket; releasing one retains and updates the other subscription', () => {
  const { wsClient, state } = socketHarness();
  const releaseList = wsClient.connect();
  const socket = state.sockets[0]; socket.readyState = 1; socket.onopen();
  const releaseDetail = wsClient.connect('f1');
  assert.equal(state.sockets.length, 1);
  assert.deepEqual(socket.sent.at(-1), { action: 'subscribe' });
  releaseList();
  assert.equal(socket.closed, undefined);
  assert.deepEqual(socket.sent.at(-1), { action: 'subscribe', facilityId: 'f1' });
  releaseDetail(); assert.equal(socket.closed, true); assert.equal(state.timers.size, 0);
});
