import { FastifyPluginAsync } from 'fastify';
import { Patient, HealthRecord, ApiResponse } from '../types/index.js';

const patientsRoutes: FastifyPluginAsync = async (fastify) => {
  const mockPatients: Patient[] = [
    {
      id: 'patient-1',
      abhaId: '12-3456-7890-1234',
      name: 'राजेश पाटिल',
      age: 34,
      gender: 'MALE',
      phone: '9876543210',
      village: 'Mulshi',
      district: 'Pune',
      languagePreference: 'mr',
      createdAt: new Date('2024-01-15'),
    },
    {
      id: 'patient-2',
      abhaId: '12-3456-7890-1235',
      name: 'सुनीता शिंदे',
      age: 28,
      gender: 'FEMALE',
      phone: '9876543211',
      village: 'Velhe',
      district: 'Pune',
      languagePreference: 'mr',
      createdAt: new Date('2024-02-10'),
    },
    {
      id: 'patient-3',
      abhaId: '12-3456-7890-1236',
      name: 'आनंद जोशी',
      age: 52,
      gender: 'MALE',
      phone: '9876543212',
      village: 'Junnar',
      district: 'Pune',
      languagePreference: 'mr',
      createdAt: new Date('2024-01-20'),
    },
    {
      id: 'patient-4',
      abhaId: '12-3456-7890-1237',
      name: 'प्रिया कुलकर्णी',
      age: 25,
      gender: 'FEMALE',
      phone: '9876543213',
      village: 'Ambegaon',
      district: 'Pune',
      languagePreference: 'mr',
      createdAt: new Date('2024-03-05'),
    },
    {
      id: 'patient-5',
      abhaId: '12-3456-7890-1238',
      name: 'सचिन गवसकर',
      age: 45,
      gender: 'MALE',
      phone: '9876543214',
      village: 'Bhor',
      district: 'Pune',
      languagePreference: 'mr',
      createdAt: new Date('2024-02-28'),
    },
    {
      id: 'patient-6',
      abhaId: '12-3456-7890-1239',
      name: 'अनिता पवार',
      age: 32,
      gender: 'FEMALE',
      phone: '9876543215',
      village: 'Mulshi',
      district: 'Pune',
      languagePreference: 'mr',
      createdAt: new Date('2024-01-30'),
    },
    {
      id: 'patient-7',
      abhaId: '12-3456-7890-1240',
      name: 'विकास मोरे',
      age: 60,
      gender: 'MALE',
      phone: '9876543216',
      village: 'Velhe',
      district: 'Pune',
      languagePreference: 'mr',
      createdAt: new Date('2024-03-12'),
    },
    {
      id: 'patient-8',
      abhaId: '12-3456-7890-1241',
      name: 'कविता ढेंडे',
      age: 22,
      gender: 'FEMALE',
      phone: '9876543217',
      village: 'Junnar',
      district: 'Pune',
      languagePreference: 'mr',
      createdAt: new Date('2024-02-14'),
    },
    {
      id: 'patient-9',
      abhaId: '12-3456-7890-1242',
      name: 'रमेश साळुंखे',
      age: 48,
      gender: 'MALE',
      phone: '9876543218',
      village: 'Ambegaon',
      district: 'Pune',
      languagePreference: 'mr',
      createdAt: new Date('2024-01-08'),
    },
    {
      id: 'patient-10',
      abhaId: '12-3456-7890-1243',
      name: 'स्मिता तिळक',
      age: 36,
      gender: 'FEMALE',
      phone: '9876543219',
      village: 'Bhor',
      district: 'Pune',
      languagePreference: 'mr',
      createdAt: new Date('2024-03-20'),
    },
  ];

  const mockRecords: Record<string, HealthRecord[]> = {
    'patient-1': [
      {
        id: 'record-1',
        patientId: 'patient-1',
        facilityId: 'facility-1',
        visitDate: new Date('2024-03-01'),
        doctorName: 'Dr. शर्मा',
        diagnosis: 'Malaria - P. vivax',
        prescription: 'Chloroquine 500mg twice daily for 3 days',
        documents: [],
        notes: 'Patient responded well to treatment',
      },
      {
        id: 'record-2',
        patientId: 'patient-1',
        facilityId: 'facility-1',
        visitDate: new Date('2024-02-15'),
        doctorName: 'Dr. पाटिल',
        diagnosis: 'Anemia - Moderate',
        prescription: 'Iron folic acid tablets for 30 days',
        documents: [],
        notes: 'Hemoglobin 9.2 g/dL',
      },
      {
        id: 'record-3',
        patientId: 'patient-1',
        facilityId: 'facility-1',
        visitDate: new Date('2024-01-20'),
        doctorName: 'Dr. कुलकर्णी',
        diagnosis: 'Diabetes screening - Normal',
        prescription: 'None',
        documents: [],
        notes: 'Fasting sugar 102 mg/dL',
      },
    ],
    'patient-2': [
      {
        id: 'record-4',
        patientId: 'patient-2',
        facilityId: 'facility-2',
        visitDate: new Date('2024-03-10'),
        doctorName: 'Dr. शिंदे',
        diagnosis: 'Pregnancy checkup - 2nd trimester',
        prescription: 'Prenatal vitamins, calcium supplements',
        documents: [],
        notes: 'All vitals normal',
      },
      {
        id: 'record-5',
        patientId: 'patient-2',
        facilityId: 'facility-2',
        visitDate: new Date('2024-02-28'),
        doctorName: 'Dr. शिंदे',
        diagnosis: 'Anemia screening',
        prescription: 'Iron supplements',
        documents: [],
        notes: 'Hemoglobin 10.5 g/dL',
      },
      {
        id: 'record-6',
        patientId: 'patient-2',
        facilityId: 'facility-2',
        visitDate: new Date('2024-02-10'),
        doctorName: 'Dr. शिंदे',
        diagnosis: 'General health checkup',
        prescription: 'None',
        documents: [],
        notes: 'Routine ANC',
      },
    ],
  };

  fastify.get<{ Reply: ApiResponse<Patient[]> }>('/api/patients', async () => {
    return {
      success: true,
      data: mockPatients,
    };
  });

  fastify.post<{ Body: Omit<Patient, 'id' | 'createdAt'>; Reply: ApiResponse<Patient> }>(
    '/api/patients',
    async (request, reply) => {
      const body = request.body as Omit<Patient, 'id' | 'createdAt'>;
      const newPatient: Patient = {
        ...body,
        id: `patient-${Date.now()}`,
        createdAt: new Date(),
      };

      mockPatients.push(newPatient);

      return {
        success: true,
        data: newPatient,
      };
    }
  );

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse<Patient>;
  }>('/api/patients/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const patient = mockPatients.find((p) => p.id === id);

    if (!patient) {
      return reply.status(404).send({
        success: false,
        error: 'Patient not found',
      });
    }

    return {
      success: true,
      data: patient,
    };
  });

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse<HealthRecord[]>;
  }>('/api/patients/:id/records', async (request, reply) => {
    const { id } = request.params as { id: string };
    const records = mockRecords[id] || [];

    return {
      success: true,
      data: records,
    };
  });
};

export default patientsRoutes;
