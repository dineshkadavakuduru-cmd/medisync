const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/teleconsultClient.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
const session = { id: 's1', patientName: 'Live patient', doctorName: 'Doctor', status: 'REQUESTED',
  scheduledTime: '2026-09-09T12:00:00Z', createdAt: '2026-09-09T12:00:00Z', meetingLink: '' };

function harness(origin = 'https://example.test') {
  let demo = false;
  const values = new Map();
  const store = { async getItem(key) { return values.get(key) ?? null; }, async setItem(key, value) { values.set(key, value); } };
  const requests = [];
  const h = { store, requests, setDemo(value) { demo = value; }, response: async () => [session] };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', 'process', 'fetch', code)(id => {
    if (id === './demoMode') return { isDemoActive: () => demo };
    if (id === '@react-native-async-storage/async-storage') return store;
    throw new Error(`Unexpected import: ${id}`);
  }, mod, mod.exports, { env: { EXPO_PUBLIC_API_URL: origin } }, async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ success: true, data: await h.response(url, options) }) };
  });
  return Object.assign(h, mod.exports);
}

test('singleton follows demo mode with an API configured and returns to server mode', async () => {
  const h = harness();
  assert.deepEqual(await h.teleconsultClient.list(), [session]);
  h.setDemo(true);
  assert.equal(h.teleconsultClient.isDemo, true);
  const demo = await h.teleconsultClient.createDemo();
  assert.match(demo.id, /^demo-/);
  assert.equal((await h.teleconsultClient.get(demo.id)).patientName, 'Demo patient');
  const accepted = await h.teleconsultClient.update(demo.id, 'ACCEPTED');
  assert.match(accepted.meetingLink, /^https:\/\/meet.jit.si\/medisync-/);
  assert.ok((await h.teleconsultClient.getDoctorAvailability('d')).length);
  assert.ok((await h.teleconsultClient.getAvailableSlots('d', '2026-09-09')).length);
  await h.teleconsultClient.update(demo.id, 'IN_PROGRESS');
  const rx = await h.teleconsultClient.createPrescription({ sessionId: demo.id, patientId: demo.patientId,
    doctorId: demo.doctorId, notes: '  ', medications: [{ name: 'Example', dosage: '1', frequency: 'daily', duration: '1 day', instructions: '' }] });
  assert.equal(Object.hasOwn(rx, 'notes'), false);
  assert.equal(Object.hasOwn(rx.medications[0], 'instructions'), false);
  assert.deepEqual(await h.teleconsultClient.getPrescription(demo.id), rx);
  assert.equal(h.requests.length, 1);
  await assert.rejects(h.configuredApiRequest('/patients'), /Demo mode/);
  h.setDemo(false);
  assert.equal(h.teleconsultClient.isDemo, false);
  assert.deepEqual(await h.teleconsultClient.list(), [session]);
  await assert.rejects(h.teleconsultClient.createDemo(), /server mode/);
});

test('server mode without an API does not silently load demo sessions', async () => {
  const h = harness('');
  assert.equal(h.teleconsultClient.isDemo, false);
  await assert.rejects(h.teleconsultClient.list(), /Not connected/);
  assert.equal(h.requests.length, 0);
  h.setDemo(true);
  assert.deepEqual(await h.teleconsultClient.list(), []);
});

test('mode switch rejects in-flight live responses and local writes waiting for storage', async () => {
  const h = harness();
  h.response = async () => { h.setDemo(true); return [session]; };
  await assert.rejects(h.teleconsultClient.list(), /Mode changed/);
  h.store.getItem = async () => { h.setDemo(false); return null; };
  await assert.rejects(h.teleconsultClient.createDemo(), /Mode changed/);
  h.setDemo(true);
  h.store.getItem = async () => null;
  assert.deepEqual(await h.teleconsultClient.list(), []);
});

test('live prescription omits blank optional fields and trims populated optional text before sending', async () => {
  for (const optional of ['', ' \n ', '  Take with food  ']) {
    const h = harness();
    const input = { sessionId: 's1', patientId: 'p1', doctorId: 'd1', notes: optional,
      medications: [{ name: 'Example', dosage: '1', frequency: 'daily', duration: '1 day', instructions: optional }] };
    h.response = async (url, options) => {
      if (options.method === 'GET') return { ...session, patientId: 'p1', doctorId: 'd1', status: 'IN_PROGRESS',
        meetingLink: `https://meet.jit.si/medisync-${'a'.repeat(48)}` };
      const body = JSON.parse(options.body);
      assert.equal(body.notes, optional.trim() || undefined);
      assert.equal(body.medications[0].instructions, optional.trim() || undefined);
      if (!optional.trim()) {
        assert.equal(Object.hasOwn(body, 'notes'), false);
        assert.equal(Object.hasOwn(body.medications[0], 'instructions'), false);
      }
      return { ...body, id: 'rx1', createdAt: '2026-09-09T12:00:00Z' };
    };
    const result = await h.teleconsultClient.createPrescription(input);
    assert.equal(result.id, 'rx1');
    assert.equal(h.requests.length, 2);
    assert.equal(input.notes, optional);
    assert.equal(input.medications[0].instructions, optional);
  }
});

test('invalid optional prescription types remain validation errors and never send', async () => {
  for (const invalid of [{ notes: 42 }, { medications: [{ name: 'Example', dosage: '1', frequency: 'daily', duration: '1 day', instructions: 42 }] }]) {
    const h = harness();
    await assert.rejects(h.teleconsultClient.createPrescription({ sessionId: 's1', patientId: 'p1', doctorId: 'd1',
      medications: [{ name: 'Example', dosage: '1', frequency: 'daily', duration: '1 day' }], ...invalid }), /Invalid prescription/);
    assert.equal(h.requests.length, 0);
  }
});
