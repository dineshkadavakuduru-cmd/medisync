const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/hooks/useApi.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function harness() {
  let demo = false, cursor = 0, result, changed = false, writes = 0;
  const slots = [], effects = [], cleanups = new Map(), listeners = new Set(), requests = [];
  const same = (a, b) => a && a.length === b.length && b.every((value, index) => Object.is(a[index], value));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; changed = true; writes++; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(fn, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) slots[index] = { fn, deps };
      return slots[index].fn;
    },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!same(slots[index], deps)) {
        slots[index] = deps;
        effects.push(() => { cleanups.get(index)?.(); cleanups.set(index, fn()); });
      }
    },
    useSyncExternalStore(subscribe, snapshot) {
      react.useEffect(() => subscribe(() => { changed = true; }), [subscribe]);
      return snapshot();
    },
  };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => {
    if (id === 'react') return react;
    if (id === '../services/demoMode') return { isDemoActive: () => demo,
      onDemoModeChange: fn => { listeners.add(fn); return () => listeners.delete(fn); } };
    throw new Error(`Unexpected import ${id}`);
  }, mod, mod.exports);
  const render = () => {
    cursor = 0; changed = false;
    const capturedMode = demo;
    // Deliberately new on every render and captures that render's mode.
    result = mod.exports.useApi(() => {
      const gate = deferred(); requests.push({ ...gate, demo: capturedMode }); return gate.promise;
    });
  };
  const settle = async () => {
    for (let i = 0; i < 20; i++) {
      render(); effects.splice(0).forEach(fn => fn()); await flush();
      if (!changed && effects.length === 0) return;
    }
    assert.fail('Hook caused a render loop');
  };
  return { requests, settle, render, get result() { return result; }, get writes() { return writes; },
    switchMode(value) { demo = value; listeners.forEach(fn => fn()); },
    close() { for (const fn of cleanups.values()) fn?.(); assert.equal(listeners.size, 0); },
  };
}

test('mode switch clears existing data before effects and delayed live results cannot overwrite sample data', async t => {
  const h = harness(); t.after(() => h.close());
  await h.settle();
  h.requests[0].resolve({ name: 'Live patient' }); await h.settle();
  assert.equal(h.result.data.name, 'Live patient');
  const old = h.result.refetch(); await h.settle();
  h.switchMode(true); h.render();
  assert.equal(h.result.data, null);
  assert.equal(h.result.error, null);
  assert.equal(h.result.loading, true);
  await h.settle();
  assert.equal(h.requests[2].demo, true);
  h.requests[2].resolve({ source: 'sample' }); await h.settle();
  h.requests[1].resolve({ name: 'Late live patient' }); await old; await h.settle();
  assert.deepEqual(h.result.data, { source: 'sample' });
  assert.equal(h.result.loading, false);
});

test('rapid mode round trip invalidates old requests even if React sees the same final mode', async t => {
  const h = harness(); t.after(() => h.close());
  await h.settle();
  h.switchMode(true); h.switchMode(false);
  h.requests[0].resolve({ stale: true });
  await h.settle();
  assert.equal(h.result.data, null);
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve({ current: true }); await h.settle();
  assert.deepEqual(h.result.data, { current: true });
});

test('switching back to server mode clears sample data and ignores a late demo response', async t => {
  const h = harness(); t.after(() => h.close());
  h.switchMode(true); await h.settle();
  h.requests[0].resolve({ source: 'sample' }); await h.settle();
  const old = h.result.refetch(); await h.settle();
  h.switchMode(false); h.render();
  assert.equal(h.result.data, null);
  await h.settle();
  h.requests[1].resolve({ source: 'old sample' }); await old; await h.settle();
  assert.equal(h.result.data, null);
  assert.equal(h.result.loading, true);
  h.requests[2].resolve({ source: 'server' }); await h.settle();
  assert.deepEqual(h.result.data, { source: 'server' });
});

test('latest refetch wins and stale failures cannot clear loading or set error', async t => {
  const h = harness(); t.after(() => h.close());
  await h.settle();
  const newest = h.result.refetch(); await h.settle();
  h.requests[0].reject(new Error('Old failure')); await h.settle();
  assert.equal(h.result.error, null);
  assert.equal(h.result.loading, true);
  h.requests[1].resolve('newest'); await newest; await h.settle();
  assert.equal(h.result.data, 'newest');
});

test('inline fetch functions do not retrigger loads and refetch uses the latest committed function', async t => {
  const h = harness(); t.after(() => h.close());
  await h.settle();
  const refetch = h.result.refetch;
  h.requests[0].resolve('first'); await h.settle();
  for (let i = 0; i < 5; i++) await h.settle();
  assert.equal(h.result.refetch, refetch);
  assert.equal(h.requests.length, 1);
  h.switchMode(true); await h.settle();
  assert.equal(h.requests[1].demo, true);
  assert.equal(h.result.refetch, refetch);
});

test('unmount ignores delayed completion and retained refetch cannot start new work', async () => {
  const h = harness(); await h.settle();
  const refetch = h.result.refetch;
  h.close();
  const writes = h.writes;
  h.requests[0].reject(new Error('Unmounted')); await flush();
  await refetch();
  assert.equal(h.writes, writes);
  assert.equal(h.requests.length, 1);
});
