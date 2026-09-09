const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, mocks, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(
    id => { if (id in mocks) return mocks[id]; throw new Error(`Unexpected import: ${id}`); },
    mod, mod.exports, ...Object.values(globals),
  );
  return mod.exports;
}

function client(url, fetchImpl, demo = false) {
  return load('../services/api.ts', {
    './demoMode': { isDemoActive: () => demo, getDemoHeader: () => demo ? { 'X-Demo-Mode': 'true' } : {} },
    '@medisync/shared': { FacilityType: {}, TriageSeverity: {}, ReferralStatus: {} },
  }, { process: { env: { EXPO_PUBLIC_API_URL: url } }, fetch: fetchImpl });
}

test('API origin normalizes /api and rejects missing or unsafe configuration', () => {
  for (const url of ['https://example.test', 'https://example.test/api/']) {
    assert.equal(client(url).getApiOrigin(), 'https://example.test');
  }
  for (const url of [undefined, '', 'file:///tmp/api', 'https://user:pass@example.test', 'https://example.test/other', 'https://example.test?token=secret']) {
    assert.throws(() => client(url).getApiOrigin());
  }
});

test('real reads and writes reject missing configuration without making a request', async () => {
  const { api } = client(undefined, () => assert.fail('Must not fetch without configuration'));
  for (const operation of [() => api.getPatients(), () => api.getFacilities(), () => api.getDiagnosticsOrders(), () => api.updateBeds('f1', 2)]) {
    await assert.rejects(operation, /EXPO_PUBLIC_API_URL/);
  }
  const dashboard = await api.getDashboardStats();
  assert.equal(dashboard.source, 'sample');
  assert.match(dashboard.limitation, /not live/);
  assert.equal((await api.getActiveReferrals()).source, 'sample');
  assert.equal((await api.getAlerts()).source, 'sample');
});

test('all HTTP mutations reject non-ok responses', async () => {
  const { api } = client('https://example.test', async () => ({ ok: false, status: 503 }));
  const operations = [
    () => api.updateBeds('f', 2), () => api.updateMedicineStock('f', 'm', 2),
    () => api.submitTriage({}), () => api.createReferral({}), () => api.createEmergency({}),
    () => api.acknowledgeEmergency('e', 'u'), () => api.updateEmergencyStatus('e', 'RESOLVED', 'u'),
    () => api.dispatchAmbulance('e'), () => api.submitFeedback({}), () => api.createDiagnosticsOrder({}),
    () => api.addDiagnosticsResult('d', 'cbc', '4', 'g', 'NORMAL'),
    () => api.updateDiagnosticsOrderStatus('d', 'COMPLETED'),
  ];
  for (const operation of operations) await assert.rejects(operation, /HTTP 503/);
});

test('mutations reject negative and malformed success envelopes', async () => {
  for (const body of [{ success: false, error: 'Denied' }, {}, { success: true }, null]) {
    const { api } = client('https://example.test', async () => ({ ok: true, json: async () => body }));
    await assert.rejects(() => api.updateBeds('f', 2), /Denied|confirmed API response/);
  }
});

test('requests retain headers, encode IDs, and combine diagnostic filters', async () => {
  const requests = [];
  const { api } = client('https://example.test/api/', async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ success: true, data: [] }) };
  });
  await api.getPatient('patient/2');
  await api.getDiagnosticsOrders('facility&1', 'patient/2');
  assert.equal(requests[0].url, 'https://example.test/api/patients/patient%2F2');
  assert.equal(requests[1].url, 'https://example.test/api/diagnostics/orders?facilityId=facility%261&patientId=patient%2F2');
  assert.equal(requests[0].options.headers['Content-Type'], 'application/json');
  assert.equal(requests[0].options.headers['X-Demo-Mode'], undefined);
});

test('demo mode blocks live API reads and mutations even with a configured backend', async () => {
  const { api } = client('https://example.test', () => assert.fail('Demo must not fetch'), true);
  await assert.rejects(() => api.getPatients(), /Demo mode/);
  await assert.rejects(() => api.updateBeds('f1', 2), /Demo mode/);
  assert.equal((await api.getDashboardStats()).source, 'sample');
});

test('Watermelon schema registers all existing tables and model paths', () => {
  const mocks = { '@nozbe/watermelondb': require('@nozbe/watermelondb/Schema') };
  for (const name of ['Patient', 'HealthRecord', 'Referral', 'Facility', 'Alert']) mocks[`./models/${name}`] = class {};
  const { schema, models } = load('./index.ts', mocks);
  assert.equal(schema.version, 1);
  assert.deepEqual(Object.keys(schema.tables), ['patients', 'health_records', 'referrals', 'facilities', 'alerts']);
  assert.equal(models.length, 5);
  assert.equal(schema.tables.health_records.columns.patient_id.isIndexed, true);
});
