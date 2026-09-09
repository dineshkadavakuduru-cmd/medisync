import type { Patient, Prescription } from '@medisync/shared';
import { patientJourney, PatientJourneyError, PatientJourneyLanguage } from '../i18n/patientJourney';

export type PatientInput = Omit<Patient, 'id' | 'createdAt'> & {
  trimester?: number; nextVisitDate?: string; lastVisit?: string;
};
export type JourneyPatient = Patient & Pick<PatientInput, 'trimester' | 'nextVisitDate' | 'lastVisit'>;
export type PatientPrescription = Prescription & { doctorName: string; sessionStatus: string };

export function validatePatient(input: PatientInput): PatientInput {
  const data = { ...input, name: input.name.trim(), phone: input.phone.trim(), village: input.village.trim(), district: input.district.trim(), abhaId: input.abhaId.trim() };
  if ([data.name, data.village, data.district].some(value => !value || value.length > 160)) throw new PatientJourneyError('requiredError');
  if (!Number.isInteger(data.age) || data.age < 0 || data.age > 130) throw new PatientJourneyError('ageError');
  if (!['MALE', 'FEMALE', 'OTHER'].includes(data.gender)) throw new PatientJourneyError('genderError');
  if (!/^\+?[0-9]{10,15}$/.test(data.phone)) throw new PatientJourneyError('phoneError');
  if (!['en', 'hi', 'mr'].includes(data.languagePreference)) throw new PatientJourneyError('languageError');
  if (data.abhaId && !/^(?:\d{14}|\d{2}-\d{4}-\d{4}-\d{4})$/.test(data.abhaId)) throw new PatientJourneyError('abhaError');
  if (data.trimester !== undefined && ![1, 2, 3].includes(data.trimester)) throw new PatientJourneyError('trimesterError');
  for (const value of [data.lastVisit, data.nextVisitDate]) {
    if (value !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new PatientJourneyError('dateError');
  }
  if (data.lastVisit && data.nextVisitDate && data.lastVisit > data.nextVisitDate) throw new PatientJourneyError('dateOrderError');
  return data;
}

export function prescriptionText(patient: JourneyPatient, rx: PatientPrescription, language: PatientJourneyLanguage = 'en'): string {
  const copy = patientJourney[language];
  if (rx.patientId !== patient.id) throw new PatientJourneyError('rxMismatch');
  return [
    `MediSync - ${copy.savedPrescription}`,
    `${copy.patient}: ${patient.name} | ${copy.age}: ${patient.age} | ${copy[patient.gender]}`,
    `${copy.localId}: ${patient.id}`,
    ...(patient.abhaId ? [`${copy.abha}: ${patient.abhaId}`] : []),
    `${copy.prescription}: ${rx.id} | ${copy.session}: ${rx.sessionId}`,
    `${copy.doctor}: ${rx.doctorName} (${rx.doctorId})`,
    `${copy.saved}: ${rx.createdAt} | ${copy.consultationStatus}: ${rx.sessionStatus}`,
    '', `${copy.medication} | ${copy.dosage} | ${copy.frequency} | ${copy.duration}`,
    ...rx.medications.map((m, i) => `${i + 1}. ${m.name} | ${m.dosage} | ${m.frequency} | ${m.duration}${m.instructions ? `\n   ${copy.instructions}: ${m.instructions}` : ''}`),
    ...(rx.notes ? ['', `${copy.notes}: ${rx.notes}`] : []),
    '', copy.copyDisclaimer,
  ].join('\n');
}

export function prescriptionHtml(patient: JourneyPatient, rx: PatientPrescription, language: PatientJourneyLanguage = 'en'): string {
  const escaped = prescriptionText(patient, rx, language).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${patientJourney[language].savedPrescription}</title><style>body{font:16px system-ui,sans-serif;line-height:1.6;margin:32px;color:#172b35}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}@page{margin:20mm}@media print{body{margin:0}}</style></head><body><pre>${escaped}</pre></body></html>`;
}
