import { FastifyPluginAsync } from 'fastify';
import { Appointment, QueueEntry, ApiResponse } from '../types/index.js';
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

const appointmentsRoutes: FastifyPluginAsync = async (fastify) => {
  seedDemoAppointments();

  fastify.get<{ Reply: ApiResponse<Appointment[]> }>('/api/appointments', async (request) => {
    const query = request.query as { facilityId?: string; patientId?: string; doctorId?: string; date?: string };

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
    const { id } = request.params as { id: string };
    const appointment = getAppointment(id);

    if (!appointment) {
      return reply.status(404).send({ success: false, error: 'Appointment not found' });
    }

    return { success: true, data: appointment };
  });

  fastify.post<{
    Body: {
      patientId: string;
      patientName: string;
      facilityId: string;
      doctorId?: string;
      dateTime: string;
      type: string;
      priority: string;
    };
    Reply: ApiResponse<Appointment>;
  }>('/api/appointments', async (request, reply) => {
    const body = request.body as {
      patientId: string;
      patientName: string;
      facilityId: string;
      doctorId?: string;
      dateTime: string;
      type: string;
      priority: string;
    };

    const appointment = createAppointment({
      patientId: body.patientId,
      patientName: body.patientName,
      facilityId: body.facilityId,
      doctorId: body.doctorId,
      dateTime: body.dateTime,
      type: body.type as any,
      priority: body.priority as any,
    });

    return reply.code(201).send({ success: true, data: appointment });
  });

  fastify.patch<{
    Params: { id: string };
    Body: { status: string };
    Reply: ApiResponse<Appointment>;
  }>('/api/appointments/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };

    const validStatuses = ['BOOKED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
    if (!validStatuses.includes(status)) {
      return reply.status(400).send({ success: false, error: 'Invalid status' });
    }

    const appointment = updateAppointmentStatus(id, status as any);
    if (!appointment) {
      return reply.status(404).send({ success: false, error: 'Appointment not found or invalid status transition' });
    }

    return { success: true, data: appointment };
  });

  fastify.get<{
    Params: { facilityId: string };
    Reply: ApiResponse<QueueEntry[]>;
  }>('/api/appointments/queue/:facilityId', async (request) => {
    const { facilityId } = request.params as { facilityId: string };
    const queue = getQueue(facilityId);
    return { success: true, data: queue };
  });

  fastify.get<{
    Params: { facilityId: string; date: string };
    Reply: ApiResponse<{ slots: string[] }>;
  }>('/api/appointments/slots/:facilityId/:date', async (request) => {
    const { facilityId, date } = request.params as { facilityId: string; date: string };
    const doctorId = (request.query as { doctorId?: string })?.doctorId;
    const slots = getAvailableSlots(facilityId, date, doctorId);
    return { success: true, data: { slots } };
  });
};

export default appointmentsRoutes;
