import { getDemoHeader, isDemoActive } from './demoMode';
import { FacilityType, TriageSeverity, ReferralStatus, DiagnosticPriority, TestFlag, DiagnosticStatus } from '@medisync/shared';
import type { Patient, HealthRecord, Facility, FacilitySummary, MedicineItem, StaffMember, FacilitiesAnalytics, Referral, Alert, TriageResult, DiagnosticOrder, Emergency, EmergencyEvent, EmergencyStatus, EmergencyStats, Ambulance } from '@medisync/shared';

export function getApiOrigin(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!configured) throw new Error('EXPO_PUBLIC_API_URL is not configured. A server connection is required.');
  const url = new URL(configured);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !['/', '/api', '/api/'].includes(url.pathname)) {
    throw new Error('EXPO_PUBLIC_API_URL must be an HTTP(S) origin (optionally ending in /api).');
  }
  return url.origin;
}

const getHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...getDemoHeader(),
});

export type ApiResponse<T> = (
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: string }
) & { source?: 'sample'; limitation?: string };

export interface VitalSigns {
  temperature?: number;
  heartRate?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  oxygenSaturation?: number;
  respiratoryRate?: number;
}

export interface TriagePayload {
  patientId: string;
  symptoms: string[];
  patientAge: number;
  patientGender: Patient['gender'];
  vitalSigns?: VitalSigns;
}

export interface ClinicalTriageResult extends TriageResult {
  id: string;
  affectedSystems: string[];
  vitalSignFlags: string[];
  aiSummary: string;
  recommendedDiagnostics: string[];
}

export interface SymptomCategory {
  name: string;
  icon: string;
  symptoms: { id: string; label: string; labelHi: string; labelMr: string; system: string; weight: number; redFlag: boolean }[];
}

export interface ReferralPayload extends TriagePayload {
  fromFacilityId: string;
  reason?: string;
}

export interface DiagnosticOrderPayload {
  patientId: string;
  facilityId: string;
  triageId?: string;
  referralId?: string;
  tests: string[];
  priority?: DiagnosticPriority;
  orderedBy: string;
  notes?: string;
}

// The existing demo caller supplies a level; the server still determines the actual protocol.
export type EmergencyPayload = Pick<Emergency, 'patientId' | 'patientName' | 'patientAge' | 'patientGender' | 'condition' | 'description' | 'originFacilityId' | 'initiatedBy'> & Partial<Pick<Emergency, 'protocolLevel'>>;

export interface PatientFeedback {
  id: string;
  patientId?: string;
  facilityId: string;
  visitDate: string;
  rating: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  comment?: string;
  language: 'en' | 'hi' | 'mr';
}

export interface FeedbackSummary {
  avgRating: number;
  totalFeedback: number;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  topPositiveTags: { tag: string; count: number }[];
  topNegativeTags: { tag: string; count: number }[];
  byFacility: { facilityId: string; facilityName: string; avgRating: number; feedbackCount: number }[];
}

