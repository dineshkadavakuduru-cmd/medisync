import {
  TriageResult,
  TriageSeverity,
  FacilityType,
  VitalSigns,
  SymptomEntry,
} from '../types/index.js';

export const SYMPTOM_DATABASE: Record<string, SymptomEntry> = {
  chest_pain: { id: 'chest_pain', label: 'Chest Pain', labelHi: 'छाती में दर्द', labelMr: 'छातीत दुखणे', system: 'cardiac', weight: 10, redFlag: true },
  unconscious: { id: 'unconscious', label: 'Unconscious', labelHi: 'बेहोश', labelMr: 'बेशुद्ध', system: 'neurological', weight: 10, redFlag: true },
  severe_bleeding: { id: 'severe_bleeding', label: 'Severe Bleeding', labelHi: 'अत्यधिक रक्तस्राव', labelMr: 'गंभीर रक्तस्त्राव', system: 'trauma', weight: 10, redFlag: true },
  difficulty_breathing: { id: 'difficulty_breathing', label: 'Difficulty Breathing', labelHi: 'सांस लेने में कठिनाई', labelMr: 'श्वास घेण्यास त्रास', system: 'respiratory', weight: 9, redFlag: true },
  seizures: { id: 'seizures', label: 'Seizures', labelHi: 'दौरे', labelMr: 'फाटा', system: 'neurological', weight: 9, redFlag: true },
  stroke_symptoms: { id: 'stroke_symptoms', label: 'Stroke Symptoms', labelHi: 'स्ट्रोक के लक्षण', labelMr: 'स्ट्रोकची लक्षणे', system: 'neurological', weight: 10, redFlag: true },
  severe_burns: { id: 'severe_burns', label: 'Severe Burns', labelHi: 'गंभीर जलना', labelMr: 'गंभीर जळ', system: 'trauma', weight: 9, redFlag: true },
  poisoning: { id: 'poisoning', label: 'Poisoning', labelHi: 'जहरा', labelMr: 'विष', system: 'toxicology', weight: 10, redFlag: true },
  snakebite: { id: 'snakebite', label: 'Snakebite', labelHi: 'सांप का काट', labelMr: 'सापाचा सोंड', system: 'toxicology', weight: 10, redFlag: true },
  severe_allergic_reaction: { id: 'severe_allergic_reaction', label: 'Severe Allergic Reaction', labelHi: 'गंभीर एलर्जिक रिएक्शन', labelMr: 'गंभीर एलर्जिक प्रतिक्रिया', system: 'immunology', weight: 9, redFlag: true },
  high_fever: { id: 'high_fever', label: 'High Fever', labelHi: 'तेज बुखार', labelMr: 'उच्च ताप', system: 'infectious', weight: 7, redFlag: false },
  persistent_vomiting: { id: 'persistent_vomiting', label: 'Persistent Vomiting', labelHi: 'लगातार उल्टी', labelMr: 'सतत उलटी', system: 'gi', weight: 6, redFlag: false },
  severe_abdominal_pain: { id: 'severe_abdominal_pain', label: 'Severe Abdominal Pain', labelHi: 'गंभीर पेट दर्द', labelMr: 'गंभीर उदर दुख', system: 'gi', weight: 7, redFlag: false },
  dehydration: { id: 'dehydration', label: 'Dehydration', labelHi: 'निर्जलीकरण', labelMr: 'निर्जलीकरण', system: 'general', weight: 6, redFlag: false },
  high_blood_pressure: { id: 'high_blood_pressure', label: 'High Blood Pressure', labelHi: 'उच्च रक्तचाप', labelMr: 'उच्च रक्तदाब', system: 'cardiac', weight: 6, redFlag: false },
  severe_headache: { id: 'severe_headache', label: 'Severe Headache', labelHi: 'गंभीर सिरदर्द', labelMr: 'गंभीर डोकेदुख', system: 'neurological', weight: 5, redFlag: false },
  bloody_stool: { id: 'bloody_stool', label: 'Bloody Stool', labelHi: 'रक्त युक्त मल', labelMr: 'रक्त पाळी', system: 'gi', weight: 7, redFlag: false },
  pregnancy_complication: { id: 'pregnancy_complication', label: 'Pregnancy Complication', labelHi: 'गर्भावस्था की समस्या', labelMr: 'गर्भावस्थेचा त्रास', system: 'obstetric', weight: 8, redFlag: true },
  chest_tightness: { id: 'chest_tightness', label: 'Chest Tightness', labelHi: 'छाती में जकड़न', labelMr: 'छातीत घट्टपणा', system: 'respiratory', weight: 6, redFlag: false },
  confusion: { id: 'confusion', label: 'Confusion', labelHi: 'भ्रम', labelMr: 'गोंधळ', system: 'neurological', weight: 6, redFlag: false },
  mild_fever: { id: 'mild_fever', label: 'Mild Fever', labelHi: 'हल्का बुखार', labelMr: 'हल्का ताप', system: 'infectious', weight: 3, redFlag: false },
  headache: { id: 'headache', label: 'Headache', labelHi: 'सिरदर्द', labelMr: 'डोकेदुख', system: 'neurological', weight: 2, redFlag: false },
  cough: { id: 'cough', label: 'Cough', labelHi: 'खांसी', labelMr: 'खोकला', system: 'respiratory', weight: 2, redFlag: false },
  cold: { id: 'cold', label: 'Cold', labelHi: 'जुकाम', labelMr: 'शीत', system: 'respiratory', weight: 1, redFlag: false },
  body_ache: { id: 'body_ache', label: 'Body Ache', labelHi: 'शारीरिक दर्द', labelMr: 'शारीरिक दुख', system: 'general', weight: 2, redFlag: false },
  fatigue: { id: 'fatigue', label: 'Fatigue', labelHi: 'थकान', labelMr: 'थकवा', system: 'general', weight: 2, redFlag: false },
  sore_throat: { id: 'sore_throat', label: 'Sore Throat', labelHi: 'गले में खराश', labelMr: 'गळ्यात कणा', system: 'respiratory', weight: 2, redFlag: false },
  mild_diarrhea: { id: 'mild_diarrhea', label: 'Mild Diarrhea', labelHi: 'हल्का दस्त', labelMr: 'हल्का अतिसार', system: 'gi', weight: 3, redFlag: false },
  skin_rash: { id: 'skin_rash', label: 'Skin Rash', labelHi: 'त्वचा पर छलनी', labelMr: 'त्वचेला पसुती', system: 'dermatology', weight: 2, redFlag: false },
  joint_pain: { id: 'joint_pain', label: 'Joint Pain', labelHi: 'जोड़ों में दर्द', labelMr: 'सांधांचा दुख', system: 'musculoskeletal', weight: 2, redFlag: false },
  nausea: { id: 'nausea', label: 'Nausea', labelHi: 'उल्टी आना', labelMr: 'उलटी येणे', system: 'gi', weight: 2, redFlag: false },
  dizziness: { id: 'dizziness', label: 'Dizziness', labelHi: 'चक्कर आना', labelMr: 'चक्कर', system: 'neurological', weight: 3, redFlag: false },
  eye_irritation: { id: 'eye_irritation', label: 'Eye Irritation', labelHi: 'आंख में जलन', labelMr: 'डोळ्यात जळ', system: 'ophthalmology', weight: 1, redFlag: false },
  ear_pain: { id: 'ear_pain', label: 'Ear Pain', labelHi: 'कान में दर्द', labelMr: 'कान दुख', system: 'ent', weight: 2, redFlag: false },
  toothache: { id: 'toothache', label: 'Toothache', labelHi: 'दांत दर्द', labelMr: 'दांत दुख', system: 'dental', weight: 2, redFlag: false },
  back_pain: { id: 'back_pain', label: 'Back Pain', labelHi: 'पीठ दर्द', labelMr: 'माथा दुख', system: 'musculoskeletal', weight: 2, redFlag: false },
  weight_loss: { id: 'weight_loss', label: 'Weight Loss', labelHi: 'वजन कम होना', labelMr: 'वजन कमी', system: 'general', weight: 3, redFlag: false },
  loss_of_appetite: { id: 'loss_of_appetite', label: 'Loss of Appetite', labelHi: 'भुखमरी कम', labelMr: 'खाणेची इच्छा कमी', system: 'general', weight: 2, redFlag: false },
};

