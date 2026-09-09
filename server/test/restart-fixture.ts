import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';

const app = await buildServer();
try {
  for (const [url, key, payload] of [
    ['/api/diagnostics/orders', 'restart-dx', { patientId: 'restart-patient', facilityId: 'facility-2', tests: ['cbc'], orderedBy: 'tester' }],
    ['/api/referrals', 'restart-ref', { patientId: 'restart-patient', fromFacilityId: 'facility-2', symptoms: ['cough'], patientAge: 25, patientGender: 'MALE' }],
  ] as const) {
    const response = await app.inject({ method: 'POST', url, headers: { 'Idempotency-Key': key }, payload });
    assert.ok([200, 201].includes(response.statusCode), response.body);
    assert.equal(response.headers['idempotency-replayed'], process.argv[2] === 'replay' ? 'true' : 'false');
    const resourceUrl = `${url}/${response.json().data.id}`;
    const nextStatus = url.includes('diagnostics') ? 'COMPLETED' : 'ACCEPTED';
    if (url.includes('diagnostics')) {
      for (const [operation, body, expected] of [
        ['status', { status: 'SAMPLE_COLLECTED' }, 'SAMPLE_COLLECTED'],
        ['result', { testCode: 'cbc', value: 'WBC 12000/uL', unit: '', flag: 'ABNORMAL' }, 'COMPLETED'],
      ] as const) {
        const patch = await app.inject({ method: 'PATCH', url: `${resourceUrl}/${operation}`, payload: body, headers: { 'Idempotency-Key': `restart-${operation}` } });
        assert.equal(patch.statusCode, 200, patch.body);
        assert.equal(patch.headers['idempotency-replayed'], process.argv[2] === 'replay' ? 'true' : 'false');
        assert.equal(patch.json().data.status, expected);
        const mismatch = operation === 'status' ? { status: 'CANCELLED' } : { ...body, value: 'Changed' };
        assert.equal((await app.inject({ method: 'PATCH', url: `${resourceUrl}/${operation}`, payload: mismatch, headers: { 'Idempotency-Key': `restart-${operation}` } })).statusCode, 409);
      }
    } else if (process.argv[2] !== 'replay') {
      assert.equal((await app.inject({ method: 'PATCH', url: `${resourceUrl}/status`, payload: { status: nextStatus } })).statusCode, 200);
    }
    const current = await app.inject(resourceUrl);
    assert.equal(current.statusCode, 200);
    assert.equal(current.json().data.status, nextStatus);
    assert.equal(response.json().data.status, url.includes('diagnostics') ? 'ORDERED' : 'CREATED');
    assert.equal((await app.inject(`${url}?patientId=restart-patient`)).statusCode, url.includes('diagnostics') ? 200 : 400);
  }
} finally { await app.close(); }
