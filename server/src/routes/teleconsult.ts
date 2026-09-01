import { FastifyPluginAsync } from 'fastify';
import { TeleconsultSession, Doctor, ApiResponse } from '../types/index.js';
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
  }>('/api/teleconsult/sessions', async (request, reply) => {
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

    const session = createSession(body);
    return reply.code(201).send({ success: true, data: session });
  });

  fastify.patch<{
    Params: { id: string };
    Body: { status: string; notes?: string };
    Reply: ApiResponse<TeleconsultSession>;
  }>('/api/teleconsult/sessions/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, notes } = request.body as { status: string; notes?: string };

    const validStatuses = ['REQUESTED', 'ACCEPTED', 'DECLINED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return reply.status(400).send({ success: false, error: 'Invalid status' });
    }

    const session = updateSessionStatus(id, status as any, notes);
    if (!session) {
      return reply.status(404).send({ success: false, error: 'Teleconsultation session not found or invalid status transition' });
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
