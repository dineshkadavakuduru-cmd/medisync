import { FastifyPluginAsync } from 'fastify';
import { patientRepository } from '../services/patientRepository.js';
import { getPrescriptionsByPatient } from '../services/teleconsultService.js';
import { emptyQuery, idParams, validationErrors } from '../validation.js';

const patientsRoutes: FastifyPluginAsync = async (fastify) => {
  validationErrors(fastify);
  fastify.get('/api/patients', async request => {
    emptyQuery.parse(request.query);
    return { success: true, data: patientRepository.all() };
  });
  fastify.post('/api/patients', { bodyLimit: 16384 }, async (request, reply) => {
    emptyQuery.parse(request.query);
    const result = await patientRepository.create(request.body, request.headers['idempotency-key']);
    return reply.code(201).header('Idempotency-Replayed', String(result.replayed)).send({ success: true, data: result.data });
  });
  fastify.get('/api/patients/:id', async request => {
    emptyQuery.parse(request.query);
    return { success: true, data: patientRepository.get(idParams.parse(request.params).id) };
  });
  fastify.get('/api/patients/:id/records', async request => {
    emptyQuery.parse(request.query);
    return { success: true, data: patientRepository.records(idParams.parse(request.params).id) };
  });
  fastify.post('/api/patients/:id/records', { bodyLimit: 16384 }, async (request, reply) => {
    emptyQuery.parse(request.query);
    const result = await patientRepository.addRecord(idParams.parse(request.params).id, request.body, request.headers['idempotency-key']);
    return reply.code(201).header('Idempotency-Replayed', String(result.replayed)).send({ success: true, data: result.data });
  });
  fastify.get('/api/patients/:id/prescriptions', async request => {
    emptyQuery.parse(request.query);
    const { id } = idParams.parse(request.params);
    patientRepository.get(id);
    return { success: true, data: getPrescriptionsByPatient(id) };
  });
};

export default patientsRoutes;
