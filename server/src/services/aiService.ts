import { TriageResult, VitalSigns } from '../types/index.js';
import { generateTriageSummary } from './triageService.js';

export async function getAIClinicalSummary(
  symptoms: string[],
  vitalSigns: VitalSigns | undefined,
  patientAge: number,
  patientGender: string,
  triageResult: TriageResult
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return generateTriageSummary(triageResult, patientAge, patientGender);
  }

  try {
    const prompt = `You are a clinical decision support system for rural Indian healthcare workers (ASHA/ANM). Based on the following patient data, provide a brief clinical assessment:

Patient: ${patientAge}-year-old ${patientGender}
Symptoms: ${symptoms.join(', ')}
${vitalSigns ? `Vital Signs: Temp: ${vitalSigns.temperature ?? 'N/A'}°C, HR: ${vitalSigns.heartRate ?? 'N/A'} bpm, BP: ${vitalSigns.bloodPressureSystolic ?? 'N/A'}/${vitalSigns.bloodPressureDiastolic ?? 'N/A'}, SpO2: ${vitalSigns.oxygenSaturation ?? 'N/A'}%` : 'No vital signs recorded'}
Automated Triage: ${triageResult.severity} severity (confidence: ${(triageResult.confidence * 100).toFixed(0)}%)

Provide in 3-4 lines:
1. Clinical impression
2. Possible differentials (top 2-3)
3. Immediate actions recommended
4. Referral recommendation

Keep language simple enough for a rural health worker to understand. Be concise.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 300 },
      }),
    });

    if (!response.ok) {
      return generateTriageSummary(triageResult, patientAge, patientGender);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || generateTriageSummary(triageResult, patientAge, patientGender);
  } catch {
    return generateTriageSummary(triageResult, patientAge, patientGender);
  }
}
