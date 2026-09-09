const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(name, mocks = {}) {
  const file = path.join(__dirname, '../src/services', `${name}.ts`);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => id in mocks ? mocks[id] : require(id), mod, mod.exports);
  return mod.exports;
}
const localization = load('../i18n/patientJourney');
const helpers = load('patientHelpers', { '../i18n/patientJourney': localization });
const { createPatientClient } = load('patientClient', {
  '@react-native-async-storage/async-storage': {}, './api': { getApiOrigin: () => '' },
  './demoMode': { isDemoActive: () => false }, './syncService': { syncService: {} }, './patientHelpers': helpers,
  '../i18n/patientJourney': localization,
});
const input = { name: 'Synthetic patient', age: 28, gender: 'FEMALE', phone: '9000000000', village: 'Test village', district: 'Test district', languagePreference: 'mr', abhaId: '' };
function setup() {
  const saved = new Map();
  const storage = { getItem: async key => saved.get(key) || null, setItem: async (key, value) => saved.set(key, value) };
  const actions = [];
  const queue = { getActions: () => actions, enqueue: async action => { actions.push({ ...action, id: `action-${actions.length}`, status: 'pending' }); } };
  const calls = [];
  const send = async (...args) => { calls.push(args); throw new Error('No backend'); };
  return { saved, storage, queue, actions, calls, client: createPatientClient(storage, queue, () => 'https://example.test', () => false, send), send };
}

test('live failures never fall back to demo; live creates persist only via CREATE_PATIENT queue', async () => {
  const { client, calls, actions } = setup();
  await assert.rejects(client.getPatients(), /No backend/);
  const result = await client.createPatient(input);
  assert.equal(result.source, 'outbox');
  assert.equal(calls.length, 1);
  assert.equal(actions[0].type, 'CREATE_PATIENT');
  assert.equal(actions[0].payload.abhaId, '');
  assert.equal(actions[0].payload.id, undefined);
  assert.equal(client.getPendingPatients().length, 1);
  actions[0].status = 'synced';
  assert.equal(client.getPendingPatients().length, 0);
});

test('explicit offline demo persists separately across clients, never fetches or enqueues, never invents Rx', async () => {
  const { client, storage, queue, calls, actions, send, saved } = setup();
  assert.deepEqual(await client.getPatients('demo'), []);
  const created = await Promise.all([client.createPatient(input, 'demo'), client.createPatient(input, 'demo')]);
  const restarted = createPatientClient(storage, queue, () => { throw new Error('Unconfigured'); }, () => true, send);
  assert.equal((await restarted.getPatients()).length, 2);
  const p = await restarted.getPatient(created[0].patient.id);
  assert.match(p.id, /^demo-patient-/);
  assert.equal(p.abhaId, '');
  saved.set('teleconsult.demo.v1', JSON.stringify([{ id: 'demo-session', patientId: 'demo-patient', prescription: {
    id: 'demo-rx', patientId: 'demo-patient', medications: [{ name: 'Unrelated medicine' }],
  } }]));
  assert.deepEqual(await restarted.getPrescriptions(p.id), []);
  assert.deepEqual(await restarted.getRecords(p.id), []);
  assert.deepEqual(await restarted.getDiagnostics(p.id), []);
  assert.deepEqual(await restarted.getReferrals(p.id), []);
  assert.equal(calls.length, 0);
  assert.equal(actions.length, 0);
  await assert.rejects(client.getPatient(p.id, 'live'), /server-confirmed/);
});

test('feature strings have exact en/hi/mr key parity and nonempty translations', () => {
  const { patientJourney } = localization;
  const keys = Object.keys(patientJourney.en).sort();
  assert.ok(keys.length > 80);
  for (const language of ['en', 'hi', 'mr']) {
    assert.deepEqual(Object.keys(patientJourney[language]).sort(), keys);
    for (const key of keys) assert.ok(patientJourney[language][key].trim(), `${language}.${key}`);
  }
  for (const language of ['hi', 'mr']) {
    for (const key of ['name', 'age', 'village', 'district', 'phone', 'language', 'pendingHeading', 'demoSource',
      'modeError', 'ageError', 'saveError', 'timeline', 'savedPrescription', 'printPdf', 'demoHistory']) {
      assert.notEqual(patientJourney[language][key], patientJourney.en[key], `${language}.${key} must be localized`);
    }
  }
});

