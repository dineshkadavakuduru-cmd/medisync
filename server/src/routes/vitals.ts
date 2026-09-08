import type { FastifyPluginAsync } from 'fastify';
import { createVitalsService, VitalsError } from '../services/vitalsService.js';

// Main integration: await fastify.register(vitalsRoutes), after auth hooks.
const vitalsRoutes: FastifyPluginAsync = async fastify => {
  const configured = process.env.VITALS_MODE || 'demo';
  if (configured !== 'demo' && configured !== 'measured') throw new Error('VITALS_MODE must be demo or measured');
  const service = createVitalsService({ mode: configured, databaseUrl: process.env.DATABASE_URL });
  fastify.addHook('onClose', async () => service.close());
  await service.init();
  fastify.post<{ Params: { id: string }; Body: unknown }>('/api/emergencies/:id/vitals', { bodyLimit: 2048 }, async (request, reply) => {
    try {
      const data = await service.append(request.params.id, request.body, request.headers['x-demo-mode'] === 'true');
      return reply.code(201).send({ success: true, data, mode: service.mode });
    } catch (error) {
      if (error instanceof VitalsError) return reply.code(error.statusCode).send({ success: false, error: error.message });
      request.log.error({ err: error }, 'Vitals storage failed');
      return reply.code(503).send({ success: false, error: 'Vitals storage unavailable; reading not confirmed' });
    }
  });
  fastify.get<{ Params: { id: string }; Querystring: { limit?: string } }>('/api/emergencies/:id/vitals', async (request, reply) => {
    try {
      const limit = request.query.limit === undefined ? 120 : Number(request.query.limit);
      const data = await service.history(request.params.id, limit, request.headers['x-demo-mode'] === 'true');
      return { success: true, data, mode: service.mode, retention: 120 };
    } catch (error) {
      if (error instanceof VitalsError) return reply.code(error.statusCode).send({ success: false, error: error.message });
      request.log.error({ err: error }, 'Vitals history failed');
      return reply.code(503).send({ success: false, error: 'Vitals history unavailable' });
    }
  });
};
export default vitalsRoutes;
