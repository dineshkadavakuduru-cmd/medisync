import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import { renameSync, mkdirSync, rmSync } from 'node:fs';
import { setInventory, getInventory } from '../src/services/inventoryService.js';
const app = await buildServer();
setInventory('restart', [{ id: 'm1', facilityId: 'restart', name: 'Medicine', category: 'other', unit: 'tablets', currentStock: 10,
  minThreshold: 2, maxCapacity: 20, lastRestocked: '2026-01-01T00:00:00Z', status: 'ADEQUATE' }]);
try {
  const phase = process.argv[2];
  const created = await app.inject({ method: 'POST', url: '/api/patients', headers: { 'Idempotency-Key': 'restart-patient' },
    payload: { name: 'Visit test patient', age: 25, gender: 'FEMALE', phone: '9876543210', village: 'Village', district: 'District',
      languagePreference: 'en', trimester: 1, nextVisitDate: '2026-01-01' } });
  assert.equal(created.statusCode, 201, created.body);
  const patientId = created.json().data.id;
  const patient = async () => {
    const response = await app.inject(`/api/patients/${patientId}`);
    assert.equal(response.statusCode, 200, response.body);
    return response.json().data;
  };
  const post = (payload: unknown, id: string) => app.inject({ method: 'POST', url: '/api/field-workflows/actions', headers: { 'Idempotency-Key': id }, payload });
  const actions = [
    { id: 'restart-dispense', type: 'DISPENSE_MEDICINE', payload: { facilityId: 'restart', medicineId: 'm1', staffId: 'staff', quantity: 3, timestamp: '2026-01-01T00:00:00Z' } },
    { id: 'restart-visit', type: 'CREATE_ASHA_VISIT', payload: { patientId, ashaId: 'asha1', trimester: 2, checklist: { hb: '12' },
      highRisk: false, highRiskFlags: [], requiresClinicianReview: false, reviewed: true, timestamp: '2026-01-02T12:00:00Z', nextVisitDate: '2026-02-02' } },
  ];
  const pending = { ...actions[1], id: 'restart-pending', payload: { ...actions[1].payload, timestamp: '2026-01-03T12:00:00Z', nextVisitDate: '2026-02-03' } };
  if (phase === 'repair') {
    // The preceding process committed the visit but failed the patient rename.
    assert.equal((await patient()).lastVisit, '2026-01-02');
    const repaired = await app.inject(`/api/field-workflows/visits?patientId=${patientId}`);
    assert.equal(repaired.json().data.patientProjection, 'updated');
    assert.equal(repaired.json().data.visits.length, 2);
    assert.equal((await patient()).lastVisit, '2026-01-03');
    assert.equal((await patient()).nextVisitDate, '2026-02-03');
    const replay = await post(pending, pending.id);
    assert.equal(replay.json().replayed, true);
    assert.equal(replay.json().data.id, pending.id);
    const oldReplay = await post(actions[1], actions[1].id);
    assert.equal(oldReplay.json().data.patientProjection, 'updated');
    assert.equal((await patient()).lastVisit, '2026-01-03');
  } else {
    if (phase === 'replay') {
      assert.equal((await patient()).lastVisit, '2026-01-02');
      assert.equal((await patient()).nextVisitDate, '2026-02-02');
    }
    for (const payload of actions) {
      const response = await post(payload, payload.id);
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.json().replayed, phase === 'replay');
      assert.equal(response.json().data.id, payload.id);
      if (payload.type === 'CREATE_ASHA_VISIT') assert.equal(response.json().data.patientProjection, 'updated');
    }
    assert.equal((await patient()).lastVisit, '2026-01-02');
    assert.equal((await patient()).nextVisitDate, '2026-02-02');
    assert.equal((await patient()).trimester, 2);
    assert.equal((await app.inject(`/api/field-workflows/visits?patientId=${patientId}`)).json().data.visits.length, 1);
    if (phase === 'replay') {
      const path = process.env.PATIENTS_STORE_PATH!;
      renameSync(path, `${path}.backup`); mkdirSync(path);
      try {
        const saved = await post(pending, pending.id);
        assert.equal(saved.statusCode, 200, saved.body);
        assert.equal(saved.json().data.id, pending.id);
        assert.equal(saved.json().data.patientProjection, 'pending');
        assert.equal((await patient()).lastVisit, '2026-01-02');
      } finally { rmSync(path, { recursive: true }); renameSync(`${path}.backup`, path); }
    }
  }
  assert.equal(getInventory('restart')[0].currentStock, 7);
} finally { await app.close(); }