test('validation errors can change language without revalidation; unknown failures use localized safe guidance', () => {
  let error;
  try { helpers.validatePatient({ ...input, age: 1.5 }); } catch (e) { error = e; }
  for (const language of ['en', 'hi', 'mr']) {
    assert.equal(localization.patientJourneyError(error, language, 'saveError'), localization.patientJourney[language].ageError);
    assert.equal(localization.patientJourneyError(new Error('Network failed'), language, 'loadError'), localization.patientJourney[language].loadError);
    assert.equal(localization.patientJourneyError(new localization.PatientJourneyError('modeError'), language, 'saveError'), localization.patientJourney[language].modeError);
  }
});

test('prescription print/share headings follow UI language without translating clinical text or inventing status', () => {
  const patient = { ...input, id: 'patient-localized', createdAt: '2026-09-09' };
  const rx = { id: 'rx-localized', patientId: patient.id, sessionId: 'tc-localized', doctorId: 'doc-1', doctorName: 'Recorded doctor',
    sessionStatus: 'REQUESTED', createdAt: '2026-09-09', medications: [{ name: 'Recorded <medicine>', dosage: '2 mg', frequency: 'daily', duration: '3 days', instructions: 'Recorded instructions' }], notes: 'Recorded note' };
  for (const language of ['en', 'hi', 'mr']) {
    const copy = localization.patientJourney[language];
    const text = helpers.prescriptionText(patient, rx, language);
    const html = helpers.prescriptionHtml(patient, rx, language);
    assert.ok(text.includes(copy.savedPrescription));
    assert.ok(text.includes(`${copy.dosage} | ${copy.frequency}`));
    assert.ok(text.includes('Recorded <medicine> | 2 mg | daily | 3 days'));
    assert.ok(text.includes(`${copy.consultationStatus}: REQUESTED`));
    assert.ok(html.includes(`<html lang="${language}">`));
    assert.ok(html.includes('Recorded &lt;medicine&gt;'));
    assert.ok(html.includes(copy.copyDisclaimer));
  }
});

test('storage/outbox failures do not report patient saved', async () => {
  const { client, storage, queue } = setup();
  storage.setItem = async () => { throw new Error('Disk full'); };
  queue.enqueue = async () => { throw new Error('Outbox failed'); };
  await assert.rejects(client.createPatient(input, 'demo'), /Disk full/);
  await assert.rejects(client.createPatient(input), /Outbox failed/);
});

test('ANC dates, ages and fake ABHA are rejected; absent optional fields accepted', () => {
  assert.deepEqual(helpers.validatePatient(input), input);
  for (const patch of [{ age: 3.5 }, { age: NaN }, { age: 131 }, { trimester: 4 }, { trimester: 1.5 },
    { nextVisitDate: '2026-02-30' }, { lastVisit: '2026-09-10', nextVisitDate: '2026-09-09' }, { abhaId: 'ABHA-FAKE' }]) {
    assert.throws(() => helpers.validatePatient({ ...input, ...patch }));
  }
});

test('client rejects mismatched prescriptions, keeps only selected patient diagnostics/records', async () => {
  const { storage, queue } = setup();
  const client = createPatientClient(storage, queue, () => 'https://example.test', () => false,
    async () => ({ ok: true, json: async () => ({ success: true, data: [{ id: 'wrong', patientId: 'other' }] }) }));
  await assert.rejects(client.getPrescriptions('patient-1'), /does not match/);
  assert.deepEqual(await client.getRecords('patient-1'), []);
  assert.deepEqual(await client.getDiagnostics('patient-1'), []);
});

test('print HTML escapes all patient/medication text and makes no external PHI requests', () => {
  const patient = { ...input, id: 'patient-1', name: '<script>alert("PHI")</script>', createdAt: '2026-09-09' };
  const rx = { id: 'rx-1', patientId: 'patient-1', sessionId: 'tc-1', doctorId: 'doc-1', doctorName: 'Doctor & Co', sessionStatus: 'REQUESTED', createdAt: '2026-09-09', medications: [{ name: '<img src=x onerror=alert(1)>', dosage: '1', frequency: 'daily', duration: '1 day' }], notes: '</pre><script>bad()</script>' };
  const html = helpers.prescriptionHtml(patient, rx);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('Doctor &amp; Co'));
  assert.ok(!/<script|<img|https?:\/\//i.test(html));
  assert.ok(html.includes('Consultation status: REQUESTED'));
  assert.throws(() => helpers.prescriptionHtml(patient, { ...rx, patientId: 'other' }), /does not belong/);
});
