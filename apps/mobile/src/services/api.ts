import { getDemoHeader } from './demoMode';

const BASE_URL = 'http://10.0.2.2:3001/api';

const getHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...getDemoHeader(),
});

export const api = {
  getDashboardStats: () => fetch(`${BASE_URL}/analytics/dashboard`, { headers: getHeaders() }).then(r => r.json()),
  getPatients: () => fetch(`${BASE_URL}/patients`, { headers: getHeaders() }).then(r => r.json()),
  getPatient: (id: string) => fetch(`${BASE_URL}/patients/${id}`, { headers: getHeaders() }).then(r => r.json()),
  getPatientRecords: (id: string) => fetch(`${BASE_URL}/patients/${id}/records`, { headers: getHeaders() }).then(r => r.json()),
  getFacilities: () => fetch(`${BASE_URL}/facilities`, { headers: getHeaders() }).then(r => r.json()),
  getFacility: (id: string) => fetch(`${BASE_URL}/facilities/${id}`, { headers: getHeaders() }).then(r => r.json()),
  getFacilitySummary: (id: string) => fetch(`${BASE_URL}/facilities/${id}/summary`, { headers: getHeaders() }).then(r => r.json()),
  getFacilityInventory: (id: string) => fetch(`${BASE_URL}/facilities/${id}/inventory`, { headers: getHeaders() }).then(r => r.json()),
  getFacilityStaff: (id: string) => fetch(`${BASE_URL}/facilities/${id}/staff`, { headers: getHeaders() }).then(r => r.json()),
  getAnalyticsFacilities: () => fetch(`${BASE_URL}/analytics/facilities`, { headers: getHeaders() }).then(r => r.json()),
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
  getSymptoms: () => fetch(`${BASE_URL}/triage/symptoms`, { headers: getHeaders() }).then(r => r.json()),
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
  getReferrals: () => fetch(`${BASE_URL}/referrals`, { headers: getHeaders() }).then(r => r.json()),
  getActiveReferrals: () => fetch(`${BASE_URL}/referrals/active`, { headers: getHeaders() }).then(r => r.json()),
  getAlerts: () => fetch(`${BASE_URL}/alerts`, { headers: getHeaders() }).then(r => r.json()),
  createEmergency: (data: any) => fetch(`${BASE_URL}/emergencies`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  }).then(r => r.json()),
  getEmergencies: (status?: string) => fetch(`${BASE_URL}/emergencies${status ? `?status=${status}` : ''}`, { headers: getHeaders() }).then(r => r.json()),
  getEmergency: (id: string) => fetch(`${BASE_URL}/emergencies/${id}`, { headers: getHeaders() }).then(r => r.json()),
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
  getEmergencyTimeline: (id: string) => fetch(`${BASE_URL}/emergencies/${id}/timeline`, { headers: getHeaders() }).then(r => r.json()),
  getEmergencyStats: () => fetch(`${BASE_URL}/emergencies/stats`, { headers: getHeaders() }).then(r => r.json()),
  getAmbulances: () => fetch(`${BASE_URL}/ambulances`, { headers: getHeaders() }).then(r => r.json()),
  submitFeedback: (data: any) => fetch(`${BASE_URL}/analytics/feedback`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  }).then(r => r.json()),
  getFeedback: (facilityId?: string) => fetch(`${BASE_URL}/analytics/feedback${facilityId ? `?facilityId=${facilityId}` : ''}`, { headers: getHeaders() }).then(r => r.json()),
  getFeedbackSummary: () => fetch(`${BASE_URL}/analytics/feedback/summary`, { headers: getHeaders() }).then(r => r.json()),
};