const SYMPTOM_ALIASES: Record<string, string> = {
  chest_pain: 'chest pain',
  unconscious: 'unconscious',
  severe_bleeding: 'severe bleeding',
  difficulty_breathing: 'difficulty breathing',
  seizures: 'seizures',
  stroke_symptoms: 'stroke symptoms',
  severe_burns: 'severe burns',
  poisoning: 'poisoning',
  snakebite: 'snakebite',
  severe_allergic_reaction: 'severe allergic reaction',
  high_fever: 'high fever',
  persistent_vomiting: 'persistent vomiting',
  severe_abdominal_pain: 'severe abdominal pain',
  dehydration: 'dehydration',
  high_blood_pressure: 'high blood pressure',
  severe_headache: 'severe headache',
  bloody_stool: 'bloody stool',
  pregnancy_complication: 'pregnancy complication',
  chest_tightness: 'chest tightness',
  confusion: 'confusion',
  mild_fever: 'mild fever',
  headache: 'headache',
  cough: 'cough',
  cold: 'cold',
  body_ache: 'body ache',
  fatigue: 'fatigue',
  sore_throat: 'sore throat',
  mild_diarrhea: 'mild diarrhea',
  skin_rash: 'skin rash',
  joint_pain: 'joint pain',
  nausea: 'nausea',
  dizziness: 'dizziness',
  eye_irritation: 'eye irritation',
  ear_pain: 'ear pain',
  toothache: 'toothache',
  back_pain: 'back pain',
  weight_loss: 'weight loss',
  loss_of_appetite: 'loss of appetite',
};

