import { z } from 'zod';
import { idSchema, text } from '../validation.js';

export const abhaSchema = z.string().regex(/^(?:[0-9]{14}|[0-9]{2}-[0-9]{4}-[0-9]{4}-[0-9]{4})$/);
export const consentStatusSchema = z.enum(['REQUESTED', 'GRANTED', 'DENIED', 'EXPIRED', 'REVOKED']);
export const consentSchema = z.object({
  patientAbhaId: abhaSchema, patientName: text(160), requesterId: idSchema, requesterName: text(160),
  purpose: text(500), dataRequested: z.array(text(100)).min(1).max(20).refine(values => new Set(values).size === values.length, 'Duplicate data types'),
  validFrom: z.string().datetime(), validTo: z.string().datetime(),
}).strict().refine(value => Date.parse(value.validTo) > Date.parse(value.validFrom), 'validTo must be after validFrom');

const ABDM_SYSTEMS = {
  healthId: 'https://healthid.ndhm.gov.in',
  abhaAddress: 'https://abha.abdm.gov.in',
  consent: 'https://consent.abdm.gov.in',
};

export interface ConsentRequest {
  mode: 'demo';
  legallyValid: false;
  id: string;
  patientAbhaId: string;
  patientName: string;
  requesterId: string;
  requesterName: string;
  purpose: string;
  dataRequested: string[];
  validFrom: string;
  validTo: string;
  status: 'REQUESTED' | 'GRANTED' | 'DENIED' | 'EXPIRED' | 'REVOKED';
  createdAt: string;
}

export interface VerificationResult {
  valid: boolean;
  abhaId: string;
  mode: 'unconfigured';
  verified: false;
  formatValid: boolean;
  message: string;
}

const consents: Map<string, ConsentRequest> = new Map();

function generateId(): string {
  return `abdm-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function verifyHealthId(abhaId: string): Promise<VerificationResult> {
  const formatValid = abhaSchema.safeParse(abhaId).success;
  return Promise.resolve({ valid: false, abhaId, formatValid, verified: false, mode: 'unconfigured',
    message: formatValid ? 'ABDM provider unconfigured; format check is not identity verification' : 'Invalid ABHA ID format; identity not verified' });
}

export function generateConsentArtifact(data: {
  patientAbhaId: string;
  patientName: string;
  requesterId: string;
  requesterName: string;
  purpose: string;
  dataRequested: string[];
  validFrom: string;
  validTo: string;
}): ConsentRequest {
  data = consentSchema.parse(data);
  const consent: ConsentRequest = {
    mode: 'demo',
    legallyValid: false,
    id: generateId(),
    patientAbhaId: data.patientAbhaId,
    patientName: data.patientName,
    requesterId: data.requesterId,
    requesterName: data.requesterName,
    purpose: data.purpose,
    dataRequested: data.dataRequested,
    validFrom: data.validFrom,
    validTo: data.validTo,
    status: 'REQUESTED',
    createdAt: new Date().toISOString(),
  };

  consents.set(consent.id, consent);
  return consent;
}

export function getConsent(id: string): ConsentRequest | undefined {
  return consents.get(id);
}

export function updateConsentStatus(
  id: string,
  status: ConsentRequest['status']
): ConsentRequest | null {
  consentStatusSchema.parse(status);
  const consent = consents.get(id);
  if (!consent) return null;
  consent.status = status;
  return consent;
}

export function getConsentsByPatient(patientAbhaId: string): ConsentRequest[] {
  return Array.from(consents.values()).filter((c) => c.patientAbhaId === patientAbhaId);
}

export async function generateAbdmPatientOtp(abhaId: string) {
  abhaSchema.parse(abhaId);
  return { success: false, mode: 'unconfigured' as const, delivered: false, message: 'ABDM provider unconfigured; no OTP sent' };
}

export async function verifyAbdmOtp(txnId: string, otp: string) {
  idSchema.parse(txnId);
  z.string().regex(/^[0-9]{6}$/).parse(otp);
  return { success: false, mode: 'unconfigured' as const, verified: false, message: 'ABDM provider unconfigured; identity not verified' };
}

export function getAbdmSystems(): typeof ABDM_SYSTEMS {
  return ABDM_SYSTEMS;
}
