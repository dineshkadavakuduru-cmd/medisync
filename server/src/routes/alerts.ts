import { FastifyPluginAsync } from 'fastify';
import { Alert, AlertType, AlertPriority, ApiResponse } from '../types/index.js';

const alertsRoutes: FastifyPluginAsync = async (fastify) => {
  const mockAlerts: Alert[] = [
    {
      id: 'alert-1',
      type: AlertType.EMERGENCY,
      priority: AlertPriority.CRITICAL,
      title: 'Emergency Cardiac Arrest',
      message: 'Patient Rajesh Patil - Severe cardiac arrest symptoms at Mulshi PHC. Immediate transfer required.',
      facilityId: 'facility-2',
      patientId: 'patient-1',
      isResolved: false,
      createdAt: new Date('2024-03-25T10:30:00'),
    },
    {
      id: 'alert-2',
      type: AlertType.STOCK,
      priority: AlertPriority.HIGH,
      title: 'Medicine Stock Critical',
      message: 'Paracetamol stock critically low at Junnar Sub-Centre (5 units remaining)',
      facilityId: 'facility-1',
      isResolved: false,
      createdAt: new Date('2024-03-25T09:15:00'),
    },
    {
      id: 'alert-3',
      type: AlertType.OUTBREAK,
      priority: AlertPriority.MEDIUM,
      title: 'Dengue Spike in Velhe',
      message: 'Unusual spike in dengue-like symptoms in Velhe taluka (12 cases in 3 days)',
      facilityId: 'facility-3',
      isResolved: false,
      createdAt: new Date('2024-03-25T08:00:00'),
    },
    {
      id: 'alert-4',
      type: AlertType.SYSTEM,
      priority: AlertPriority.LOW,
      title: 'Ambulance Dispatched Successfully',
      message: 'Ambulance dispatched to Bhor PHC - Patient picked up successfully',
      facilityId: 'facility-5',
      isResolved: true,
      createdAt: new Date('2024-03-24T16:45:00'),
    },
  ];

  fastify.get<{ Reply: ApiResponse<Alert[]> }>('/api/alerts', async () => {
    return {
      success: true,
      data: mockAlerts,
    };
  });

  fastify.post<{ Body: Omit<Alert, 'id' | 'createdAt'>; Reply: ApiResponse<Alert> }>(
    '/api/alerts',
    async (request, reply) => {
      const body = request.body as Omit<Alert, 'id' | 'createdAt'>;
      const newAlert: Alert = {
        ...body,
        id: `alert-${Date.now()}`,
        createdAt: new Date(),
      };

      mockAlerts.push(newAlert);

      return {
        success: true,
        data: newAlert,
      };
    }
  );

  fastify.patch<{
    Params: { id: string };
    Reply: ApiResponse<Alert>;
  }>('/api/alerts/:id/resolve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const alert = mockAlerts.find((a) => a.id === id);

    if (!alert) {
      return reply.status(404).send({
        success: false,
        error: 'Alert not found',
      });
    }

    alert.isResolved = true;
    alert.createdAt = new Date();

    return {
      success: true,
      data: alert,
    };
  });
};

export default alertsRoutes;
