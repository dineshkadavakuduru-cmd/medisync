import { FastifyPluginAsync } from 'fastify';
import { Referral, ReferralStatus, TriageSeverity, ApiResponse, Facility, VitalSigns, TriageResult } from '../types/index.js';
import { findBestFacility } from '../services/referralRouter.js';
import { assessTriage } from '../services/triageService.js';
import { getAIClinicalSummary } from '../services/aiService.js';
import { mockFacilities } from '../database/facilities.js';

const referralsRoutes: FastifyPluginAsync = async (fastify) => {
  const mockReferrals: Referral[] = [];
  const facilities = mockFacilities as Facility[];

  fastify.post<{
    Body: {
      patientId: string;
      fromFacilityId: string;
      symptoms: string[];
      patientAge: number;
      patientGender: string;
      vitalSigns?: VitalSigns;
      reason?: string;
    };
    Reply: ApiResponse<any>;
  }>('/api/referrals', async (request) => {
    const body = request.body as {
      patientId: string;
      fromFacilityId: string;
      symptoms: string[];
      patientAge: number;
      patientGender: string;
      vitalSigns?: VitalSigns;
      reason?: string;
    };

    const triageResult = assessTriage(body.symptoms, body.patientAge, body.patientGender, body.vitalSigns);
    const aiSummary = await getAIClinicalSummary(body.symptoms, body.vitalSigns, body.patientAge, body.patientGender, triageResult);

    const currentFacility = facilities.find(f => f.id === body.fromFacilityId) || facilities[0];
    const routing = findBestFacility(triageResult.severity, currentFacility, facilities);

    const newReferral: Referral = {
      id: `referral-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      patientId: body.patientId,
      fromFacilityId: body.fromFacilityId,
      toFacilityId: routing.facility.id,
      severity: triageResult.severity,
      status: ReferralStatus.CREATED,
      reason: body.reason || body.symptoms.join(', '),
      aiTriageSummary: aiSummary,
      qrCode: `AROGYA-REF-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockReferrals.push(newReferral);

    return {
      success: true,
      data: {
        ...newReferral,
        toFacility: routing.facility,
        distanceKm: routing.distanceKm,
        routingReason: routing.reason,
      },
    };
  });

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse<Referral>;
  }>('/api/referrals/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const referral = mockReferrals.find(r => r.id === id);

    if (!referral) {
      return reply.status(404).send({ success: false, error: 'Referral not found' });
    }

    return { success: true, data: referral };
  });

  fastify.patch<{
    Params: { id: string };
    Body: { status: ReferralStatus };
    Reply: ApiResponse<Referral>;
  }>('/api/referrals/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: ReferralStatus };

    const referral = mockReferrals.find(r => r.id === id);

    if (!referral) {
      return reply.status(404).send({ success: false, error: 'Referral not found' });
    }

    referral.status = status;
    referral.updatedAt = new Date();

    return { success: true, data: referral };
  });

  fastify.get<{
    Querystring: { status?: string };
    Reply: ApiResponse<Referral[]>;
  }>('/api/referrals', async (request) => {
    const { status } = request.query as { status?: string };

    let results = mockReferrals;
    if (status) {
      results = mockReferrals.filter(r => r.status === status);
    }

    return { success: true, data: results };
  });

  fastify.get<{ Reply: ApiResponse<Referral[]> }>(
    '/api/referrals/active',
    async () => {
      const active = mockReferrals.filter(
        r => r.status !== ReferralStatus.COMPLETED && r.status !== ReferralStatus.DROPPED
      );

      const severityRank: Record<TriageSeverity, number> = { RED: 0, YELLOW: 1, GREEN: 2 };
      active.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

      return { success: true, data: active };
    }
  );
};

export default referralsRoutes;