function mapSymptomToId(symptom: string): string | undefined {
  const normalized = symptom.toLowerCase().trim().replace(/\s+/g, '_');
  if (SYMPTOM_DATABASE[normalized]) return normalized;
  for (const [id, alias] of Object.entries(SYMPTOM_ALIASES)) {
    if (alias === normalized) return id;
  }
  return undefined;
}

function assessVitalSeverity(vitals: VitalSigns): { score: number; flags: string[] } {
  let score = 0;
  const flags: string[] = [];

  if (typeof vitals.temperature === 'number') {
    if (vitals.temperature >= 40) { score += 8; flags.push('Hyperthermia (≥40°C)'); }
    else if (vitals.temperature >= 38.5) { score += 5; flags.push('High fever (≥38.5°C)'); }
    else if (vitals.temperature >= 37.5) { score += 2; flags.push('Low-grade fever'); }
    else if (vitals.temperature < 35) { score += 7; flags.push('Hypothermia (<35°C)'); }
  }
  if (typeof vitals.heartRate === 'number') {
    if (vitals.heartRate > 120 || vitals.heartRate < 50) { score += 7; flags.push(`Abnormal HR: ${vitals.heartRate} bpm`); }
    else if (vitals.heartRate > 100) { score += 3; flags.push('Tachycardia'); }
  }
  if (typeof vitals.oxygenSaturation === 'number') {
    if (vitals.oxygenSaturation < 90) { score += 9; flags.push(`Critical SpO2: ${vitals.oxygenSaturation}%`); }
    else if (vitals.oxygenSaturation < 94) { score += 5; flags.push(`Low SpO2: ${vitals.oxygenSaturation}%`); }
  }
  if (typeof vitals.bloodPressureSystolic === 'number') {
    if (vitals.bloodPressureSystolic > 180 || vitals.bloodPressureSystolic < 90) { score += 8; flags.push('Critical BP'); }
    else if (vitals.bloodPressureSystolic > 140) { score += 4; flags.push('Hypertension'); }
  }
  if (typeof vitals.respiratoryRate === 'number') {
    if (vitals.respiratoryRate > 30 || vitals.respiratoryRate < 10) { score += 7; flags.push('Abnormal respiratory rate'); }
    else if (vitals.respiratoryRate > 20) { score += 3; flags.push('Elevated respiratory rate'); }
  }

  return { score, flags };
}

function getAgeRiskMultiplier(age: number): number {
  if (age < 1) return 1.5;
  if (age < 5) return 1.3;
  if (age > 70) return 1.4;
  if (age > 60) return 1.2;
  return 1.0;
}

