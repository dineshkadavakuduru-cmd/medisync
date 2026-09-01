const ABDM_SYSTEMS = {
  healthId: 'https://healthid.ndhm.gov.in',
  abhaAddress: 'https://abha.abdm.gov.in',
  consent: 'https://consent.abdm.gov.in',
};

export interface ConsentRequest {
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
  name: string;
  gender: string;
  age: number;
  address: string;
  mobile: string;
  message: string;
}

const VALID_ABHA_PATTERNS = [
  /^\d{2}-\d{4}-\d{4}-\d{4}$/,
  /^\d{14}$/,
];

const consents: Map<string, ConsentRequest> = new Map();

function generateId(): string {
  return `abdm-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function verifyHealthId(abhaId: string): Promise<VerificationResult> {
  return new Promise((resolve) => {
    const isValidFormat = VALID_ABHA_PATTERNS.some((p) => p.test(abhaId));

    setTimeout(() => {
      if (!isValidFormat) {
        resolve({
          valid: false,
          abhaId,
          name: '',
          gender: '',
          age: 0,
          address: '',
          mobile: '',
          message: 'Invalid ABHA ID format',
        });
        return;
      }

      resolve({
        valid: true,
        abhaId,
        name: 'Patient Name (from ABDM)',
        gender: 'M',
        age: 35,
        address: 'Village, District, Maharashtra',
        mobile: 'XXXXXXXXXX',
        message: 'ABHA ID verified successfully',
      });
    }, 300);
  });
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
  const consent: ConsentRequest = {
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
  const consent = consents.get(id);
  if (!consent) return null;
  consent.status = status;
  return consent;
}

export function getConsentsByPatient(patientAbhaId: string): ConsentRequest[] {
  return Array.from(consents.values()).filter((c) => c.patientAbhaId === patientAbhaId);
}

export function generateAbdmPatientOtp(abhaId: string): Promise<{ success: boolean; txnId: string; message: string }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        txnId: `txn-${Date.now()}`,
        message: 'OTP sent to mobile number linked with ABHA ID',
      });
    }, 200);
  });
}

export function verifyAbdmOtp(txnId: string, otp: string): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const success = otp.length === 6;
      resolve({
        success,
        message: success ? 'OTP verified successfully' : 'Invalid OTP',
      });
    }, 200);
  });
}

export function getAbdmSystems(): typeof ABDM_SYSTEMS {
  return ABDM_SYSTEMS;
}
