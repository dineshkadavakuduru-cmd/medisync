import { Patient, Referral, TriageResult, Facility } from '../types/index.js';

const FHIR_SYSTEMS = {
  abha: 'https://ndhm.gov.in/healthid/v1.0',
  mrn: 'https://medisync.plus/mrn',
  loinc: 'http://loinc.org',
  snomed: 'http://snomed.info/s/sct',
  icd10: 'http://hl7.org/fhir/sid/icd-10',
  conditionCategory: 'http://terminology.hl7.org/CodeSystem/condition-category',
};

const GENDER_MAP: Record<string, 'male' | 'female' | 'other' | 'unknown'> = {
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other',
};

export function generateFhirPatient(patient: Patient): Record<string, unknown> {
  return {
    resourceType: 'Patient',
    id: patient.id,
    meta: {
      source: 'https://medisync.plus/fhir',
      lastUpdated: patient.createdAt,
    },
    identifier: [
      {
        system: FHIR_SYSTEMS.abha,
        value: patient.abhaId,
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: 'MR',
            display: 'Medical record number',
          }],
        },
      },
      {
        system: FHIR_SYSTEMS.mrn,
        value: patient.id,
      },
    ],
    name: [{
      use: 'official',
      text: patient.name,
    }],
    gender: GENDER_MAP[patient.gender] || 'unknown',
    birthDate: new Date(Date.now() - patient.age * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    telecom: [{
      system: 'phone',
      value: patient.phone,
      use: 'mobile',
    }],
    address: [{
      use: 'home',
      text: `${patient.village}, ${patient.district}`,
      city: patient.village,
      district: patient.district,
      state: 'Maharashtra',
      country: 'IN',
    }],
    communication: [{
      language: {
        coding: [{
          system: 'urn:ietf:bcp:47',
          code: patient.languagePreference === 'mr' ? 'mr' : patient.languagePreference === 'hi' ? 'hi' : 'en',
          display: patient.languagePreference === 'mr' ? 'Marathi' : patient.languagePreference === 'hi' ? 'Hindi' : 'English',
        }],
      },
      preferred: true,
    }],
  };
}

export function generateFhirEncounter(
  facility: Facility,
  patientId: string,
  visitDate: string,
  doctorName: string,
  diagnosis: string
): Record<string, unknown> {
  return {
    resourceType: 'Encounter',
    id: `enc-${Date.now()}`,
    status: 'finished',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'ambulatory',
    },
    subject: {
      reference: `Patient/${patientId}`,
    },
    participant: [{
      individual: {
        display: doctorName,
      },
    }],
    period: {
      start: visitDate,
      end: visitDate,
    },
    location: [{
      location: {
        display: facility.name,
        reference: `Location/${facility.id}`,
      },
    }],
    diagnosis: [{
      condition: {
        display: diagnosis,
      },
      use: {
        coding: [{
          system: FHIR_SYSTEMS.conditionCategory,
          code: 'encounter-diagnosis',
          display: 'Encounter Diagnosis',
        }],
      },
      rank: 1,
    }],
  };
}

export function generateFhirObservation(triageResult: TriageResult): Record<string, unknown>[] {
  const observations: Record<string, unknown>[] = [];

  observations.push({
    resourceType: 'Observation',
    id: `obs-severity-${Date.now()}`,
    status: 'final',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'exam',
        display: 'Examination',
      }],
    }],
    code: {
      coding: [{
        system: FHIR_SYSTEMS.snomed,
        code: '272391002',
        display: 'Severity',
      }],
      text: 'Triage Severity',
    },
    valueCodeableConcept: {
      coding: [{
        system: 'https://medisync.plus/triage-severity',
        code: triageResult.severity,
        display: `${triageResult.severity} severity`,
      }],
    },
    component: triageResult.vitalSignFlags.length > 0 ? [{
      code: {
        text: 'Vital Sign Flags',
      },
      valueString: triageResult.vitalSignFlags.join('; '),
    }] : undefined,
  });

  if (triageResult.affectedSystems.length > 0) {
    observations.push({
      resourceType: 'Observation',
      id: `obs-systems-${Date.now()}`,
      status: 'final',
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'exam',
        }],
      }],
      code: {
        text: 'Affected Systems',
      },
      valueString: triageResult.affectedSystems.join(', '),
    });
  }

  return observations;
}