function getSystemLabel(system: string): string {
  const labels: Record<string, string> = {
    cardiac: 'Cardiac',
    neurological: 'Neurological',
    trauma: 'Trauma',
    respiratory: 'Respiratory',
    toxicology: 'Toxicology',
    immunology: 'Immunology',
    infectious: 'Infectious',
    gi: 'Gastrointestinal',
    general: 'General',
    obstetric: 'Obstetric',
    dermatology: 'Dermatology',
    musculoskeletal: 'Musculoskeletal',
    ophthalmology: 'Ophthalmology',
    ent: 'ENT',
    dental: 'Dental',
  };
  return labels[system] || system;
}

export function assessTriage(
  symptoms: string[],
  patientAge: number,
  gender: string,
  vitalSigns?: VitalSigns
): TriageResult {
  const mappedSymptoms = symptoms.map(mapSymptomToId).filter(Boolean) as string[];
  const symptomEntries = mappedSymptoms.map(id => SYMPTOM_DATABASE[id]);

  let symptomScore = 0;
  const affectedSystems = new Set<string>();
  const hasRedFlag = symptomEntries.some(s => s.redFlag);

  for (const entry of symptomEntries) {
    symptomScore += entry.weight;
    affectedSystems.add(entry.system);
  }

  const vitalAssessment = assessVitalSeverity(vitalSigns || {});
  let totalScore = symptomScore + vitalAssessment.score;
  totalScore = Math.round(totalScore * getAgeRiskMultiplier(patientAge));

  let severity: TriageSeverity;
  if (totalScore >= 15 || hasRedFlag) {
    severity = TriageSeverity.RED;
  } else if (totalScore >= 7) {
    severity = TriageSeverity.YELLOW;
  } else {
    severity = TriageSeverity.GREEN;
  }

  const dataPoints = symptoms.length + (vitalSigns ? Object.values(vitalSigns).filter(v => typeof v === 'number').length : 0);
  const confidence = Math.min(0.95, 0.6 + dataPoints * 0.05);

  const needsReferral = severity === TriageSeverity.RED || severity === TriageSeverity.YELLOW;
  const suggestedFacilityType: FacilityType =
    severity === TriageSeverity.RED ? FacilityType.DISTRICT_HOSPITAL :
    severity === TriageSeverity.YELLOW ? FacilityType.CHC :
    FacilityType.PHC;

  const recommendation =
    severity === TriageSeverity.RED ? 'Immediate emergency care required. Transfer to nearest district hospital.' :
    severity === TriageSeverity.YELLOW ? 'Priority consultation needed. Visit nearest CHC or higher facility.' :
    'OPD consultation recommended.';

  return {
    severity,
    confidence: Math.round(confidence * 100) / 100,
    symptoms,
    recommendation,
    needsReferral,
    suggestedFacilityType,
    affectedSystems: Array.from(affectedSystems).map(getSystemLabel),
    vitalSignFlags: vitalAssessment.flags,
    aiSummary: '',
  };
}

export function generateTriageSummary(result: TriageResult, patientAge: number, gender: string): string {
  const genderLabel = gender === 'MALE' ? 'male' : gender === 'FEMALE' ? 'female' : gender.toLowerCase();
  const symptomList = result.symptoms.slice(0, 4).join(', ');
  const systems = result.affectedSystems.slice(0, 3).join(', ');

  let summary = `${patientAge}-year-old ${genderLabel} presenting with ${symptomList}. `;

  if (result.vitalSignFlags.length > 0) {
    summary += `Vital signs indicate ${result.vitalSignFlags[0].toLowerCase()}. `;
  }

  summary += `Affected systems: ${systems}. `;
  summary += `Assessment: ${result.severity} — ${result.severity === 'RED' ? 'Critical severity' : result.severity === 'YELLOW' ? 'Moderate severity' : 'Mild severity'}. `;

  if (result.needsReferral) {
    const facility = result.suggestedFacilityType.replace('_', ' ');
    summary += `Recommend priority evaluation at ${facility}. `;
  } else {
    summary += 'Routine OPD consultation recommended. ';
  }

  return summary.trim();
}
