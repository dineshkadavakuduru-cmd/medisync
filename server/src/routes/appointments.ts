import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Appointment, QueueEntry, ApiResponse, TriageSeverity } from '../types/index.js';
import {
  createAppointment,
  getAppointment,
  getAllAppointments,
  getAppointmentsByFacility,
  getAppointmentsByPatient,
  getAppointmentsByDoctor,
  updateAppointmentStatus,
  getQueue,
  getAvailableSlots,
  seedDemoAppointments,
} from '../services/appointmentService.js';
import { emptyQuery, idParams, idSchema, text, validationErrors } from '../validation.js';

const APPOINTMENT_TYPES = ['OUTPATIENT', 'TELECONSULT', 'DIAGNOSTIC'] as const;
const APPOINTMENT_STATUSES = ['BOOKED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;
const SEVERITIES = ['RED', 'YELLOW', 'GREEN'] as const;

const createBody = z.object({
  patientId: idSchema,
  patientName: text(120),
  facilityId: idSchema,
  doctorId: idSchema.optional(),
  dateTime: z.string().trim().min(10).max(40),
  type: z.enum(APPOINTMENT_TYPES),
  priority: z.enum(SEVERITIES),
}).strict();

const statusBody = z.object({ status: z.enum(APPOINTMENT_STATUSES) }).strict();

const listQuery = z.object({
  facilityId: idSchema.optional(),
  patientId: idSchema.optional(),
  doctorId: idSchema.optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();

const slotsParams = z.object({ facilityId: idSchema, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict();

const appointmentsRoutes: FastifyPluginAsync = async (fastify) => {
  validationErrors(fastify);
  seedDemoAppointments();

  fastify.get<{ Reply: ApiResponse<Appointment[]> }>('/api/appointments', async (request) => {
    const query = listQuery.parse(request.query);

    let appointments: Appointment[];
    if (query.facilityId) {
      appointments = getAppointmentsByFacility(query.facilityId, query.date);
    } else if (query.patientId) {
      appointments = getAppointmentsByPatient(query.patientId);
    } else if (query.doctorId) {
      appointments = getAppointmentsByDoctor(query.doctorId, query.date);
    } else {
      appointments = getAllAppointments();
    }

    return { success: true, data: appointments };
  });

  fastify.get<{ Reply: ApiResponse<Appointment> }>('/api/appointments/:id', async (request, reply) => {
    emptyQuery.parse(request.query);
    const { id } = idParams.parse(request.params);
    const appointment = getAppointment(id);

    if (!appointment) {
      return reply.status(404).send({ success: false, error: 'Appointment not found' });
    }

    return { success: true, data: appointment };
  });

  fastify.post<{
    Reply: ApiResponse<Appointment>;
  }>('/api/appointments', { bodyLimit: 16384 }, async (request, reply) => {
    emptyQuery.parse(request.query);
    const body = createBody.parse(request.body);

    const appointment = createAppointment({ ...body, priority: body.priority as TriageSeverity });

    return reply.code(201).send({ success: true, data: appointment });
  });

  fastify.patch<{
    Reply: ApiResponse<Appointment>;
  }>('/api/appointments/:id/status', async (request, reply) => {
    emptyQuery.parse(request.query);
    const { id } = idParams.parse(request.params);
    const { status } = statusBody.parse(request.body);

    const appointment = updateAppointmentStatus(id, status);
    if (!appointment) {
      return reply.status(404).send({ success: false, error: 'Appointment not found or invalid status transition' });
    }

    return { success: true, data: appointment };
  });

  fastify.get<{
    Reply: ApiResponse<QueueEntry[]>;
  }>('/api/appointments/queue/:facilityId', async (request) => {
    emptyQuery.parse(request.query);
    const { facilityId } = z.object({ facilityId: idSchema }).strict().parse(request.params);
    const queue = getQueue(facilityId);
    return { success: true, data: queue };
  });

  fastify.get<{
    Reply: ApiResponse<{ slots: string[] }>;
  }>('/api/appointments/slots/:facilityId/:date', async (request) => {
    const { facilityId, date } = slotsParams.parse(request.params);
    const doctorId = z.object({ doctorId: idSchema.optional() }).strict().parse(request.query).doctorId;
    const slots = getAvailableSlots(facilityId, date, doctorId);
    return { success: true, data: { slots } };
  });
};

export default appointmentsRoutes;
