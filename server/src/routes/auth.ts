import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { emptyQuery, validationErrors } from '../validation.js';

const phone = z.string().regex(/^(?:\+91)?[6-9][0-9]{9}$/);
const authRoutes: FastifyPluginAsync = async fastify => {
  validationErrors(fastify);
  fastify.post('/api/auth/login', { bodyLimit: 1024 }, async (request, reply) => {
    emptyQuery.parse(request.query);
    z.object({ phone }).strict().parse(request.body);
    return reply.code(503).send({ success: false, error: 'Authentication provider unconfigured; no OTP sent', mode: 'unconfigured', delivered: false });
  });
  fastify.post('/api/auth/verify-otp', { bodyLimit: 1024 }, async (request, reply) => {
    emptyQuery.parse(request.query);
    z.object({ phone, otp: z.string().regex(/^[0-9]{6}$/) }).strict().parse(request.body);
    return reply.code(503).send({ success: false, error: 'Authentication provider unconfigured; identity not verified', mode: 'unconfigured', verified: false });
  });
};
export default authRoutes;
