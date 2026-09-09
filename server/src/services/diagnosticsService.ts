import { DiagnosticOrder, DiagnosticStatus, TestResult, TestFlag, DiagnosticPriority } from '../types/index.js';
import { mockFacilities } from '../database/facilities.js';
import { z } from 'zod';
import { fileURLToPath, URL } from 'node:url';
import { FileStore } from '../database/fileStore.js';
import { ApiError, idSchema, text } from '../validation.js';

export const diagnosticStore = new FileStore<DiagnosticOrder>(process.env.DIAGNOSTICS_STORE_PATH || fileURLToPath(new URL('../../data/diagnostics.json', import.meta.url)));

const PATIENT_NAMES: Record<string, string> = {
  'patient-1': 'राजेश पाटिल',
  'patient-2': 'सुनीता शिंदे',
  'patient-3': 'आनंद जोशी',
  'patient-4': 'प्रिया कुलकर्णी',
  'patient-5': 'सचिन गवसकर',
  'patient-6': 'अनिता पवार',
  'patient-7': 'विकास मोरे',
  'patient-8': 'कविता ढेंडे',
  'patient-9': 'रमेश साळुंखे',
  'patient-10': 'स्मिता तिळक',
};

export const TESTS_CATALOG: { code: string; name: string; unit: string; normalRange: string; referenceLow: number; referenceHigh: number }[] = [
  { code: 'malaria_rdt', name: 'Malaria RDT', unit: '', normalRange: 'Negative', referenceLow: 0, referenceHigh: 0 },
  { code: 'dengue_ns1', name: 'Dengue NS1 Antigen', unit: '', normalRange: 'Negative', referenceLow: 0, referenceHigh: 0 },
  { code: 'xcbx', name: 'X-ray Chest PA View', unit: '', normalRange: 'Normal', referenceLow: 0, referenceHigh: 0 },
  { code: 'blood_sugar', name: 'Blood Sugar (Fasting)', unit: 'mg/dL', normalRange: '70-100', referenceLow: 70, referenceHigh: 100 },
  { code: 'urinalysis', name: 'Urinalysis', unit: '', normalRange: 'Negative', referenceLow: 0, referenceHigh: 0 },
  { code: 'cbc', name: 'Complete Blood Count', unit: '', normalRange: 'Within normal limits', referenceLow: 0, referenceHigh: 0 },
  { code: 'lft', name: 'Liver Function Test', unit: '', normalRange: 'Within normal limits', referenceLow: 0, referenceHigh: 0 },
  { code: 'kft', name: 'Kidney Function Test', unit: '', normalRange: 'Within normal limits', referenceLow: 0, referenceHigh: 0 },
  { code: 'ecg', name: 'ECG', unit: '', normalRange: 'Normal', referenceLow: 0, referenceHigh: 0 },
  { code: 'troponin', name: 'Troponin I', unit: 'ng/mL', normalRange: '<0.04', referenceLow: 0, referenceHigh: 0.04 },
  { code: 'usg_abdomen', name: 'USG Abdomen', unit: '', normalRange: 'Normal', referenceLow: 0, referenceHigh: 0 },
  { code: 'bp_monitor', name: 'Blood Pressure', unit: 'mmHg', normalRange: '<140/90', referenceLow: 0, referenceHigh: 140 },
  { code: 'cbg', name: 'Capillary Blood Glucose', unit: 'mg/dL', normalRange: '70-140', referenceLow: 70, referenceHigh: 140 },
  { code: 'oxygen_saturation', name: 'Oxygen Saturation (SpO2)', unit: '%', normalRange: '>94', referenceLow: 94, referenceHigh: 100 },
  { code: 'wound_culture', name: 'Wound Culture & Sensitivity', unit: '', normalRange: 'No growth', referenceLow: 0, referenceHigh: 0 },
  { code: 'pt_inr', name: 'PT/INR', unit: '', normalRange: '<1.3', referenceLow: 0, referenceHigh: 1.3 },
  { code: 'blood_group', name: 'Blood Group', unit: '', normalRange: 'ABO/Rh', referenceLow: 0, referenceHigh: 0 },
  { code: 'stool_reaction', name: 'Stool Analysis', unit: '', normalRange: 'Normal', referenceLow: 0, referenceHigh: 0 },
  { code: 'esr', name: 'ESR', unit: 'mm/hr', normalRange: '<20', referenceLow: 0, referenceHigh: 20 },
  { code: 'uric_acid', name: 'Uric Acid', unit: 'mg/dL', normalRange: '3.4-7.0', referenceLow: 3.4, referenceHigh: 7.0 },
  { code: 'mri_brain', name: 'MRI Brain', unit: '', normalRange: 'Normal', referenceLow: 0, referenceHigh: 0 },
  { code: 'mri_spine', name: 'MRI Spine', unit: '', normalRange: 'Normal', referenceLow: 0, referenceHigh: 0 },
  { code: 'dental_xray', name: 'Dental X-ray', unit: '', normalRange: 'Normal', referenceLow: 0, referenceHigh: 0 },
  { code: 'ear_swab', name: 'Ear Swab Culture', unit: '', normalRange: 'No growth', referenceLow: 0, referenceHigh: 0 },
  { code: 'tryptase', name: 'Tryptase', unit: 'ng/mL', normalRange: '<11.4', referenceLow: 0, referenceHigh: 11.4 },
  { code: 'cbc_lft_kft', name: 'Comprehensive Panel (CBC+LFT+KFT)', unit: '', normalRange: 'Within normal limits', referenceLow: 0, referenceHigh: 0 },
  { code: 'cardiac_marker_panel', name: 'Cardiac Marker Panel', unit: '', normalRange: 'See laboratory reference ranges', referenceLow: 0, referenceHigh: 0 },
  { code: 'temperature', name: 'Body Temperature', unit: 'C', normalRange: 'See clinical reference range', referenceLow: 0, referenceHigh: 0 },
];

