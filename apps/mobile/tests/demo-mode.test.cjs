const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/demoMode.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;

function harness(saved = null, origin = '', store) {
  const values = new Map(saved === null ? [] : [['demo_mode_active', saved]]);
  store ??= {
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
  };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', 'process', code)(id => {
    assert.equal(id, '@react-native-async-storage/async-storage');
    return store;
  }, mod, mod.exports, { env: { EXPO_PUBLIC_API_URL: origin } });
  return { ...mod.exports, store, values };
}

test('startup restores saved modes and defaults to demo only without an API', async () => {
  for (const [saved, origin, expected] of [
    [null, '', true], [null, 'https://example.test', false],
    ['false', '', false], ['true', 'https://example.test', true],
  ]) {
    const h = harness(saved, origin);
    await h.initDemoMode();
    assert.equal(h.isDemoActive(), expected);
    assert.deepEqual(h.getDemoHeader(), expected ? { 'X-Demo-Mode': 'true' } : {});
  }
});

test('initialization is shared and toggle waits for startup restoration', async () => {
  let restore;
  let reads = 0;
  const writes = [];
  const h = harness(null, '', {
    getItem() { reads++; return new Promise(resolve => { restore = resolve; }); },
    async setItem(key, value) { writes.push(value); },
  });
  const first = h.initDemoMode();
  assert.equal(h.initDemoMode(), first);
  const toggle = h.toggleDemoMode();
  assert.deepEqual(writes, []);
  restore('true');
  assert.equal(await toggle, false);
  assert.equal(reads, 1);
  assert.deepEqual(writes, ['false']);
});

test('failed writes are atomic, do not notify, and do not poison the toggle queue', async () => {
  const h = harness('false');
  await h.initDemoMode();
  const notifications = [];
  const unsubscribe = h.onDemoModeChange(() => notifications.push(h.isDemoActive()));
  const save = h.store.setItem;
  let release;
  h.store.setItem = () => new Promise((resolve, reject) => { release = () => reject(new Error('Disk full')); });
  const failed = h.toggleDemoMode();
  const rejected = assert.rejects(failed, /Disk full/);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.isDemoActive(), false);
  assert.deepEqual(notifications, []);
  release();
  await rejected;
  assert.equal(h.isDemoActive(), false);
  assert.equal(h.values.get('demo_mode_active'), 'false');
  assert.deepEqual(notifications, []);
  h.store.setItem = save;
  assert.equal(await h.toggleDemoMode(), true);
  assert.deepEqual(notifications, [true]);
  const restarted = harness(null, '', h.store);
  await restarted.initDemoMode();
  assert.equal(restarted.isDemoActive(), true);
  unsubscribe();
  await h.toggleDemoMode();
  assert.deepEqual(notifications, [true]);
});

test('concurrent toggles persist in order rather than collapsing into one value', async () => {
  const h = harness('false');
  await h.initDemoMode();
  const values = [];
  h.onDemoModeChange(() => values.push(h.isDemoActive()));
  assert.deepEqual(await Promise.all([h.toggleDemoMode(), h.toggleDemoMode(), h.toggleDemoMode()]), [true, false, true]);
  assert.deepEqual(values, [true, false, true]);
  assert.equal(h.values.get('demo_mode_active'), 'true');
});

test('failed startup can be retried without publishing an unpersisted mode', async () => {
  const h = harness('true');
  const get = h.store.getItem;
  let notifications = 0;
  h.onDemoModeChange(() => notifications++);
  h.store.getItem = async () => { throw new Error('Storage unavailable'); };
  await assert.rejects(h.toggleDemoMode(), /Storage unavailable/);
  assert.equal(h.isDemoActive(), false);
  assert.equal(notifications, 0);
  h.store.getItem = get;
  await h.initDemoMode();
  assert.equal(h.isDemoActive(), true);
  assert.equal(notifications, 1);
});
