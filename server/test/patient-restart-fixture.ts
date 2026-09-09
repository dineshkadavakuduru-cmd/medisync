import assert from 'node:assert/strict';
import Fastify from 'fastify';
import patientsRoutes from '../src/routes/patients.js';
import { createSession, createPrescription, getAllSessions } from '../src/services/teleconsultService.js';

const app = Fastify();
await app.register(patientsRoutes);
const replay = process.argv[2] === 'replay';
try {
  const response = await app.inject({ method: 'POST', url: '/api/patients', headers: { 'Idempotency-Key': 'restart-patient' }, payload: {
    name: 'Synthetic restart patient', age: 30, gender: 'OTHER', phone: '9000000000', village: 'Test', district: 'Test', languagePreference: 'en',
  } });
  assert.equal(response.statusCode, 201, response.body);
  assert.equal(response.headers['idempotency-replayed'], String(replay));
  const patient = response.json().data;
  const record = await app.inject({ method: 'POST', url: `/api/patients/${patient.id}/records`, headers: { 'Idempotency-Key': 'restart-record' }, payload: {
    facilityId: 'facility-2', visitDate: '2026-09-09', doctorName: 'Test', diagnosis: 'Saved assessment',
  } });
  assert.equal(record.statusCode, 201, record.body);
  assert.equal(record.headers['idempotency-replayed'], String(replay));
  if (!replay) {
    const session = createSession({ patientId: patient.id, patientName: patient.name, doctorId: 'doc-1', fromFacilityId: 'facility-2', scheduledTime: '2026-09-10T10:00:00Z' });
    createPrescription({ sessionId: session.id, patientId: patient.id, doctorId: 'doc-1', medications: [{ name: 'Test medicine', dosage: 'Test dose', frequency: 'Test frequency', duration: 'Test duration' }] });
  }
  assert.equal((await app.inject('/api/patients')).json().data.length, 1);
  assert.deepEqual((await app.inject(`/api/patients/${patient.id}/records`)).json().data, [record.json().data]);
  const prescriptions = (await app.inject(`/api/patients/${patient.id}/prescriptions`)).json().data;
  assert.equal(prescriptions.length, 1);
  assert.equal(prescriptions[0].patientId, patient.id);
  assert.equal(prescriptions[0].id, getAllSessions()[0].prescription!.id);
} finally { await app.close(); }
