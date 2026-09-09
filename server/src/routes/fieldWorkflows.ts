import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { idSchema, validationErrors } from '../validation.js';
import { createFieldWorkflows, type FieldWorkflowOptions } from '../services/fieldWorkflows.js';
import { patientRepository } from '../services/patientRepository.js';

const fieldWorkflowsRoutes: FastifyPluginAsync<FieldWorkflowOptions> = async (app, options) => {
  validationErrors(app);
  const workflows = createFieldWorkflows({ patientExists: id => {
    try { patientRepository.get(id); return true; } catch (error) {
      if (error instanceof Error && 'statusCode' in error && error.statusCode === 404) return false;
      throw error;
    }
  }, projectPatientVisit: projection => patientRepository.updateVisitProjection(projection), ...options,
  ...(process.env.FIELD_WORKFLOWS_DEMO === 'true' ? { patientExists: undefined, projectPatientVisit: undefined } : {}) });
  app.post('/api/field-workflows/actions', { bodyLimit: 16384 }, async (request, reply) => {
    z.object({}).strict().parse(request.query);
    const result = await workflows.apply(request.body, request.headers['idempotency-key']);
    return reply.header('Idempotency-Replayed', String(result.replayed)).send({ success: true, ...result });
  });
  app.get('/api/field-workflows/inventory', async (request) => {
    const { facilityId } = z.object({ facilityId: idSchema }).strict().parse(request.query);
    return { success: true, data: workflows.inventory(facilityId) };
  });
  app.get('/api/field-workflows/visits', async (request) => {
    const { patientId } = z.object({ patientId: idSchema }).strict().parse(request.query);
    return { success: true, data: await workflows.visits(patientId) };
  });
};
export default fieldWorkflowsRoutes;
