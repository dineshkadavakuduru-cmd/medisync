import { getDemoHeader } from './demoMode';
import { FacilityType, TriageSeverity, ReferralStatus } from '@medisync/shared';

const BASE_URL = 'http://10.0.2.2:3001/api';

const getHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...getDemoHeader(),
});

async function safeFetch<T>(url: string, options?: RequestInit, fallbackData?: T): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(url, {
      ...options,
      headers: { ...getHeaders(), ...(options?.headers || {}) },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (fallbackData !== undefined) {
      return fallbackData;
    }
    throw err;
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
  getDashboardStats: () => safeFetch(`${BASE_URL}/analytics/dashboard`, {}, MOCK_DASHBOARD),
  getPatients: () => safeFetch(`${BASE_URL}/patients`, { headers: getHeaders() }),
  getPatient: (id: string) => safeFetch(`${BASE_URL}/patients/${id}`, { headers: getHeaders() }),
  getPatientRecords: (id: string) => safeFetch(`${BASE_URL}/patients/${id}/records`, { headers: getHeaders() }),
  getFacilities: () => safeFetch(`${BASE_URL}/facilities`, { headers: getHeaders() }, { data: MOCK_FACILITIES }),
  getFacility: (id: string) => safeFetch(`${BASE_URL}/facilities/${id}`, { headers: getHeaders() }),
  getFacilitySummary: (id: string) => safeFetch(`${BASE_URL}/facilities/${id}/summary`, { headers: getHeaders() }),
  getFacilityInventory: (id: string) => safeFetch(`${BASE_URL}/facilities/${id}/inventory`, { headers: getHeaders() }),
  getFacilityStaff: (id: string) => safeFetch(`${BASE_URL}/facilities/${id}/staff`, { headers: getHeaders() }),
  getAnalyticsFacilities: () => safeFetch(`${BASE_URL}/analytics/facilities`, { headers: getHeaders() }, {
    success: true,
    data: {
      facilities: MOCK_FACILITIES,
      districtSummary: { totalBeds: 421, availableBeds: 180, avgMedicineAvailability: 79, totalStaffOnDuty: 48, facilitiesWithCriticalStock: 2 }
    }
  }),
  updateBeds: (id: string, available: number) => fetch(`${BASE_URL}/facilities/${id}/beds`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ available }),
  }).then(r => r.json()),
  updateMedicineStock: (id: string, medicineId: string, currentStock: number) =>
    fetch(`${BASE_URL}/facilities/${id}/inventory/${medicineId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ currentStock }),
    }).then(r => r.json()),
  getSymptoms: () => safeFetch(`${BASE_URL}/triage/symptoms`, { headers: getHeaders() }),
  submitTriage: (data: any) => fetch(`${BASE_URL}/triage`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  }).then(r => r.json()),
  createReferral: (data: any) => fetch(`${BASE_URL}/referrals`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  }).then(r => r.json()),
  getReferrals: () => safeFetch(`${BASE_URL}/referrals`, { headers: getHeaders() }),
  getActiveReferrals: () => safeFetch(`${BASE_URL}/referrals/active`, { headers: getHeaders() }, { data: MOCK_ACTIVE_REFERRALS }),
  getAlerts: () => safeFetch(`${BASE_URL}/alerts`, { headers: getHeaders() }, MOCK_ALERTS),
  createEmergency: (data: any) => fetch(`${BASE_URL}/emergencies`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  }).then(r => r.json()),
  getEmergencies: (status?: string) => safeFetch(`${BASE_URL}/emergencies${status ? `?status=${status}` : ''}`, { headers: getHeaders() }),
  getEmergency: (id: string) => safeFetch(`${BASE_URL}/emergencies/${id}`, { headers: getHeaders() }),
  acknowledgeEmergency: (id: string, userId: string) => fetch(`${BASE_URL}/emergencies/${id}/acknowledge`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ userId }),
  }).then(r => r.json()),
  updateEmergencyStatus: (id: string, status: string, userId: string, notes?: string) => fetch(`${BASE_URL}/emergencies/${id}/status`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ status, userId, notes }),
  }).then(r => r.json()),
  dispatchAmbulance: (id: string) => fetch(`${BASE_URL}/emergencies/${id}/dispatch`, { method: 'POST', headers: getHeaders() }).then(r => r.json()),
  getEmergencyTimeline: (id: string) => safeFetch(`${BASE_URL}/emergencies/${id}/timeline`, { headers: getHeaders() }),
  getEmergencyStats: () => safeFetch(`${BASE_URL}/emergencies/stats`, { headers: getHeaders() }),
  getAmbulances: () => safeFetch(`${BASE_URL}/ambulances`, { headers: getHeaders() }),
  submitFeedback: (data: any) => fetch(`${BASE_URL}/analytics/feedback`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  }).then(r => r.json()),
  getFeedback: (facilityId?: string) => safeFetch(`${BASE_URL}/analytics/feedback${facilityId ? `?facilityId=${facilityId}` : ''}`, { headers: getHeaders() }),
  getFeedbackSummary: () => safeFetch(`${BASE_URL}/analytics/feedback/summary`, { headers: getHeaders() }),
};
