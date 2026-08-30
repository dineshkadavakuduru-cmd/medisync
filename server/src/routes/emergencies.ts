import { FastifyPluginAsync } from 'fastify';
import { Emergency, EmergencyStatus, EmergencyProtocolLevel, ApiResponse, Ambulance, EmergencyStats } from '../types/index.js';
import {
  createEmergency,
  acknowledgeEmergency,
  updateEmergencyStatus,
  getActiveEmergencies,
  getEmergencyTimeline,
  getEmergencyStats as computeEmergencyStats,
  getAmbulances,
  getEmergencyById,
  seedAmbulances,
  seedDemoEmergencies,
  emergencies,
} from '../services/emergencyService.js';

const emergenciesRoutes: FastifyPluginAsync = async (fastify) => {
  seedAmbulances();
  seedDemoEmergencies();

  fastify.post<{ Body: { patientId?: string; patientName: string; patientAge: number; patientGender: string; condition: string; description: string; originFacilityId: string; initiatedBy: string }; Reply: ApiResponse<Emergency> }>(
    '/api/emergencies',
    async (request, reply) => {
      const body = request.body as { patientId?: string; patientName: string; patientAge: number; patientGender: string; condition: string; description: string; originFacilityId: string; initiatedBy: string };
      const emergency = createEmergency(body);
      return { success: true, data: emergency };
    }
  );

  fastify.get<{ Reply: ApiResponse<Emergency[]> }>('/api/emergencies', async (request) => {
    const query = request.query as { status?: string };
    if (query.status === 'all') {
      return { success: true, data: Array.from(emergencies.values()).sort((a: Emergency, b: Emergency) => {
        const levelOrder: Record<EmergencyProtocolLevel, number> = { LEVEL_1: 0, LEVEL_2: 1, LEVEL_3: 2 };
        if (levelOrder[a.protocolLevel] !== levelOrder[b.protocolLevel]) return levelOrder[a.protocolLevel] - levelOrder[b.protocolLevel];
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }) as Emergency[] };
    }
    return { success: true, data: getActiveEmergencies() };
  });

  fastify.get<{ Params: { id: string }; Reply: ApiResponse<Emergency> }>('/api/emergencies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const emergency = getEmergencyById(id);
    if (!emergency) {
      return reply.status(404).send({ success: false, error: 'Emergency not found' });
    }
    return { success: true, data: emergency };
  });

  fastify.patch<{ Params: { id: string }; Body: { userId: string }; Reply: ApiResponse<Emergency> }>('/api/emergencies/:id/acknowledge', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.body as { userId: string };
    const emergency = acknowledgeEmergency(id, userId);
    if (!emergency) {
      return reply.status(404).send({ success: false, error: 'Emergency not found' });
    }
    return { success: true, data: emergency };
  });

  fastify.patch<{ Params: { id: string }; Body: { status: EmergencyStatus; userId: string; notes?: string }; Reply: ApiResponse<Emergency> }>(
    '/api/emergencies/:id/status',
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { status, userId, notes } = request.body as { status: EmergencyStatus; userId: string; notes?: string };
      const emergency = updateEmergencyStatus(id, status, userId, notes);
      if (!emergency) {
        return reply.status(404).send({ success: false, error: 'Emergency not found' });
      }
      return { success: true, data: emergency };
    }
  );

  fastify.post<{ Params: { id: string }; Reply: ApiResponse<{ ambulance: Ambulance; emergency: Emergency }> }>('/api/emergencies/:id/dispatch', async (request, reply) => {
    const { id } = request.params as { id: string };
    const emergency = getEmergencyById(id);
    if (!emergency) {
      return reply.status(404).send({ success: false, error: 'Emergency not found' });
    }
    const ambulance = (await import('../services/emergencyService.js')).dispatchAmbulance(id);
    if (!ambulance) {
      return reply.status(400).send({ success: false, error: 'No ambulances available' });
    }
    return { success: true, data: { ambulance, emergency } };
  });

  fastify.get<{ Params: { id: string }; Reply: ApiResponse<{ timeline: import('../types/index.js').EmergencyEvent[] }> }>('/api/emergencies/:id/timeline', async (request) => {
    const { id } = request.params as { id: string };
    return { success: true, data: { timeline: getEmergencyTimeline(id) } };
  });

  fastify.get<{ Reply: ApiResponse<EmergencyStats> }>('/api/emergencies/stats', async () => {
    return { success: true, data: computeEmergencyStats() };
  });

  fastify.get<{ Reply: ApiResponse<Ambulance[]> }>('/api/ambulances', async () => {
    return { success: true, data: getAmbulances() };
  });
};

export default emergenciesRoutes;
