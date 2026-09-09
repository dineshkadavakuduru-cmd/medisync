import { z, ZodError } from 'zod';
import type { FastifyInstance } from 'fastify';

export class ApiError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}
export const text = (max: number) => z.string().trim().min(1).max(max);
export const idSchema = text(100).regex(/^[A-Za-z0-9_-]+$/);
export const idParams = z.object({ id: idSchema }).strict();
export const emptyQuery = z.object({}).strict();
export const keySchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/).optional();

// Plugin-scoped so unrelated APIs retain their existing behavior.
export function validationErrors(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ success: false, error: 'Invalid request', issues: error.issues });
    if (error instanceof ApiError) return reply.code(error.statusCode).send({ success: false, error: error.message });
    if (error.statusCode && error.statusCode < 500) return reply.code(error.statusCode).send({ success: false, error: error.message });
    request.log.error({ err: error }, 'Request failed');
    return reply.code(500).send({ success: false, error: 'Internal server error' });
  });
}