export function generateFhirCondition(
  patientId: string,
  diagnosis: string,
  icd10Code?: string
): Record<string, unknown> {
  return {
    resourceType: 'Condition',
    id: `cond-${Date.now()}`,
    clinicalStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
        code: 'active',
      }],
    },
    verificationStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
        code: 'confirmed',
      }],
    },
    category: [{
      coding: [{
        system: FHIR_SYSTEMS.conditionCategory,
        code: 'encounter-diagnosis',
      }],
    }],
    code: {
      coding: [{
        system: icd10Code ? FHIR_SYSTEMS.icd10 : FHIR_SYSTEMS.snomed,
        code: icd10Code || '404684003',
        display: diagnosis,
      }],
      text: diagnosis,
    },
    subject: {
      reference: `Patient/${patientId}`,
    },
  };
}

export function generateFhirReferral(ref: Referral, facility: Facility, toFacility: Facility): Record<string, unknown> {
  return {
    resourceType: 'ServiceRequest',
    id: `sr-${ref.id}`,
    status: ref.status === 'COMPLETED' ? 'completed' : 'active',
    intent: 'order',
    priority: ref.severity === 'RED' ? 'stat' : ref.severity === 'YELLOW' ? 'urgent' : 'routine',
    subject: {
      reference: `Patient/${ref.patientId}`,
    },
    occurrenceDateTime: ref.createdAt,
    reasonCode: [{
      text: ref.reason,
    }],
    performer: [{
      reference: `Organization/${toFacility.id}`,
      display: toFacility.name,
    }],
    locationReference: [{
      reference: `Location/${facility.id}`,
      display: facility.name,
    }],
    note: [{
      text: ref.aiTriageSummary,
    }],
  };
}

export function generateFhirBundle(resources: Record<string, unknown>[]): Record<string, unknown> {
  return {
    resourceType: 'Bundle',
    id: `bundle-${Date.now()}`,
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: resources.map((resource) => ({
      fullUrl: `urn:uuid:${(resource as any).id}`,
      resource,
    })),
  };
}

export function importFhirBundle(bundle: Record<string, unknown>): {
  patients: Partial<Patient>[];
  conditions: { patientId: string; diagnosis: string }[];
  encounters: { patientId: string; facilityId: string; diagnosis: string }[];
} {
  const patients: Partial<Patient>[] = [];
  const conditions: { patientId: string; diagnosis: string }[] = [];
  const encounters: { patientId: string; facilityId: string; diagnosis: string }[] = [];

  const entries = (bundle as any)?.entry || [];
  for (const entry of entries) {
    const resource = entry.resource;
    if (!resource) continue;

    switch (resource.resourceType) {
      case 'Patient': {
        const abhaIdentifier = resource.identifier?.find((i: any) => i.system === FHIR_SYSTEMS.abha);
        const name = resource.name?.[0]?.text || 'Unknown';
        const gender = resource.gender?.toUpperCase() || 'OTHER';
        patients.push({
          abhaId: abhaIdentifier?.value,
          name,
          gender: gender === 'MALE' ? 'MALE' : gender === 'FEMALE' ? 'FEMALE' : 'OTHER',
          age: resource.birthDate ? Math.floor((Date.now() - new Date(resource.birthDate).getTime()) / (365 * 24 * 60 * 60 * 1000)) : 0,
          phone: resource.telecom?.[0]?.value,
          village: resource.address?.[0]?.city,
          district: resource.address?.[0]?.district,
        });
        break;
      }
      case 'Condition': {
        const patientRef = resource.subject?.reference;
        const patientId = patientRef?.replace('Patient/', '');
        const diagnosis = resource.code?.text || resource.code?.coding?.[0]?.display;
        if (patientId && diagnosis) {
          conditions.push({ patientId, diagnosis });
        }
        break;
      }
      case 'Encounter': {
        const patientRef = resource.subject?.reference;
        const patientId = patientRef?.replace('Patient/', '');
        const facilityRef = resource.location?.[0]?.location?.reference;
        const facilityId = facilityRef?.replace('Location/', '');
        const diagnosis = resource.diagnosis?.[0]?.condition?.display;
        if (patientId && facilityId && diagnosis) {
          encounters.push({ patientId, facilityId, diagnosis });
        }
        break;
      }
    }
  }

  return { patients, conditions, encounters };
}
