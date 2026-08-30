import { FastifyPluginAsync } from 'fastify';
import { ApiResponse, DashboardStats, FacilitiesAnalytics, FacilitySummary, OutbreakAlert, DistrictTrends, FacilityPerformance, PatientFeedback, FeedbackSummary } from '../types/index.js';
import { mockFacilities } from '../database/facilities.js';
import { calculateFacilityMedicineAvailability } from '../services/inventoryService.js';
import { getStaff } from '../services/staffService.js';
import { detectOutbreaks } from '../services/outbreakService.js';
import { getDistrictTrends } from '../services/trendsService.js';
import { getFacilityPerformance, getSingleFacilityPerformance } from '../services/performanceService.js';
import { getAllFeedback, addFeedback, getFeedbackSummary } from '../services/feedbackService.js';

const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  const dashboardStats: DashboardStats = {
    todayReferrals: 14,
    referralTrend: 2,
    medicineAvailability: 82,
    patientsWaiting: 8,
    pendingHighRiskAlerts: 2,
    totalPatients: 4523,
    facilitiesActive: 10,
    avgResponseTimeMinutes: 18,
    referralCompletionRate: 87,
    topConditions: [
      { name: 'Malaria', count: 45 },
      { name: 'Anemia', count: 38 },
      { name: 'Pregnancy Care', count: 32 },
      { name: 'Diabetes', count: 28 },
      { name: 'Dengue', count: 12 },
    ],
  };

  fastify.get<{ Reply: ApiResponse<DashboardStats> }>(
    '/api/analytics/dashboard',
    async () => {
      return {
        success: true,
        data: dashboardStats,
      };
    }
  );

  fastify.get<{ Reply: ApiResponse<FacilitiesAnalytics> }>(
    '/api/analytics/facilities',
    async () => {
      const facilities = mockFacilities.map((f) => {
        const medAvail = calculateFacilityMedicineAvailability(f.id);
        const staff = getStaff(f.id);
        const staffOnDuty = staff.filter((s) => s.isOnDuty).length;
        const bedOccupancy = Math.round((f.beds.occupied / f.beds.total) * 100);
        const performanceScore = Math.round((medAvail + (100 - bedOccupancy) + staffOnDuty * 5) / 3);

        return {
          id: f.id,
          name: f.name,
          type: f.type,
          bedOccupancy,
          medicineAvailability: medAvail,
          staffOnDuty,
          todayPatients: Math.floor(Math.random() * 20) + 1,
          pendingReferrals: Math.floor(Math.random() * 5),
          performanceScore: Math.min(100, performanceScore),
        };
      });

      const totalBeds = mockFacilities.reduce((sum, f) => sum + f.beds.total, 0);
      const availableBeds = mockFacilities.reduce((sum, f) => sum + f.beds.available, 0);
      const avgMedicineAvailability = Math.round(
        facilities.reduce((sum, f) => sum + f.medicineAvailability, 0) / facilities.length
      );
      const totalStaffOnDuty = facilities.reduce((sum, f) => sum + f.staffOnDuty, 0);
      const facilitiesWithCriticalStock = facilities.filter((f) => {
        const medAvail = calculateFacilityMedicineAvailability(f.id);
        return medAvail < 60;
      }).length;

      return {
        success: true,
        data: {
          facilities,
          districtSummary: {
            totalBeds,
            availableBeds,
            avgMedicineAvailability,
            totalStaffOnDuty,
            facilitiesWithCriticalStock,
          },
        },
      };
    }
  );

  fastify.get<{ Reply: ApiResponse<OutbreakAlert[]> }>(
    '/api/analytics/outbreaks',
    async () => {
      const outbreaks = detectOutbreaks();
      return {
        success: true,
        data: outbreaks,
      };
    }
  );

  fastify.get<{ Reply: ApiResponse<DistrictTrends> }>(
    '/api/analytics/trends',
    async () => {
      const trends = getDistrictTrends(12);
      return {
        success: true,
        data: trends,
      };
    }
  );

  fastify.get<{ Reply: ApiResponse<FacilityPerformance[]> }>(
    '/api/analytics/performance',
    async () => {
      const performance = getFacilityPerformance();
      return {
        success: true,
        data: performance,
      };
    }
  );

  fastify.get<{ Params: { id: string }; Reply: ApiResponse<FacilityPerformance> }>(
    '/api/analytics/performance/:id',
    async (request) => {
      const { id } = request.params as { id: string };
      const performance = getSingleFacilityPerformance(id);
      if (!performance) {
        return {
          success: false,
          error: 'Facility not found',
        };
      }
      return {
        success: true,
        data: performance,
      };
    }
  );

  fastify.get<{ Querystring: { facilityId?: string }; Reply: ApiResponse<PatientFeedback[]> }>(
    '/api/analytics/feedback',
    async (request) => {
      const { facilityId } = request.query as { facilityId?: string };
      const feedback = getAllFeedback(facilityId);
      return {
        success: true,
        data: feedback,
      };
    }
  );

  fastify.post<{ Body: Omit<PatientFeedback, 'id'>; Reply: ApiResponse<PatientFeedback> }>(
    '/api/analytics/feedback',
    async (request, reply) => {
      const feedback = addFeedback(request.body);
      return reply.code(201).send({
        success: true,
        data: feedback,
      });
    }
  );

  fastify.get<{ Reply: ApiResponse<FeedbackSummary> }>(
    '/api/analytics/feedback/summary',
    async () => {
      const summary = getFeedbackSummary();
      return {
        success: true,
        data: summary,
      };
    }
  );
};

export default analyticsRoutes;