export const diagnosticStatusSchema = z.enum(['ORDERED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
const testCodeSchema = text(50).refine(code => TESTS_CATALOG.some(test => test.code === code), 'Unknown catalogue test code');
export const orderSchema = z.object({
  patientId: idSchema,
  facilityId: idSchema.refine(id => mockFacilities.some(f => f.id === id), 'Unknown facility'),
  triageId: idSchema.optional(), referralId: idSchema.optional(),
  tests: z.array(testCodeSchema).min(1).max(TESTS_CATALOG.length).refine(codes => new Set(codes).size === codes.length, 'Duplicate test codes'),
  priority: z.enum(['ROUTINE', 'URGENT', 'STAT']).default('ROUTINE'),
  orderedBy: text(100), notes: text(2000).optional(),
}).strict();
export const resultSchema = z.object({
  testCode: testCodeSchema, value: text(2000).refine(value => !/^(not yet added|pending|n\/?a)$/i.test(value), 'An actual result is required'),
  unit: z.string().trim().max(50), flag: z.enum(['NORMAL', 'ABNORMAL', 'CRITICAL']), referenceRange: text(200).optional(),
}).strict();
const transitions: Record<DiagnosticStatus, DiagnosticStatus[]> = {
  ORDERED: ['SAMPLE_COLLECTED', 'CANCELLED'],
  SAMPLE_COLLECTED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'], COMPLETED: [], CANCELLED: [],
};

function generateId(): string {
  return `dx-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function getFacilityName(facilityId: string): string {
  const facility = mockFacilities.find((f) => f.id === facilityId);
  return facility?.name || facilityId;
}

function getPatientName(patientId: string): string {
  return PATIENT_NAMES[patientId] || patientId;
}

export function getTestsCatalog() {
  return TESTS_CATALOG;
}

export function createOrder(data: {
  patientId: string;
  facilityId: string;
  triageId?: string;
  referralId?: string;
  tests: string[];
  priority?: DiagnosticPriority;
  orderedBy: string;
  notes?: string;
}, persist = true): DiagnosticOrder {
  data = orderSchema.parse(data);
  const order: DiagnosticOrder = {
    id: generateId(),
    patientId: data.patientId,
    patientName: getPatientName(data.patientId),
    facilityId: data.facilityId,
    facilityName: getFacilityName(data.facilityId),
    triageId: data.triageId,
    referralId: data.referralId,
    tests: data.tests,
    priority: data.priority || 'ROUTINE',
    status: 'ORDERED',
    orderedBy: data.orderedBy,
    results: [],
    notes: data.notes,
    createdAt: new Date().toISOString(),
  };

  if (persist) diagnosticStore.save(order);
  return order;
}

export function getOrder(id: string): DiagnosticOrder | undefined {
  return diagnosticStore.get(id);
}

export function getAllOrders(): DiagnosticOrder[] {
  return diagnosticStore.all().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getOrdersByFacility(facilityId: string, status?: string): DiagnosticOrder[] {
  return getAllOrders().filter((o) => {
    if (o.facilityId !== facilityId) return false;
    if (status) return o.status === status;
    return true;
  });
}

export function getOrdersByPatient(patientId: string): DiagnosticOrder[] {
  return getAllOrders().filter((o) => o.patientId === patientId);
}

export function addTestResult(
  orderId: string,
  testCode: string,
  value: string,
  unit: string,
  flag: TestFlag,
  referenceRange?: string,
  persist = true
): DiagnosticOrder | null {
  const input = resultSchema.parse({ testCode, value, unit, flag, referenceRange });
  const order = getOrder(orderId);
  if (!order) return null;
  if (!['SAMPLE_COLLECTED', 'IN_PROGRESS'].includes(order.status)) throw new ApiError(409, 'Results require SAMPLE_COLLECTED or IN_PROGRESS');
  if (!order.tests.includes(input.testCode)) throw new ApiError(400, 'Test was not ordered');
  if (order.results.some(result => result.testCode === input.testCode)) throw new ApiError(409, 'A result for this test already exists');

  const catalogEntry = TESTS_CATALOG.find((t) => t.code === input.testCode)!;
  const result: TestResult = {
    id: `tr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    testName: catalogEntry.name,
    testCode: input.testCode,
    value: input.value,
    unit: input.unit,
    flag: input.flag,
    referenceRange: input.referenceRange || catalogEntry?.normalRange,
  };

  order.results.push(result);
  if (order.tests.every(code => order.results.some(result => result.testCode === code))) {
    order.status = 'COMPLETED';
    order.completedAt = new Date().toISOString();
  } else {
    order.status = 'IN_PROGRESS';
  }

  if (persist) diagnosticStore.save(order);
  return order;
}

export function updateOrderStatus(id: string, status: DiagnosticStatus, persist = true): DiagnosticOrder | null {
  diagnosticStatusSchema.parse(status);
  const order = getOrder(id);
  if (!order) return null;
  if (order.status === status) return order;
  if (!transitions[order.status].includes(status)) throw new ApiError(409, `Cannot transition from ${order.status} to ${status}`);
  if (status === 'COMPLETED' && (order.results.length !== order.tests.length ||
      new Set(order.results.map(result => result.testCode)).size !== order.tests.length ||
      !order.tests.every(code => order.results.some(result => result.testCode === code && resultSchema.safeParse({ testCode: result.testCode, value: result.value, unit: result.unit, flag: result.flag, referenceRange: result.referenceRange }).success)))) {
    throw new ApiError(409, 'Completion requires one actual result for every ordered test');
  }
  order.status = status;
  if (status === 'COMPLETED') order.completedAt = new Date().toISOString();
  if (persist) diagnosticStore.save(order);
  return order;
}

export function seedDemoOrders() {
  if (diagnosticStore.all().length > 0) return;

  createOrder({
    patientId: 'patient-1',
    facilityId: 'facility-2',
    triageId: 'triage-demo-1',
    tests: ['malaria_rdt', 'dengue_ns1', 'cbc'],
    priority: 'URGENT',
    orderedBy: 'ASHA-Worker-1',
    notes: 'Suspected malaria/dengue - high fever with body ache',
  });

  createOrder({
    patientId: 'patient-4',
    facilityId: 'facility-3',
    tests: ['blood_sugar', 'urinalysis'],
    priority: 'ROUTINE',
    orderedBy: 'ASHA-Worker-2',
  });
}
