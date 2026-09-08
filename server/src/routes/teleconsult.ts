import { FastifyPluginAsync } from 'fastify';
import { TeleconsultSession, TeleconsultStatus, Doctor, ApiResponse } from '../types/index.js';
import { mockFacilities } from '../database/facilities.js';
import {
  createSession,
  getSession,
  getAllSessions,
  getSessionsByDoctor,
  getSessionsByFacility,
  updateSessionStatus,
  getDoctors,
  getDoctorById,
  getDoctorsByFacility,
  seedDemoSessions,
} from '../services/teleconsultService.js';

const teleconsultRoutes: FastifyPluginAsync = async (fastify) => {
  seedDemoSessions();

  fastify.get<{ Reply: ApiResponse<TeleconsultSession[]> }>('/api/teleconsult/sessions', async (request) => {
    const query = request.query as { doctorId?: string; facilityId?: string };

    let sessions: TeleconsultSession[];
    if (query.doctorId) {
      sessions = getSessionsByDoctor(query.doctorId);
    } else if (query.facilityId) {
      sessions = getSessionsByFacility(query.facilityId);
    } else {
      sessions = getAllSessions();
    }

    return { success: true, data: sessions };
  });

  fastify.get<{ Reply: ApiResponse<TeleconsultSession> }>('/api/teleconsult/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = getSession(id);

    if (!session) {
      return reply.status(404).send({ success: false, error: 'Teleconsultation session not found' });
    }

    return { success: true, data: session };
  });

  fastify.post<{
    Body: {
      patientId?: string;
      patientName: string;
      fromFacilityId: string;
      doctorId: string;
      referralId?: string;
      scheduledTime: string;
    };
    Reply: ApiResponse<TeleconsultSession>;
  }>('/api/teleconsult/sessions', {
    schema: { body: {
      type: 'object', additionalProperties: false,
      required: ['patientName', 'fromFacilityId', 'doctorId', 'scheduledTime'],
      properties: {
        patientId: { type: 'string', maxLength: 100 },
        patientName: { type: 'string', minLength: 1, maxLength: 160 },
        fromFacilityId: { type: 'string', minLength: 1 },
        doctorId: { type: 'string', minLength: 1 },
        referralId: { type: 'string', maxLength: 100 },
        scheduledTime: { type: 'string', format: 'date-time' },
      },
    } },
  }, async (request, reply) => {
    const body = request.body as {
      patientId?: string;
      patientName: string;
      fromFacilityId: string;
      doctorId: string;
      referralId?: string;
      scheduledTime: string;
    };

    const doctor = getDoctorById(body.doctorId);
    if (!doctor) {
      return reply.status(400).send({ success: false, error: 'Doctor not found' });
    }
    if (!body.patientName.trim() || !mockFacilities.some((f) => f.id === body.fromFacilityId)) {
      return reply.status(400).send({ success: false, error: 'Invalid patient name or facility' });
    }

    const session = createSession(body);
    return reply.code(201).send({ success: true, data: session });
  });

  fastify.patch<{
    Params: { id: string };
    Body: { status: TeleconsultStatus };
    Reply: ApiResponse<TeleconsultSession>;
  }>('/api/teleconsult/sessions/:id/status', {
    schema: { body: {
      type: 'object', additionalProperties: false, required: ['status'],
      properties: { status: { type: 'string', enum: ['REQUESTED', 'ACCEPTED', 'DECLINED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] } },
    } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body;

    const validStatuses = ['REQUESTED', 'ACCEPTED', 'DECLINED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return reply.status(400).send({ success: false, error: 'Invalid status' });
    }

    if (!getSession(id)) {
      return reply.status(404).send({ success: false, error: 'Teleconsultation session not found' });
    }
    const session = updateSessionStatus(id, status);
    if (!session) {
      return reply.status(409).send({ success: false, error: 'Invalid status transition. Refresh the session.' });
    }

    return { success: true, data: session };
  });

  fastify.get<{ Reply: ApiResponse<Doctor[]> }>('/api/teleconsult/doctors', async () => {
    return { success: true, data: getDoctors() };
  });

  fastify.get<{
    Params: { facilityId: string };
    Reply: ApiResponse<Doctor[]>;
  }>('/api/teleconsult/doctors/facility/:facilityId', async (request) => {
    const { facilityId } = request.params as { facilityId: string };
    return { success: true, data: getDoctorsByFacility(facilityId) };
  });
};

export default teleconsultRoutes;
