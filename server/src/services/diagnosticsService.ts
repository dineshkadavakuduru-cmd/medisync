import { DiagnosticOrder, DiagnosticStatus, TestResult, TestFlag, DiagnosticPriority, TriageSeverity } from '../types/index.js';
import { mockFacilities } from '../database/facilities.js';
import { getRecommendedDiagnostics } from './triageService.js';

const orders: Map<string, DiagnosticOrder> = new Map();

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
];

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
}): DiagnosticOrder {
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

  orders.set(order.id, order);
  return order;
}

export function getOrder(id: string): DiagnosticOrder | undefined {
  return orders.get(id);
}

export function getAllOrders(): DiagnosticOrder[] {
  return Array.from(orders.values()).sort(
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
  referenceRange?: string
): DiagnosticOrder | null {
  const order = orders.get(orderId);
  if (!order) return null;

  const catalogEntry = TESTS_CATALOG.find((t) => t.code === testCode);
  const result: TestResult = {
    id: `tr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    testName: catalogEntry?.name || testCode,
    testCode,
    value,
    unit,
    flag,
    referenceRange: referenceRange || catalogEntry?.normalRange,
  };

  order.results.push(result);
  if (order.results.length >= order.tests.length) {
    order.status = 'COMPLETED';
  } else {
    order.status = 'IN_PROGRESS';
  }

  return order;
}

export function updateOrderStatus(id: string, status: DiagnosticStatus): DiagnosticOrder | null {
  const order = orders.get(id);
  if (!order) return null;
  order.status = status;
  if (status === 'COMPLETED') {
    order.results = order.results.length === 0
      ? order.tests.map((t) => {
          const catalogEntry = TESTS_CATALOG.find((c) => c.code === t);
          return {
            id: `tr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            testName: catalogEntry?.name || t,
            testCode: t,
            value: 'Not yet added',
            unit: catalogEntry?.unit || '',
            flag: 'NORMAL' as TestFlag,
            referenceRange: catalogEntry?.normalRange,
          };
        })
      : order.results;
  }
  return order;
}

export function autoOrderDiagnostics(triageId: string, patientId: string, facilityId: string, symptoms: string[], orderedBy: string): DiagnosticOrder[] {
  const recommended = getRecommendedDiagnostics(symptoms);
  if (recommended.length === 0) return [];

  const order = createOrder({
    patientId,
    facilityId,
    triageId,
    tests: recommended,
    priority: 'URGENT',
    orderedBy,
    notes: `Auto-generated from triage ${triageId}`,
  });

  return [order];
}

export function seedDemoOrders() {
  if (orders.size > 0) return;

  const order1 = createOrder({
    patientId: 'patient-1',
    facilityId: 'facility-2',
    triageId: 'triage-demo-1',
    tests: ['malaria_rdt', 'dengue_ns1', 'cbc'],
    priority: 'URGENT',
    orderedBy: 'ASHA-Worker-1',
    notes: 'Suspected malaria/dengue - high fever with body ache',
  });
  addTestResult(order1.id, 'malaria_rdt', 'Negative', '', 'NORMAL');
  addTestResult(order1.id, 'dengue_ns1', 'Positive', '', 'ABNORMAL');
  addTestResult(order1.id, 'cbc', 'WBC: 12,000 | Hgb: 11.2 | Platelets: 1.1L', '', 'ABNORMAL', '<150,000');
  order1.status = 'COMPLETED';

  const order2 = createOrder({
    patientId: 'patient-4',
    facilityId: 'facility-3',
    tests: ['blood_sugar', 'urinalysis'],
    priority: 'ROUTINE',
    orderedBy: 'ASHA-Worker-2',
  });
  addTestResult(order2.id, 'blood_sugar', '118', 'mg/dL', 'NORMAL', '70-100');
  addTestResult(order2.id, 'urinalysis', 'Negative for glucose/protein', '', 'NORMAL');
  order2.status = 'COMPLETED';
}
