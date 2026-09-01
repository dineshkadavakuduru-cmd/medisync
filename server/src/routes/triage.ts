import { FastifyPluginAsync } from 'fastify';
import { TriageResult, VitalSigns, SymptomEntry, ApiResponse } from '../types/index.js';
import { assessTriage, SYMPTOM_DATABASE } from '../services/triageService.js';
import { getAIClinicalSummary } from '../services/aiService.js';
import { autoOrderDiagnostics } from '../services/diagnosticsService.js';

const triageRoutes: FastifyPluginAsync = async (fastify) => {
  const triageResults = new Map<string, TriageResult>();

  fastify.post<{
    Body: {
      symptoms: string[];
      patientAge: number;
      patientGender: string;
      vitalSigns?: VitalSigns;
      patientId?: string;
    };
    Reply: ApiResponse<TriageResult>;
  }>('/api/triage', async (request) => {
    const { symptoms, patientAge, patientGender, vitalSigns, patientId } = request.body as {
      symptoms: string[];
      patientAge: number;
      patientGender: string;
      vitalSigns?: VitalSigns;
      patientId?: string;
    };

    const result = assessTriage(symptoms, patientAge, patientGender, vitalSigns);
    const aiSummary = await getAIClinicalSummary(symptoms, vitalSigns, patientAge, patientGender, result);

    const triageResult: TriageResult = { ...result, aiSummary };
    const id = `triage-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    triageResult.id = id;
    triageResults.set(id, triageResult);

    if (patientId && triageResult.recommendedDiagnostics.length > 0) {
      autoOrderDiagnostics(id, patientId, 'facility-2', symptoms, 'ASHA-Worker-1');
    }

    return { success: true, data: triageResult };
  });

  fastify.get<{ Reply: ApiResponse<TriageResult[]> }>('/api/triage', async () => {
    const results = Array.from(triageResults.values()).reverse();
    return { success: true, data: results };
  });

  fastify.get<{
    Reply: ApiResponse<TriageResult>;
  }>('/api/triage/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = triageResults.get(id);

    if (!result) {
      return reply.status(404).send({ success: false, error: 'Triage result not found' });
    }

    return { success: true, data: result };
  });

  fastify.get<{ Reply: ApiResponse<{ categories: { name: string; icon: string; symptoms: SymptomEntry[] }[] }> }>(
    '/api/triage/symptoms',
    async () => {
      const categoryMap: Record<string, { name: string; icon: string; systems: string[] }> = {
        Emergency: { name: 'Emergency', icon: '🚨', systems: ['cardiac', 'neurological', 'trauma', 'toxicology', 'immunology', 'obstetric'] },
        General: { name: 'General', icon: '🤒', systems: ['general'] },
        Respiratory: { name: 'Respiratory', icon: '🫁', systems: ['respiratory'] },
        Gastrointestinal: { name: 'Gastrointestinal', icon: '🤢', systems: ['gi'] },
        Neurological: { name: 'Neurological', icon: '🧠', systems: ['neurological'] },
        Musculoskeletal: { name: 'Musculoskeletal', icon: '💪', systems: ['musculoskeletal'] },
        Obstetric: { name: 'Obstetric', icon: '🤰', systems: ['obstetric'] },
        Other: { name: 'Other', icon: '📋', systems: ['dermatology', 'ophthalmology', 'ent', 'dental', 'infectious'] },
      };

      const categories = Object.values(categoryMap).map(cat => ({
        name: cat.name,
        icon: cat.icon,
        symptoms: Object.values(SYMPTOM_DATABASE).filter(s => cat.systems.includes(s.system)),
      }));

      return { success: true, data: { categories } };
    }
  );
};

export default triageRoutes;