async function safeFetch<T>(path: string, options?: RequestInit, fallbackData?: T): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);
  try {
    if (isDemoActive()) throw new Error('Demo mode: server operations are paused. Switch to server mode to connect.');
    const res = await fetch(`${getApiOrigin()}/api${path}`, {
      ...options,
      headers: { ...getHeaders(), ...(options?.headers || {}) },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body: unknown = await res.json();
    if (typeof body === 'object' && body !== null && 'success' in body && body.success === false) {
      throw new Error('error' in body && typeof body.error === 'string' ? body.error : 'API request failed');
    }
    if (typeof body !== 'object' || body === null || !('success' in body) || body.success !== true || !('data' in body) || body.data == null) {
      throw new Error('The server did not return a confirmed API response.');
    }
    // Endpoint-specific contracts below describe the server's JSON envelopes.
    return body as T;
  } catch (err) {
    if ((!options?.method || options.method === 'GET') && fallbackData !== undefined) {
      return fallbackData;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

const MOCK_FACILITIES = [
  { id: 'f1', name: 'Mulshi PHC', type: FacilityType.PHC, district: 'Pune', taluka: 'Mulshi', beds: { total: 20, available: 12, occupied: 8 }, medicineAvailability: 85, specialists: ['General Physician', 'Pediatrician'], contactPhone: '020-24440101', isActive: true },
  { id: 'f2', name: 'Junnar Sub-Centre', type: FacilityType.SUB_CENTRE, district: 'Pune', taluka: 'Junnar', beds: { total: 6, available: 4, occupied: 2 }, medicineAvailability: 68, specialists: ['ANM', 'ASHA'], contactPhone: '020-24440102', isActive: true },
  { id: 'f3', name: 'Khed CHC', type: FacilityType.CHC, district: 'Pune', taluka: 'Khed', beds: { total: 50, available: 28, occupied: 22 }, medicineAvailability: 76, specialists: ['Obstetrician', 'General Surgeon', 'Anesthetist'], contactPhone: '020-24440103', isActive: true },
  { id: 'f4', name: 'Sassoon District Hospital', type: FacilityType.DISTRICT_HOSPITAL, district: 'Pune', taluka: 'Pune City', beds: { total: 250, available: 64, occupied: 186 }, medicineAvailability: 92, specialists: ['Cardiologist', 'Neurologist', 'Trauma Surgeon', 'ICU Specialist'], contactPhone: '020-24440000', isActive: true },
  { id: 'f5', name: 'Velhe Sub-Centre', type: FacilityType.SUB_CENTRE, district: 'Pune', taluka: 'Velhe', beds: { total: 8, available: 3, occupied: 5 }, medicineAvailability: 54, specialists: ['ANM'], contactPhone: '020-24440105', isActive: true },
  { id: 'f6', name: 'Bhor PHC', type: FacilityType.PHC, district: 'Pune', taluka: 'Bhor', beds: { total: 18, available: 11, occupied: 7 }, medicineAvailability: 78, specialists: ['Medical Officer', 'Staff Nurse'], contactPhone: '020-24440106', isActive: true },
  { id: 'f7', name: 'Ambegaon CHC', type: FacilityType.CHC, district: 'Pune', taluka: 'Ambegaon', beds: { total: 40, available: 19, occupied: 21 }, medicineAvailability: 81, specialists: ['Orthopedic', 'Pediatrician'], contactPhone: '020-24440107', isActive: true },
  { id: 'f8', name: 'Maval PHC', type: FacilityType.PHC, district: 'Pune', taluka: 'Maval', beds: { total: 15, available: 9, occupied: 6 }, medicineAvailability: 70, specialists: ['Medical Officer'], contactPhone: '020-24440108', isActive: true },
  { id: 'f9', name: 'Paud Sub-Centre', type: FacilityType.SUB_CENTRE, district: 'Pune', taluka: 'Mulshi', beds: { total: 6, available: 5, occupied: 1 }, medicineAvailability: 88, specialists: ['ASHA Worker', 'ANM'], contactPhone: '020-24440109', isActive: true },
  { id: 'f10', name: 'Shirur Sub-Centre', type: FacilityType.SUB_CENTRE, district: 'Pune', taluka: 'Shirur', beds: { total: 8, available: 6, occupied: 2 }, medicineAvailability: 74, specialists: ['ANM'], contactPhone: '020-24440110', isActive: true },
];

const MOCK_DASHBOARD = {
  todaysReferrals: 14,
  referralTrend: 3,
  medicineAvailability: 82,
  patientsWaiting: 8,
  pendingHighRiskAlerts: 2,
  totalPatients: 248,
  facilitiesActive: 10,
  avgResponseTimeMinutes: 12,
  referralCompletionRate: 87,
  topConditions: ['Acute Respiratory Infection', 'Viral Fever', 'Gastroenteritis'],
};

const MOCK_ACTIVE_REFERRALS = [
  { id: 'ref-101', patientId: 'pat-1001', fromFacilityId: 'f1', toFacilityId: 'f2', severity: TriageSeverity.RED, status: ReferralStatus.IN_TRANSIT, reason: 'Suspected Acute Myocardial Infarction', aiTriageSummary: 'Critical cardiac event, immediate transfer required', qrCode: 'QR-REF-101', createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(), updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
  { id: 'ref-102', patientId: 'pat-1002', fromFacilityId: 'f3', toFacilityId: 'f4', severity: TriageSeverity.YELLOW, status: ReferralStatus.ACCEPTED, reason: 'High-Grade Fever + Persistent Vomiting', aiTriageSummary: 'Dehydration risk, needs IV fluids', qrCode: 'QR-REF-102', createdAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(), updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
];

const MOCK_ALERTS = {
  data: [
    { id: 'alt-1', title: 'Critical Medicine Stock Alert', message: 'ORS Sachets & Paracetamol low at Velhe Sub-Centre (< 15%)', priority: 'CRITICAL', facility: 'Velhe Sub-Centre', time: '10 min ago', type: 'STOCK', facilityId: 'f5', isResolved: false, createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
    { id: 'alt-2', title: 'Disease Cluster Warning', message: 'Dengue cluster detected: 12 cases in Velhe taluka over 48 hours', priority: 'HIGH', facility: 'Velhe Taluka', time: '35 min ago', type: 'OUTBREAK', facilityId: 'f5', isResolved: false, createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString() },
  ]
};

export { MOCK_FACILITIES, MOCK_DASHBOARD, MOCK_ACTIVE_REFERRALS, MOCK_ALERTS };
export const api = {
  // Only dashboard overview calls retain explicitly marked sample fallbacks.
  getDashboardStats: async () => {
    type DashboardData = Omit<typeof MOCK_DASHBOARD, 'todaysReferrals' | 'topConditions'> & { todayReferrals: number; topConditions: { name: string; count: number }[] };
    try {
      const response = await safeFetch<ApiResponse<DashboardData>>('/analytics/dashboard');
      if (!response.success) throw new Error(response.error);
      return { ...response.data, todaysReferrals: response.data.todayReferrals, topConditions: response.data.topConditions.map(condition => condition.name), source: 'server' as const };
    } catch {
      return { ...MOCK_DASHBOARD, source: 'sample' as const, limitation: 'Sample dashboard data; not live clinical data.' };
    }
  },
  getPatients: () => safeFetch<ApiResponse<Patient[]>>('/patients'),
  getPatient: (id: string) => safeFetch<ApiResponse<Patient>>(`/patients/${encodeURIComponent(id)}`),
  getPatientRecords: (id: string) => safeFetch<ApiResponse<HealthRecord[]>>(`/patients/${encodeURIComponent(id)}/records`),
  getFacilities: () => safeFetch<ApiResponse<Facility[]>>('/facilities'),
  getFacility: (id: string) => safeFetch<ApiResponse<Facility>>(`/facilities/${encodeURIComponent(id)}`),
  getFacilitySummary: (id: string) => safeFetch<ApiResponse<FacilitySummary>>(`/facilities/${encodeURIComponent(id)}/summary`),
  getFacilityInventory: (id: string) => safeFetch<ApiResponse<MedicineItem[]>>(`/facilities/${encodeURIComponent(id)}/inventory`),
  getFacilityStaff: (id: string) => safeFetch<ApiResponse<StaffMember[]>>(`/facilities/${encodeURIComponent(id)}/staff`),
  getAnalyticsFacilities: () => safeFetch<ApiResponse<FacilitiesAnalytics>>('/analytics/facilities'),
  updateBeds: (id: string, available: number) => safeFetch<ApiResponse<Facility>>(`/facilities/${encodeURIComponent(id)}/beds`, { method: 'PATCH', body: JSON.stringify({ available }) }),
  updateMedicineStock: (id: string, medicineId: string, currentStock: number) => safeFetch<ApiResponse<MedicineItem>>(`/facilities/${encodeURIComponent(id)}/inventory/${encodeURIComponent(medicineId)}`, { method: 'PATCH', body: JSON.stringify({ currentStock }) }),
  getSymptoms: () => safeFetch<ApiResponse<{ categories: SymptomCategory[] }>>('/triage/symptoms'),
  submitTriage: (data: TriagePayload) => safeFetch<ApiResponse<ClinicalTriageResult>>('/triage', { method: 'POST', body: JSON.stringify(data) }),
  createReferral: (data: ReferralPayload) => safeFetch<ApiResponse<Referral & { toFacility: Facility; distanceKm: number; routingReason: string }>>('/referrals', { method: 'POST', body: JSON.stringify(data) }),
  getReferrals: () => safeFetch<ApiResponse<Referral[]>>('/referrals'),
  getActiveReferrals: () => safeFetch<ApiResponse<Referral[]>>('/referrals/active', {}, { success: true, data: MOCK_ACTIVE_REFERRALS, source: 'sample', limitation: 'Sample referrals; not live clinical data.' }),
  getAlerts: () => safeFetch<ApiResponse<Alert[] | typeof MOCK_ALERTS.data>>('/alerts', {}, { success: true, data: MOCK_ALERTS.data, source: 'sample', limitation: 'Sample alerts; not live clinical data.' }),
  createEmergency: (data: EmergencyPayload) => safeFetch<ApiResponse<Emergency>>('/emergencies', { method: 'POST', body: JSON.stringify(data) }),
  getEmergencies: (status?: string) => safeFetch<ApiResponse<Emergency[]>>(`/emergencies${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  getEmergency: (id: string) => safeFetch<ApiResponse<Emergency>>(`/emergencies/${encodeURIComponent(id)}`),
  acknowledgeEmergency: (id: string, userId: string) => safeFetch<ApiResponse<Emergency>>(`/emergencies/${encodeURIComponent(id)}/acknowledge`, { method: 'PATCH', body: JSON.stringify({ userId }) }),
  updateEmergencyStatus: (id: string, status: EmergencyStatus, userId: string, notes?: string) => safeFetch<ApiResponse<Emergency>>(`/emergencies/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status, userId, notes }) }),
  dispatchAmbulance: (id: string) => safeFetch<ApiResponse<{ ambulance: Ambulance; emergency: Emergency }>>(`/emergencies/${encodeURIComponent(id)}/dispatch`, { method: 'POST' }),
  getEmergencyTimeline: (id: string) => safeFetch<ApiResponse<{ timeline: EmergencyEvent[] }>>(`/emergencies/${encodeURIComponent(id)}/timeline`),
  getEmergencyStats: () => safeFetch<ApiResponse<EmergencyStats>>('/emergencies/stats'),
  getAmbulances: () => safeFetch<ApiResponse<Ambulance[]>>('/ambulances'),
  submitFeedback: (data: Omit<PatientFeedback, 'id'>) => safeFetch<ApiResponse<PatientFeedback>>('/analytics/feedback', { method: 'POST', body: JSON.stringify(data) }),
  getFeedback: (facilityId?: string) => safeFetch<ApiResponse<PatientFeedback[]>>(`/analytics/feedback${facilityId ? `?facilityId=${encodeURIComponent(facilityId)}` : ''}`),
  getFeedbackSummary: () => safeFetch<ApiResponse<FeedbackSummary>>('/analytics/feedback/summary'),
  getDiagnosticsTests: () => safeFetch<ApiResponse<{ code: string; name: string; unit: string; normalRange: string }[]>>('/diagnostics/tests'),
  getDiagnosticsOrders: (facilityId?: string, patientId?: string) => {
    const filters = [facilityId ? `facilityId=${encodeURIComponent(facilityId)}` : '', patientId ? `patientId=${encodeURIComponent(patientId)}` : ''].filter(Boolean).join('&');
    return safeFetch<ApiResponse<DiagnosticOrder[]>>(`/diagnostics/orders${filters ? `?${filters}` : ''}`);
  },
  createDiagnosticsOrder: (data: DiagnosticOrderPayload) => safeFetch<ApiResponse<DiagnosticOrder>>('/diagnostics/orders', { method: 'POST', body: JSON.stringify(data) }),
  addDiagnosticsResult: (orderId: string, testCode: string, value: string, unit: string, flag: TestFlag, referenceRange?: string) => safeFetch<ApiResponse<DiagnosticOrder>>(`/diagnostics/orders/${encodeURIComponent(orderId)}/result`, { method: 'PATCH', body: JSON.stringify({ testCode, value, unit, flag, referenceRange }) }),
  updateDiagnosticsOrderStatus: (orderId: string, status: DiagnosticStatus) => safeFetch<ApiResponse<DiagnosticOrder>>(`/diagnostics/orders/${encodeURIComponent(orderId)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};
