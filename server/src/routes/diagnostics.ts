import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ApiError, emptyQuery, idParams, idSchema, validationErrors } from '../validation.js';
import {
  createOrder, getOrder, getAllOrders, addTestResult, updateOrderStatus,
  getTestsCatalog, orderSchema, resultSchema, diagnosticStatusSchema, diagnosticStore,
} from '../services/diagnosticsService.js';

const diagnosticsRoutes: FastifyPluginAsync = async fastify => {
  validationErrors(fastify);
  fastify.get('/api/diagnostics/tests', async request => {
    emptyQuery.parse(request.query);
    return { success: true, data: getTestsCatalog().map(({ code, name, unit, normalRange }) => ({ code, name, unit, normalRange })) };
  });
  fastify.get('/api/diagnostics/orders', async request => {
    const { facilityId, patientId, status } = z.object({ facilityId: idSchema.optional(), patientId: idSchema.optional(), status: diagnosticStatusSchema.optional() }).strict().parse(request.query);
    return { success: true, data: getAllOrders().filter(order => (!facilityId || order.facilityId === facilityId) && (!patientId || order.patientId === patientId) && (!status || order.status === status)) };
  });
  fastify.get('/api/diagnostics/orders/:id', async request => {
    emptyQuery.parse(request.query);
    const order = getOrder(idParams.parse(request.params).id);
    if (!order) throw new ApiError(404, 'Diagnostic order not found');
    return { success: true, data: order };
  });
  fastify.post('/api/diagnostics/orders', { bodyLimit: 16384 }, async (request, reply) => {
    emptyQuery.parse(request.query);
    const body = orderSchema.parse(request.body);
    const { data, replayed } = await diagnosticStore.transact(request.headers['idempotency-key'], body, () => createOrder(body, false));
    return reply.code(201).header('Idempotency-Replayed', String(replayed)).send({ success: true, data });
  });
  fastify.patch('/api/diagnostics/orders/:id/result', { bodyLimit: 4096 }, async (request, reply) => {
    emptyQuery.parse(request.query);
    const { id } = idParams.parse(request.params);
    const body = resultSchema.parse(request.body);
    const { data, replayed } = await diagnosticStore.transact(request.headers['idempotency-key'], { method: 'PATCH', id, operation: 'result', body }, () => {
      const order = addTestResult(id, body.testCode, body.value, body.unit, body.flag, body.referenceRange, false);
      if (!order) throw new ApiError(404, 'Diagnostic order not found');
      return order;
    });
    return reply.header('Idempotency-Replayed', String(replayed)).send({ success: true, data });
  });
  fastify.patch('/api/diagnostics/orders/:id/status', { bodyLimit: 1024 }, async (request, reply) => {
    emptyQuery.parse(request.query);
    const { id } = idParams.parse(request.params);
    const body = z.object({ status: diagnosticStatusSchema }).strict().parse(request.body);
    const { data, replayed } = await diagnosticStore.transact(request.headers['idempotency-key'], { method: 'PATCH', id, operation: 'status', body }, () => {
      const order = updateOrderStatus(id, body.status, false);
      if (!order) throw new ApiError(404, 'Diagnostic order not found');
      return order;
    });
    return reply.header('Idempotency-Replayed', String(replayed)).send({ success: true, data });
  });
};
export default diagnosticsRoutes;
