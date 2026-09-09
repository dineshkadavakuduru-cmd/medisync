import { FastifyPluginAsync } from 'fastify';
import { Referral, ReferralStatus, TriageSeverity, ApiResponse, Facility, VitalSigns } from '../types/index.js';
import { findBestFacility } from '../services/referralRouter.js';
import { assessTriage } from '../services/triageService.js';
import { getAIClinicalSummary } from '../services/aiService.js';
import { mockFacilities } from '../database/facilities.js';
import { z } from 'zod';
import { fileURLToPath, URL } from 'node:url';
import { FileStore } from '../database/fileStore.js';
import { emptyQuery, idParams, idSchema, text, validationErrors } from '../validation.js';

export const referralSchema = z.object({
  patientId: idSchema,
  fromFacilityId: idSchema.refine(id => mockFacilities.some(f => f.id === id), 'Unknown facility'),
  symptoms: z.array(text(100)).min(1).max(50).refine(values => new Set(values).size === values.length, 'Duplicate symptoms'),
  patientAge: z.number().int().min(0).max(120), patientGender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  vitalSigns: z.object({
    temperature: z.number().min(25).max(45).optional(), heartRate: z.number().min(20).max(300).optional(),
    bloodPressureSystolic: z.number().min(40).max(300).optional(), bloodPressureDiastolic: z.number().min(20).max(200).optional(),
    oxygenSaturation: z.number().min(50).max(100).optional(), respiratoryRate: z.number().min(1).max(100).optional(),
  }).strict().refine(v => Object.keys(v).length > 0, 'At least one vital is required').refine(v =>
    (v.bloodPressureSystolic === undefined && v.bloodPressureDiastolic === undefined) ||
    (v.bloodPressureSystolic !== undefined && v.bloodPressureDiastolic !== undefined && v.bloodPressureSystolic > v.bloodPressureDiastolic), 'Provide a complete BP pair with systolic greater than diastolic').optional(),
  reason: text(2000).optional(),
}).strict();
const referralStore = new FileStore<Referral>(process.env.REFERRALS_STORE_PATH || fileURLToPath(new URL('../../data/referrals.json', import.meta.url)));

const referralsRoutes: FastifyPluginAsync = async (fastify) => {
  validationErrors(fastify);
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
  }>('/api/referrals', { bodyLimit: 16384 }, async (request, reply) => {
    emptyQuery.parse(request.query);
    const body = referralSchema.parse(request.body);
    const result = await referralStore.transact(request.headers['idempotency-key'], body, async () => {
      const triageResult = assessTriage(body.symptoms, body.patientAge, body.patientGender, body.vitalSigns);
      const aiSummary = await getAIClinicalSummary(body.symptoms, body.vitalSigns, body.patientAge, body.patientGender, triageResult);
      const currentFacility = facilities.find(f => f.id === body.fromFacilityId)!;
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
        qrCode: `MEDISYNC-REF-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return {
        ...newReferral,
        toFacility: routing.facility,
        distanceKm: routing.distanceKm,
        routingReason: routing.reason,
      };
    });
    return reply.header('Idempotency-Replayed', String(result.replayed)).send({ success: true, data: result.data });
  });

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse<Referral>;
  }>('/api/referrals/:id', async (request, reply) => {
    emptyQuery.parse(request.query);
    const { id } = idParams.parse(request.params);
    const referral = referralStore.get(id);

    if (!referral) {
      return reply.status(404).send({ success: false, error: 'Referral not found' });
    }

    return { success: true, data: referral };
  });

  fastify.patch<{
    Params: { id: string };
    Body: { status: ReferralStatus };
    Reply: ApiResponse<Referral>;
  }>('/api/referrals/:id/status', { bodyLimit: 1024 }, async (request, reply) => {
    emptyQuery.parse(request.query);
    const { id } = idParams.parse(request.params);
    const { status } = z.object({ status: z.nativeEnum(ReferralStatus) }).strict().parse(request.body);

    const referral = referralStore.get(id);

    if (!referral) {
      return reply.status(404).send({ success: false, error: 'Referral not found' });
    }

    referral.status = status;
    referral.updatedAt = new Date();
    referralStore.save(referral);

    return { success: true, data: referral };
  });

  fastify.get<{
    Querystring: { status?: string };
    Reply: ApiResponse<Referral[]>;
  }>('/api/referrals', async (request) => {
    const { status } = z.object({ status: z.nativeEnum(ReferralStatus).optional() }).strict().parse(request.query);

    let results = referralStore.all();
    if (status) {
      results = results.filter(r => r.status === status);
    }

    return { success: true, data: results };
  });

  fastify.get<{ Reply: ApiResponse<Referral[]> }>(
    '/api/referrals/active',
    async request => {
      emptyQuery.parse(request.query);
      const active = referralStore.all().filter(
        r => r.status !== ReferralStatus.COMPLETED && r.status !== ReferralStatus.DROPPED
      );

      const severityRank: Record<TriageSeverity, number> = { RED: 0, YELLOW: 1, GREEN: 2 };
      active.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

      return { success: true, data: active };
    }
  );
};

export default referralsRoutes;
