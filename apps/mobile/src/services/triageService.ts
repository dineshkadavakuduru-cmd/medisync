import { SymptomLabel } from './voiceService';

// Replicate the symptom database for mobile use
const SYMPTOM_DATABASE: Record<string, SymptomLabel> = {
  chest_pain: { id: 'chest_pain', label: 'Chest Pain', labelHi: 'छाती में दर्द', labelMr: 'छातीत दुखणे' },
  unconscious: { id: 'unconscious', label: 'Unconscious', labelHi: 'बेहोश', labelMr: 'बेशुद्ध' },
  severe_bleeding: { id: 'severe_bleeding', label: 'Severe Bleeding', labelHi: 'अत्यधिक रक्तस्राव', labelMr: 'गंभीर रक्तस्त्राव' },
  difficulty_breathing: { id: 'difficulty_breathing', label: 'Difficulty Breathing', labelHi: 'सांस लेने में कठिनाई', labelMr: 'श्वास घेण्यास त्रास' },
  seizures: { id: 'seizures', label: 'Seizures', labelHi: 'दौरे', labelMr: 'फाटा' },
  stroke_symptoms: { id: 'stroke_symptoms', label: 'Stroke Symptoms', labelHi: 'स्ट्रोक के लक्षण', labelMr: 'स्ट्रोकची लक्षणे' },
  severe_burns: { id: 'severe_burns', label: 'Severe Burns', labelHi: 'गंभीर जलना', labelMr: 'गंभीर जळ' },
  poisoning: { id: 'poisoning', label: 'Poisoning', labelHi: 'जहरा', labelMr: 'विष' },
  snakebite: { id: 'snakebite', label: 'Snakebite', labelHi: 'सांप का काट', labelMr: 'सापाचा सोंड' },
  severe_allergic_reaction: { id: 'severe_allergic_reaction', label: 'Severe Allergic Reaction', labelHi: 'गंभीर एलर्जिक रिएक्शन', labelMr: 'गंभीर एलर्जिक प्रतिक्रिया' },
  high_fever: { id: 'high_fever', label: 'High Fever', labelHi: 'तेज बुखार', labelMr: 'उच्च ताप' },
  persistent_vomiting: { id: 'persistent_vomiting', label: 'Persistent Vomiting', labelHi: 'लगातार उल्टी', labelMr: 'सतत उलटी' },
  severe_abdominal_pain: { id: 'severe_abdominal_pain', label: 'Severe Abdominal Pain', labelHi: 'गंभीर पेट दर्द', labelMr: 'गंभीर उदर दुख' },
  dehydration: { id: 'dehydration', label: 'Dehydration', labelHi: 'निर्जलीकरण', labelMr: 'निर्जलीकरण' },
  high_blood_pressure: { id: 'high_blood_pressure', label: 'High Blood Pressure', labelHi: 'उच्च रक्तचाप', labelMr: 'उच्च रक्तदाब' },
  severe_headache: { id: 'severe_headache', label: 'Severe Headache', labelHi: 'गंभीर सिरदर्द', labelMr: 'गंभीर डोकेदुख' },
  bloody_stool: { id: 'bloody_stool', label: 'Bloody Stool', labelHi: 'रक्त युक्त मल', labelMr: 'रक्त पाळी' },
  pregnancy_complication: { id: 'pregnancy_complication', label: 'Pregnancy Complication', labelHi: 'गर्भावस्था की समस्या', labelMr: 'गर्भावस्थेचा त्रास' },
  chest_tightness: { id: 'chest_tightness', label: 'Chest Tightness', labelHi: 'छाती में जकड़न', labelMr: 'छातीत घट्टपणा' },
  confusion: { id: 'confusion', label: 'Confusion', labelHi: 'भ्रम', labelMr: 'गोंधळ' },
  mild_fever: { id: 'mild_fever', label: 'Mild Fever', labelHi: 'हल्का बुखार', labelMr: 'हल्का ताप' },
  headache: { id: 'headache', label: 'Headache', labelHi: 'सिरदर्द', labelMr: 'डोकेदुख' },
  cough: { id: 'cough', label: 'Cough', labelHi: 'खांसी', labelMr: 'खोकला' },
  cold: { id: 'cold', label: 'Cold', labelHi: 'जुकाम', labelMr: 'शीत' },
  body_ache: { id: 'body_ache', label: 'Body Ache', labelHi: 'शारीरिक दर्द', labelMr: 'शारीरिक दुख' },
  fatigue: { id: 'fatigue', label: 'Fatigue', labelHi: 'थकान', labelMr: 'थकवा' },
  sore_throat: { id: 'sore_throat', label: 'Sore Throat', labelHi: 'गले में खराश', labelMr: 'गळ्यात कणा' },
  mild_diarrhea: { id: 'mild_diarrhea', label: 'Mild Diarrhea', labelHi: 'हल्का दस्त', labelMr: 'हल्का अतिसार' },
  skin_rash: { id: 'skin_rash', label: 'Skin Rash', labelHi: 'त्वचा पर छलनी', labelMr: 'त्वचेला पसुती' },
  joint_pain: { id: 'joint_pain', label: 'Joint Pain', labelHi: 'जोड़ों में दर्द', labelMr: 'सांधांचा दुख' },
  nausea: { id: 'nausea', label: 'Nausea', labelHi: 'उल्टी आना', labelMr: 'उलटी येणे' },
  dizziness: { id: 'dizziness', label: 'Dizziness', labelHi: 'चक्कर आना', labelMr: 'चक्कर' },
  eye_irritation: { id: 'eye_irritation', label: 'Eye Irritation', labelHi: 'आंख में जलन', labelMr: 'डोळ्यात जळ' },
  ear_pain: { id: 'ear_pain', label: 'Ear Pain', labelHi: 'कान में दर्द', labelMr: 'कान दुख' },
  toothache: { id: 'toothache', label: 'Toothache', labelHi: 'दांत दर्द', labelMr: 'दांत दुख' },
  back_pain: { id: 'back_pain', label: 'Back Pain', labelHi: 'पीठ दर्द', labelMr: 'माथा दुख' },
  weight_loss: { id: 'weight_loss', label: 'Weight Loss', labelHi: 'वजन कम होना', labelMr: 'वजन कमी' },
  loss_of_appetite: { id: 'loss_of_appetite', label: 'Loss of Appetite', labelHi: 'भुखमरी कम', labelMr: 'खाणेची इच्छा कमी' },
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

const CONDITION_DIAGNOSTICS: Record<string, string[]> = {
  chest_pain: ['cardiac_marker_panel', 'ecg', 'troponin'],
  difficulty_breathing: ['chest_xray', 'oxygen_saturation', 'cbg'],
  high_fever: ['malaria_rdt', 'dengue_ns1', 'blood_sugar', 'cbc'],
  severe_burns: ['wound_culture', 'cbc'],
  severe_headache: ['cbg', 'blood_pressure'],
  unconscious: ['cbg', 'ecg', 'cbc', 'chest_xray'],
  seizures: ['ecg', 'cbg', 'mri_brain'],
  severe_abdominal_pain: ['cbc', 'lft', 'kft', 'usg_abdomen'],
  snakebite: ['cbc', 'pt_inr', 'usg_abdomen'],
  poisoning: ['cbc', 'lft', 'kft', 'cbg'],
  pregnancy_complication: ['blood_group', 'cbc', 'urinalysis', 'bp'],
  high_blood_pressure: ['bp_monitor', 'ecg', 'kft', 'urinalysis'],
  dehydration: ['cbc', 'cbg', 'kft'],
  persistent_vomiting: ['cbc', 'lft', 'cbg', 'urinalysis'],
  mild_diarrhea: ['stool_reaction', 'cbc', 'urinalysis'],
  skin_rash: ['cbc', 'lft', 'urinalysis'],
  joint_pain: ['cbc', 'esr', 'uric_acid'],
  dizziness: ['bp_monitor', 'cbc', 'cbg'],
  ear_pain: ['ear_swab', 'temperature'],
  toothache: ['dental_xray', 'cbc'],
  back_pain: ['cbc', 'usg_abdomen', 'mri_spine'],
  weight_loss: ['cbc', 'lft', 'kft', 'usg_abdomen'],
  loss_of_appetite: ['cbc', 'lft', 'cbc_lft_kft'],
  severe_bleeding: ['cbc', 'pt_inr', 'blood_group'],
  severe_allergic_reaction: ['cbc', 'ecg', 'tryptase'],
};

export function getRecommendedDiagnostics(symptoms: string[]): string[] {
  const recommended = new Set<string>();
  for (const symptom of symptoms) {
    const mappedId = mapSymptomToId(symptom);
    if (mappedId && CONDITION_DIAGNOSTICS[mappedId]) {
      CONDITION_DIAGNOSTICS[mappedId].forEach((d) => recommended.add(d));
    }
  }
  return Array.from(recommended);
}

export function getAllSymptoms(): SymptomLabel[] {
  return Object.values(SYMPTOM_DATABASE);
}