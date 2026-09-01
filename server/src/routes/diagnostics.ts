import { FastifyPluginAsync } from 'fastify';
import { DiagnosticOrder, TestResult, TestFlag, ApiResponse } from '../types/index.js';
import {
  createOrder,
  getOrder,
  getAllOrders,
  getOrdersByFacility,
  getOrdersByPatient,
  addTestResult,
  updateOrderStatus,
  getTestsCatalog,
  seedDemoOrders,
} from '../services/diagnosticsService.js';

const diagnosticsRoutes: FastifyPluginAsync = async (fastify) => {
  seedDemoOrders();

  fastify.get<{
    Reply: ApiResponse<{ code: string; name: string; unit: string; normalRange: string }[]>;
  }>('/api/diagnostics/tests', async () => {
    const catalog = getTestsCatalog().map((t) => ({ code: t.code, name: t.name, unit: t.unit, normalRange: t.normalRange }));
    return { success: true, data: catalog };
  });

  fastify.get<{
    Querystring: { facilityId?: string; patientId?: string; status?: string };
    Reply: ApiResponse<DiagnosticOrder[]>;
  }>('/api/diagnostics/orders', async (request) => {
    const { facilityId, patientId, status } = request.query as { facilityId?: string; patientId?: string; status?: string };

    let orders: DiagnosticOrder[];
    if (patientId) {
      orders = getOrdersByPatient(patientId);
    } else if (facilityId) {
      orders = getOrdersByFacility(facilityId, status);
    } else {
      orders = getAllOrders();
    }

    return { success: true, data: orders };
  });

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse<DiagnosticOrder>;
  }>('/api/diagnostics/orders/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = getOrder(id);

    if (!order) {
      return reply.status(404).send({ success: false, error: 'Diagnostic order not found' });
    }

    return { success: true, data: order };
  });

  fastify.post<{
    Body: {
      patientId: string;
      facilityId: string;
      triageId?: string;
      referralId?: string;
      tests: string[];
      priority?: string;
      orderedBy: string;
      notes?: string;
    };
    Reply: ApiResponse<DiagnosticOrder>;
  }>('/api/diagnostics/orders', async (request, reply) => {
    const body = request.body as {
      patientId: string;
      facilityId: string;
      triageId?: string;
      referralId?: string;
      tests: string[];
      priority?: string;
      orderedBy: string;
      notes?: string;
    };

    const order = createOrder({
      patientId: body.patientId,
      facilityId: body.facilityId,
      triageId: body.triageId,
      referralId: body.referralId,
      tests: body.tests,
      priority: body.priority as any,
      orderedBy: body.orderedBy,
      notes: body.notes,
    });

    return reply.code(201).send({ success: true, data: order });
  });

  fastify.patch<{
    Params: { id: string };
    Body: { testCode: string; value: string; unit: string; flag: string; referenceRange?: string };
    Reply: ApiResponse<DiagnosticOrder>;
  }>('/api/diagnostics/orders/:id/result', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { testCode, value, unit, flag, referenceRange } = request.body as {
      testCode: string;
      value: string;
      unit: string;
      flag: string;
      referenceRange?: string;
    };

    const validFlags = ['NORMAL', 'ABNORMAL', 'CRITICAL'];
    if (!validFlags.includes(flag)) {
      return reply.status(400).send({ success: false, error: 'Invalid flag' });
    }

    const order = addTestResult(id, testCode, value, unit, flag as TestFlag, referenceRange);
    if (!order) {
      return reply.status(404).send({ success: false, error: 'Diagnostic order not found' });
    }

    return { success: true, data: order };
  });

  fastify.patch<{
    Params: { id: string };
    Body: { status: string };
    Reply: ApiResponse<DiagnosticOrder>;
  }>('/api/diagnostics/orders/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };

    const validStatuses = ['ORDERED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return reply.status(400).send({ success: false, error: 'Invalid status' });
    }

    const order = updateOrderStatus(id, status as any);
    if (!order) {
      return reply.status(404).send({ success: false, error: 'Diagnostic order not found' });
    }

    return { success: true, data: order };
  });
};

export default diagnosticsRoutes;
