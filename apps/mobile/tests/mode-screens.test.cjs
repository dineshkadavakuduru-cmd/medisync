const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, mocks, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(id => {
    if (id in mocks) return mocks[id];
    throw new Error(`Unexpected import: ${id}`);
  }, mod, mod.exports, ...Object.values(globals));
  return mod.exports;
}
const copy = load('i18n/translations/teleconsult.ts', {}).teleconsultCopy;
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function screen(name, client = {}, { demo = false, origin = 'https://example.test' } = {}) {
  let cursor = 0;
  let tree;
  const slots = [];
  const effects = [];
  const cleanups = new Map();
  const listeners = new Set();
  const navigationCalls = [];
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
        effects.push(() => { cleanups.get(index)?.(); cleanups.set(index, callback()); });
      }
    },
  };
  const syncService = { getActions: () => [], getPendingCount: () => 0, isOnline: () => true,
    isSyncing: () => false, lastError: () => '', subscribe: () => () => {}, init: async () => {}, syncAll: async () => {} };
  const mocks = {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': new Proxy({ StyleSheet: { create: value => value }, Platform: { OS: 'web' } }, { get: (target, key) => target[key] || key }),
    '@medisync/shared': { COLORS: {} },
    '../styles/theme': { theme: { layout: {}, spacing: {}, typography: { fontSize: {}, fontWeight: {} }, borderRadius: {}, shadows: {} } },
    '../services/teleconsultClient': { teleconsultClient: client },
    '../services/syncService': { syncService },
    '../services/demoMode': { isDemoActive: () => demo, onDemoModeChange: listener => { listeners.add(listener); return () => listeners.delete(listener); } },
    '../components/TeleconsultMeeting': { TeleconsultMeeting: 'TeleconsultMeeting' },
    '../i18n/translations/teleconsult': { teleconsultCopy: copy },
    '../i18n': { useTranslation: () => ({ language: 'en', t: key => key }) },
  };
  const Component = load(`${name === 'NetworkBanner' ? 'components' : 'screens'}/${name}.tsx`, mocks, {
    process: { env: { EXPO_PUBLIC_API_URL: origin } }, setInterval: () => 1, clearInterval: () => {},
  })[name];
  const props = { route: { params: { sessionId: 's1' } }, navigation: {
    addListener: () => () => {}, navigate: (...args) => navigationCalls.push(args),
  } };
  const render = () => { cursor = 0; tree = Component(props); };
  const nodes = () => {
    const result = [];
    const visit = node => {
      if (Array.isArray(node)) node.forEach(visit);
      else if (node && typeof node === 'object') {
        if (node.type === 'Modal' && !node.props.visible) return;
        result.push(node); visit(node.props?.children);
      }
    };
    visit(tree);
    return result;
  };
  const text = node => node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node)
    : Array.isArray(node) ? node.map(text).join('') : node.type === 'Modal' && !node.props.visible ? '' : text(node.props?.children);
  const settle = async () => { for (let i = 0; i < 5; i++) { render(); effects.splice(0).forEach(fn => fn()); await flush(); } render(); };
  render();
  return { settle, nodes, navigationCalls, text: () => text(tree),
    switchMode(value) { demo = value; listeners.forEach(fn => fn()); render(); },
    click(label) { const node = nodes().find(n => n.type === 'TouchableOpacity' && text(n) === label); assert.ok(node, `Missing ${label}`); assert.ok(!node.props.disabled); node.props.onPress(); render(); },
    close() { for (const cleanup of cleanups.values()) cleanup?.(); assert.equal(listeners.size, 0); },
  };
}

const live = { id: 's1', patientName: 'Live patient', doctorName: 'Live doctor', patientId: 'p1', doctorId: 'd1',
  status: 'IN_PROGRESS', scheduledTime: '2026-09-09T12:00:00Z', startedAt: '2026-09-09T12:00:00Z',
  meetingLink: `https://meet.jit.si/medisync-${'a'.repeat(48)}` };

test('list clears data on switch, ignores late loads and does not navigate after stale demo creation', async t => {
  const gate = deferred();
  const created = deferred();
  let list = async () => [live];
  const h = screen('TeleconsultListScreen', { list: () => list(), createDemo: () => created.promise });
  t.after(() => h.close());
  await h.settle();
  assert.match(h.text(), /Live patient/);
  list = () => gate.promise;
  h.click(copy.retry);
  list = async () => [];
  h.switchMode(true);
  assert.doesNotMatch(h.text(), /Live patient/);
  await h.settle();
  gate.resolve([live]);
  await h.settle();
  assert.doesNotMatch(h.text(), /Live patient/);
  h.click(copy.create);
  h.switchMode(false);
  created.resolve({ ...live, id: 'demo-stale' });
  await h.settle();
  assert.deepEqual(h.navigationCalls, []);
  assert.doesNotMatch(h.text(), /Create local demo request/);
});

test('join closes meeting and prescription modal on switch without completing or accepting stale callbacks', async t => {
  const gate = deferred();
  const updates = [];
  let get = async () => live;
  const h = screen('TeleconsultJoinScreen', { get: () => get(), update: (...args) => { updates.push(args); return live; } });
  t.after(() => h.close());
  await h.settle();
  h.click(copy.doctor);
  h.click(copy.join);
  const meeting = h.nodes().find(node => node.type === 'TeleconsultMeeting');
  assert.ok(meeting);
  h.click(copy.writePrescription);
  assert.ok(h.nodes().some(node => node.type === 'Modal'));
  get = () => gate.promise;
  h.click(copy.retry);
  get = async () => { throw new Error('No session in this mode'); };
  h.switchMode(true);
  assert.doesNotMatch(h.text(), /Live patient/);
  assert.ok(!h.nodes().some(node => ['Modal', 'TeleconsultMeeting'].includes(node.type)));
  meeting.props.onJoined();
  meeting.props.onLeft();
  gate.resolve(live);
  await h.settle();
  assert.deepEqual(updates, []);
  assert.doesNotMatch(h.text(), /Live patient/);
  assert.match(h.text(), /No session in this mode/);
});

test('banner follows explicit mode and labels server mode without an API as unconfigured, not demo or online', async t => {
  const h = screen('NetworkBanner', {}, { origin: '' });
  t.after(() => h.close());
  await h.settle();
  assert.match(h.text(), /Server mode: backend not configured/);
  assert.doesNotMatch(h.text(), /Demo:|Online/);
  h.switchMode(true);
  await h.settle();
  assert.match(h.text(), /Demo: synthetic data/);
  assert.doesNotMatch(h.text(), /Server mode: backend not configured/);
  h.switchMode(false);
  await h.settle();
  assert.match(h.text(), /Server mode: backend not configured/);
  const configured = screen('NetworkBanner');
  t.after(() => configured.close());
  await configured.settle();
  assert.equal(configured.text(), '');
  configured.switchMode(true);
  await configured.settle();
  assert.match(configured.text(), /Demo: synthetic data/);
});
