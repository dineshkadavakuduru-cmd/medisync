import { FastifyPluginAsync } from 'fastify';
import { TeleconsultSession, TeleconsultStatus, Doctor, ApiResponse, DoctorAvailability, Prescription, PrescriptionMedication } from '../types/index.js';
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
  getDoctorAvailability,
  getAvailableSlotsForDoctor,
  createPrescription,
  getPrescriptionBySession,
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

  // Doctor availability endpoints
  fastify.get<{
    Params: { doctorId: string };
    Reply: ApiResponse<DoctorAvailability[]>;
  }>('/api/teleconsult/doctors/:doctorId/availability', async (request, reply) => {
    const { doctorId } = request.params as { doctorId: string };
    if (!getDoctorById(doctorId)) {
      return reply.status(404).send({ success: false, error: 'Doctor not found' });
    }
    return { success: true, data: getDoctorAvailability(doctorId) };
  });

  fastify.get<{
    Params: { doctorId: string; date: string };
    Reply: ApiResponse<{ slots: string[] }>;
  }>('/api/teleconsult/doctors/:doctorId/slots/:date', async (request, reply) => {
    const { doctorId, date } = request.params as { doctorId: string; date: string };
    if (!getDoctorById(doctorId)) {
      return reply.status(404).send({ success: false, error: 'Doctor not found' });
    }
    return { success: true, data: { slots: getAvailableSlotsForDoctor(doctorId, date) } };
  });

  // Prescription endpoints
  fastify.post<{
    Body: {
      sessionId: string;
      patientId: string;
      doctorId: string;
      medications: PrescriptionMedication[];
      notes?: string;
    };
    Reply: ApiResponse<Prescription>;
  }>('/api/teleconsult/prescriptions', {
    schema: { body: {
      type: 'object', additionalProperties: false, required: ['sessionId', 'patientId', 'doctorId', 'medications'],
      properties: {
        sessionId: { type: 'string' },
        patientId: { type: 'string' },
        doctorId: { type: 'string' },
        medications: { type: 'array', minItems: 1, items: { type: 'object', required: ['name', 'dosage', 'frequency', 'duration'], properties: { name: { type: 'string' }, dosage: { type: 'string' }, frequency: { type: 'string' }, duration: { type: 'string' }, instructions: { type: 'string' } } } },
        notes: { type: 'string', maxLength: 500 },
      },
    } },
  }, async (request, reply) => {
    const body = request.body as { sessionId: string; patientId: string; doctorId: string; medications: PrescriptionMedication[]; notes?: string };
    try {
      const prescription = createPrescription(body);
      return reply.code(201).send({ success: true, data: prescription });
    } catch (e) {
      return reply.status(400).send({ success: false, error: e instanceof Error ? e.message : 'Failed to create prescription' });
    }
  });

  fastify.get<{
    Params: { sessionId: string };
    Reply: ApiResponse<Prescription>;
  }>('/api/teleconsult/prescriptions/session/:sessionId', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const prescription = getPrescriptionBySession(sessionId);
    if (!prescription) {
      return reply.status(404).send({ success: false, error: 'Prescription not found' });
    }
    return { success: true, data: prescription };
  });
};

export default teleconsultRoutes;
