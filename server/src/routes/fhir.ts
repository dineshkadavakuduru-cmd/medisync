import { FastifyPluginAsync } from 'fastify';
import { ApiResponse } from '../types/index.js';
import {
  generateFhirPatient,
  generateFhirEncounter,
  generateFhirObservation,
  generateFhirCondition,
  generateFhirBundle,
  importFhirBundle,
} from '../services/fhirService.js';
import {
  verifyHealthId,
  generateConsentArtifact,
  getConsent,
  updateConsentStatus,
  getConsentsByPatient,
  generateAbdmPatientOtp,
  verifyAbdmOtp,
  abhaSchema, consentSchema, consentStatusSchema,
} from '../services/abdmService.js';
import { mockFacilities } from '../database/facilities.js';
import { patients as mockPatients } from '../database/patients.js';
import { z } from 'zod';
import { emptyQuery, idParams, idSchema, validationErrors } from '../validation.js';

const fhirRoutes: FastifyPluginAsync = async (fastify) => {
  validationErrors(fastify);
  fastify.addHook('preValidation', async request => {
    if (!request.routeOptions.url?.startsWith('/api/abdm/')) return;
    emptyQuery.parse(request.query);
    if (request.routeOptions.url.includes(':abhaId')) z.object({ abhaId: abhaSchema }).strict().parse(request.params);
    if (request.routeOptions.url.includes(':id')) idParams.parse(request.params);
    if (request.routeOptions.url.includes(':abhaId') && request.method === 'POST') emptyQuery.optional().parse(request.body);
  });
  fastify.get<{
    Params: { abhaId: string };
    Reply: ApiResponse<ReturnType<typeof generateFhirPatient>>;
  }>('/api/fhir/patient/:abhaId', async (request, reply) => {
    const { abhaId } = request.params as { abhaId: string };
    const patient = mockPatients.find((p) => p.abhaId === abhaId);

    if (!patient) {
      return reply.status(404).send({ success: false, error: 'Patient not found' });
    }

    return { success: true, data: generateFhirPatient(patient) };
  });

  fastify.get<{
    Params: { abhaId: string };
    Reply: ApiResponse<unknown>;
  }>('/api/fhir/patient/:abhaId/bundle', async (request, reply) => {
    const { abhaId } = request.params as { abhaId: string };
    const patient = mockPatients.find((p) => p.abhaId === abhaId);

    if (!patient) {
      return reply.status(404).send({ success: false, error: 'Patient not found' });
    }

    const fhirPatient = generateFhirPatient(patient);
    const facility = mockFacilities.find((f) => f.id === 'facility-2') || mockFacilities[0];
    const encounter = generateFhirEncounter(facility, patient.id, new Date().toISOString(), 'Dr. Sharma', 'General checkup');

    const bundle = generateFhirBundle([fhirPatient, encounter]);
    return { success: true, data: bundle };
  });

  fastify.post<{
    Body: { patientId: string; diagnosis: string; icd10Code?: string };
    Reply: ApiResponse<ReturnType<typeof generateFhirCondition>>;
  }>('/api/fhir/condition', async (request) => {
    const { patientId, diagnosis, icd10Code } = request.body as {
      patientId: string;
      diagnosis: string;
      icd10Code?: string;
    };

    const condition = generateFhirCondition(patientId, diagnosis, icd10Code);
    return { success: true, data: condition };
  });

  fastify.post<{
    Body: { triageResult: any };
    Reply: ApiResponse<ReturnType<typeof generateFhirObservation>>;
  }>('/api/fhir/observations', async (request) => {
    const { triageResult } = request.body as { triageResult: any };
    const observations = generateFhirObservation(triageResult);
    return { success: true, data: observations };
  });

  fastify.post<{
    Body: Record<string, unknown>;
    Reply: ApiResponse<ReturnType<typeof importFhirBundle>>;
  }>('/api/fhir/import', async (request) => {
    const bundle = request.body as Record<string, unknown>;
    const result = importFhirBundle(bundle);
    return { success: true, data: result };
  });

  fastify.post<{
    Params: { abhaId: string };
    Reply: ApiResponse<{ valid: boolean; message: string; name?: string; age?: number }>;
  }>('/api/abdm/verify/:abhaId', { bodyLimit: 1024 }, async (request, reply) => {
    const { abhaId } = request.params as { abhaId: string };
    const result = await verifyHealthId(abhaId);
    return reply.code(503).send({ success: false, error: result.message, data: result });
  });

  fastify.post<{
    Params: { abhaId: string };
    Reply: ApiResponse<Awaited<ReturnType<typeof generateAbdmPatientOtp>>>;
  }>('/api/abdm/generate-otp/:abhaId', { bodyLimit: 1024 }, async (request, reply) => {
    const { abhaId } = request.params as { abhaId: string };
    const result = await generateAbdmPatientOtp(abhaId);
    return reply.code(503).send({ success: false, error: result.message, data: result });
  });

  fastify.post<{
    Body: { txnId: string; otp: string };
    Reply: ApiResponse<{ success: boolean; message: string }>;
  }>('/api/abdm/verify-otp', { bodyLimit: 1024 }, async (request, reply) => {
    const { txnId, otp } = z.object({ txnId: idSchema, otp: z.string().regex(/^[0-9]{6}$/) }).strict().parse(request.body);
    const result = await verifyAbdmOtp(txnId, otp);
    return reply.code(503).send({ success: false, error: result.message, data: result });
  });

  fastify.post<{
    Body: {
      patientAbhaId: string;
      patientName: string;
      requesterId: string;
      requesterName: string;
      purpose: string;
      dataRequested: string[];
      validFrom: string;
      validTo: string;
    };
    Reply: ApiResponse<ReturnType<typeof generateConsentArtifact>>;
  }>('/api/abdm/consent', { bodyLimit: 8192 }, async (request) => {
    const body = consentSchema.parse(request.body);
    const consent = generateConsentArtifact(body);
    return { success: true, data: consent };
  });

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse<ReturnType<typeof getConsent>>;
  }>('/api/abdm/consent/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const consent = getConsent(id);
    if (!consent) {
      return reply.code(404).send({ success: false, error: 'Consent not found' });
    }
    return { success: true, data: consent };
  });

  fastify.patch<{
    Params: { id: string };
    Body: { status: string };
    Reply: ApiResponse<ReturnType<typeof updateConsentStatus>>;
  }>('/api/abdm/consent/:id/status', { bodyLimit: 1024 }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = z.object({ status: consentStatusSchema }).strict().parse(request.body);
    const consent = updateConsentStatus(id, status);
    if (!consent) {
      return reply.status(404).send({ success: false, error: 'Consent not found' });
    }
    return { success: true, data: consent };
  });

  fastify.get<{
    Params: { abhaId: string };
    Reply: ApiResponse<ReturnType<typeof getConsentsByPatient>>;
  }>('/api/abdm/consents/:abhaId', async (request) => {
    const { abhaId } = request.params as { abhaId: string };
    const consents = getConsentsByPatient(abhaId);
    return { success: true, data: consents };
  });
};

export default fhirRoutes;
