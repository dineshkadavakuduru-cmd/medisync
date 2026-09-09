const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/fieldClient.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
let demo = false;
new Function('module', 'exports', 'require', code)(mod, mod.exports, id => {
  if (id === './demoMode') return { isDemoActive: () => demo };
  throw new Error(`Unexpected import ${id}`);
});
const { createFieldClient } = mod.exports;
const inventory = { stocks: [{ id: 'm1', name: 'Medicine', category: 'other', unit: 'tablets', currentStock: 10, minThreshold: 5, maxCapacity: 30 }],
  log: [], orders: [], usage: [], mode: 'manual' };

test('demo mode rejects both reads explicitly without any server requests', async () => {
  let requests = 0;
  const client = createFieldClient('https://example.test', async () => { requests++; throw new Error('Must not fetch'); });
  demo = true;
  try {
    await assert.rejects(client.inventory('f1'), /local only.*unsupported.*no server request/);
    await assert.rejects(client.visits('p1'), /local only.*unsupported.*no server request/);
    assert.equal(requests, 0);
  } finally { demo = false; }
});

test('switching to demo discards an already in-flight live response', async () => {
  const client = createFieldClient('https://example.test', async () => {
    demo = true;
    return { ok: true, json: async () => ({ success: true, data: inventory }) };
  });
  try { await assert.rejects(client.inventory('f1'), /Live field workflow response discarded/); }
  finally { demo = false; }
});

test('field client uses configured origin and encoded query with no fallback data', async () => {
  let url;
  const client = createFieldClient('https://example.test/api', async value => { url = value; return { ok: true, json: async () => ({ success: true, data: inventory }) }; });
  assert.deepEqual(await client.inventory('f 1'), inventory);
  assert.equal(url, 'https://example.test/api/field-workflows/inventory?facilityId=f%201');
  for (const origin of ['', 'ftp://example.test', 'https://example.test/other', 'https://example.test?key=x', 'https://user:secret@example.test']) {
    await assert.rejects(createFieldClient(origin, () => { throw new Error('Must not send'); }).inventory('f1'));
  }
});

test('field client rejects HTTP and malformed stock, usage and order envelopes', async () => {
  for (const [ok, body] of [[false, { success: true, data: inventory }], [true, { success: false, data: inventory }],
    [true, { success: true, data: [] }], [true, { success: true, data: { ...inventory, stocks: [{ ...inventory.stocks[0], currentStock: -1 }] } }],
    [true, { success: true, data: { ...inventory, orders: [{ id: 'po1', medicineId: 'm1', facilityId: 'f1', status: 'INVENTED', quantity: 1, history: [] }] } }],
    [true, { success: true, data: { ...inventory, usage: [{ medicineId: 'm1', total7: 'fake' }] } }]]) {
    const client = createFieldClient('https://example.test', async () => ({ ok, json: async () => body }));
    await assert.rejects(client.inventory('f1'));
  }
});

test('field client validates visit review and patient identity', async () => {
  const visit = { id: 'v1', patientId: 'p1', timestamp: '2026-09-09T00:00:00Z', reviewed: true, highRisk: false, highRiskFlags: [] };
  let data = { visits: [visit], patientProjection: 'pending' };
  const client = createFieldClient('https://example.test', async () => ({ ok: true, json: async () => ({ success: true, data }) }));
  assert.equal((await client.visits('p1')).visits.length, 1);
  await assert.rejects(client.visits('wrong-patient'));
  data = { ...data, visits: [{ ...visit, reviewed: false }] };
  await assert.rejects(client.visits('p1'));
});
