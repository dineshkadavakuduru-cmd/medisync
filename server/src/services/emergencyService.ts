import { Facility, StaffMember, StaffRole, Emergency, EmergencyEvent, EmergencyProtocolLevel, EmergencyStatus, Ambulance, EmergencyStats } from '../types/index.js';
import { mockFacilities } from '../database/facilities.js';
import { getStaff } from './staffService.js';
import { getFirstAidSteps } from './firstAidService.js';
import { broadcast } from '../websocket/realtime.js';

export const EMERGENCY_PROTOCOLS: Record<EmergencyProtocolLevel, { description: string; maxResponseMinutes: number; notifyRoles: StaffRole[]; autoEscalateAfterMinutes: number; requiresAmbulance: boolean }> = {
  LEVEL_1: {
    description: 'Life-threatening — Immediate action required',
    maxResponseMinutes: 10,
    notifyRoles: ['DOCTOR', 'NURSE', 'ADMIN', 'DISTRICT_OFFICER'],
    autoEscalateAfterMinutes: 3,
    requiresAmbulance: true,
  },
  LEVEL_2: {
    description: 'Urgent — Rapid response needed',
    maxResponseMinutes: 30,
    notifyRoles: ['DOCTOR', 'NURSE', 'ADMIN'],
    autoEscalateAfterMinutes: 10,
    requiresAmbulance: false,
  },
  LEVEL_3: {
    description: 'Priority — Needs attention within the hour',
    maxResponseMinutes: 60,
    notifyRoles: ['DOCTOR', 'NURSE'],
    autoEscalateAfterMinutes: 30,
    requiresAmbulance: false,
  },
};

const CONDITION_PROTOCOLS: Record<string, EmergencyProtocolLevel> = {
  'cardiac_arrest': 'LEVEL_1',
  'stroke': 'LEVEL_1',
  'severe_trauma': 'LEVEL_1',
  'unconscious': 'LEVEL_1',
  'severe_bleeding': 'LEVEL_1',
  'snakebite': 'LEVEL_1',
  'poisoning': 'LEVEL_1',
  'severe_burns': 'LEVEL_1',
  'pregnancy_emergency': 'LEVEL_1',
  'infant_distress': 'LEVEL_1',
  'difficulty_breathing': 'LEVEL_1',
  'anaphylaxis': 'LEVEL_1',
  'high_fever_child': 'LEVEL_2',
  'severe_dehydration': 'LEVEL_2',
  'fracture': 'LEVEL_2',
  'severe_abdominal_pain': 'LEVEL_2',
  'seizure': 'LEVEL_2',
  'high_bp_crisis': 'LEVEL_2',
  'diabetic_emergency': 'LEVEL_2',
  'animal_bite': 'LEVEL_3',
  'moderate_injury': 'LEVEL_3',
  'allergic_reaction': 'LEVEL_3',
  'persistent_vomiting': 'LEVEL_3',
};

const VALID_TRANSITIONS: Record<EmergencyStatus, EmergencyStatus[]> = {
  INITIATED: ['ACKNOWLEDGED', 'ESCALATED', 'RESOLVED'],
  ACKNOWLEDGED: ['AMBULANCE_DISPATCHED', 'ESCALATED', 'RESOLVED'],
  AMBULANCE_DISPATCHED: ['AMBULANCE_EN_ROUTE', 'RESOLVED'],
  AMBULANCE_EN_ROUTE: ['PATIENT_PICKED_UP', 'RESOLVED'],
  PATIENT_PICKED_UP: ['EN_ROUTE_TO_HOSPITAL', 'RESOLVED'],
  EN_ROUTE_TO_HOSPITAL: ['ARRIVED', 'RESOLVED'],
  ARRIVED: ['UNDER_TREATMENT', 'RESOLVED'],
  UNDER_TREATMENT: ['RESOLVED'],
  RESOLVED: [],
  ESCALATED: ['ACKNOWLEDGED', 'RESOLVED'],
};

const escalationTimers: Map<string, NodeJS.Timeout> = new Map();

export function stopEmergencyTimers() {
  for (const timer of escalationTimers.values()) clearTimeout(timer);
  escalationTimers.clear();
}

function generateId(): string {
  return `emg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function getFacilityName(facilityId: string): string {
  const facility = mockFacilities.find((f) => f.id === facilityId);
  return facility?.name || facilityId;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface CreateEmergencyInput {
  patientId?: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  condition: string;
  description: string;
  originFacilityId: string;
  initiatedBy: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
  priority: 'high' | 'normal';
  data: { type: 'EMERGENCY' | 'REFERRAL' | 'STOCK_ALERT' | 'GENERAL'; emergencyId?: string; referralId?: string; facilityId?: string };
  recipients: { role?: string; facilityId?: string; userId?: string }[];
}

export function sendWebSocket(payload: NotificationPayload) {
  broadcast({
    type: payload.data.type === 'EMERGENCY' ? 'EMERGENCY_NEW' : 'ALERT_NEW',
    facilityId: payload.data.facilityId || '',
    data: payload,
    timestamp: new Date().toISOString(),
  });
  return { success: true, channel: 'WebSocket', status: 'broadcast_attempted', deliveryConfirmed: false };
}

export async function sendPushNotification(payload: NotificationPayload) {
  void payload;
  return { success: false, channel: 'PUSH', mode: 'unconfigured', delivered: false, error: 'Push provider unconfigured; nothing sent' };
}

export async function sendSMS(phone: string, message: string) {
  void phone;
  void message;
  return { success: false, channel: 'SMS', mode: 'unconfigured', delivered: false, error: 'SMS provider unconfigured; nothing sent' };
}

export async function dispatchEmergencyAlert(emergency: Emergency, facilities: Facility[], staff: StaffMember[]) {
  const payload: NotificationPayload = {
    title: `🚨 EMERGENCY — ${emergency.protocolLevel}`,
    body: `${emergency.patientName} (${emergency.patientAge}/${emergency.patientGender}) — ${emergency.condition} at ${getFacilityName(emergency.originFacilityId)}. ${emergency.description}`,
    priority: 'high',
    data: {
      type: 'EMERGENCY',
      emergencyId: emergency.id,
      facilityId: emergency.originFacilityId,
    },
    recipients: [],
  };

  const protocol = EMERGENCY_PROTOCOLS[emergency.protocolLevel];

  sendWebSocket(payload);

  const relevantStaff = staff.filter((s) => protocol.notifyRoles.includes(s.role) && (s.facilityId === emergency.originFacilityId || s.facilityId === emergency.destinationFacilityId));
  await sendPushNotification({ ...payload, recipients: relevantStaff.map((s) => ({ userId: s.id })) });

  const doctorsToSMS = relevantStaff.filter((s) => s.role === 'DOCTOR' || s.role === 'ADMIN');
  for (const doc of doctorsToSMS) {
    await sendSMS(doc.phone, `EMERGENCY at ${getFacilityName(emergency.originFacilityId)}: ${emergency.condition} - ${emergency.patientName}. Respond immediately.`);
  }

  return {
    mode: 'demo',
    channels: ['WebSocket'],
    unconfiguredChannels: ['PUSH', 'SMS'],
    deliveryConfirmed: false,
    recipientCount: 0,
    intendedRecipientCount: relevantStaff.length,
    timestamp: new Date().toISOString(),
  };
}

export const emergencies: Map<string, Emergency> = new Map();
export const ambulances: Map<string, Ambulance> = new Map();

function startAutoEscalation(emergency: Emergency) {
  const protocol = EMERGENCY_PROTOCOLS[emergency.protocolLevel];
  const minutes = process.env.ENABLE_SIMULATOR === 'true' ? (emergency.protocolLevel === 'LEVEL_1' ? 0.5 : emergency.protocolLevel === 'LEVEL_2' ? 1 : 2) : protocol.autoEscalateAfterMinutes;
  const timer = setTimeout(() => {
    const emg = emergencies.get(emergency.id);
    if (emg && emg.status === 'INITIATED') {
      emg.status = 'ESCALATED';
      emg.timeline.push({
        id: generateId(),
        timestamp: new Date().toISOString(),
        event: 'AUTO_ESCALATED',
        description: `Emergency auto-escalated: no acknowledgment received within ${protocol.autoEscalateAfterMinutes} minutes. External notification providers unconfigured; officer delivery not confirmed.`,
        automated: true,
      });
      broadcast({ type: 'EMERGENCY_ESCALATED', facilityId: emg.originFacilityId, data: emg, timestamp: new Date().toISOString() });
      console.log(`🚨🚨 EMERGENCY ${emg.id} AUTO-ESCALATED — No response in ${protocol.autoEscalateAfterMinutes} min`);
    }
  }, minutes * 60 * 1000);
  escalationTimers.set(emergency.id, timer);
}

function cancelAutoEscalation(emergencyId: string) {
  const timer = escalationTimers.get(emergencyId);
  if (timer) {
    clearTimeout(timer);
    escalationTimers.delete(emergencyId);
  }
}

function addTimelineEvent(emergency: Emergency, event: string, description: string, userId?: string, automated = false) {
  emergency.timeline.push({ id: generateId(), timestamp: new Date().toISOString(), event, description, userId, automated });
}

export function createEmergency(data: CreateEmergencyInput): Emergency {
  const protocolLevel = CONDITION_PROTOCOLS[data.condition] || 'LEVEL_2';
  const now = new Date().toISOString();
  const emergency: Emergency = {
    id: generateId(),
    patientId: data.patientId,
    patientName: data.patientName,
    patientAge: data.patientAge,
    patientGender: data.patientGender,
    condition: data.condition,
    description: data.description,
    protocolLevel,
    status: 'INITIATED',
    originFacilityId: data.originFacilityId,
    initiatedBy: data.initiatedBy,
    createdAt: now,
    timeline: [],
    firstAidSteps: getFirstAidSteps(data.condition),
  };

  addTimelineEvent(emergency, 'EMERGENCY_INITIATED', `Emergency initiated for ${data.patientName} — ${data.condition}`, data.initiatedBy);
  emergencies.set(emergency.id, emergency);

  if (protocolLevel === 'LEVEL_1') {
    dispatchAmbulance(emergency.id);
  }

  startAutoEscalation(emergency);

  const allStaff = mockFacilities.flatMap((f) => getStaff(f.id));
  dispatchEmergencyAlert(emergency, mockFacilities, allStaff).catch(() => {});

  broadcast({ type: 'EMERGENCY_NEW', facilityId: emergency.originFacilityId, data: emergency, timestamp: now });

  return emergency;
}

export function acknowledgeEmergency(emergencyId: string, userId: string): Emergency | null {
  const emergency = emergencies.get(emergencyId);
  if (!emergency) return null;

  emergency.status = 'ACKNOWLEDGED';
  emergency.acknowledgedBy = userId;
  emergency.acknowledgedAt = new Date().toISOString();
  addTimelineEvent(emergency, 'ACKNOWLEDGED', `Emergency acknowledged by user ${userId}`, userId);

  cancelAutoEscalation(emergencyId);

  broadcast({ type: 'EMERGENCY_UPDATE', facilityId: emergency.originFacilityId, data: emergency, timestamp: new Date().toISOString() });
  return emergency;
}

export function updateEmergencyStatus(emergencyId: string, newStatus: EmergencyStatus, userId: string, notes?: string): Emergency | null {
  const emergency = emergencies.get(emergencyId);
  if (!emergency) return null;

  const allowed = VALID_TRANSITIONS[emergency.status] || [];
  if (!allowed.includes(newStatus)) {
    return emergency;
  }

  emergency.status = newStatus;
  const description = notes ? `${newStatus.replace(/_/g, ' ')} — ${notes}` : `Status updated to ${newStatus.replace(/_/g, ' ')}`;
  addTimelineEvent(emergency, newStatus, description, userId);

  if (newStatus === 'AMBULANCE_DISPATCHED') {
    const amb = dispatchAmbulance(emergencyId);
    if (amb) {
      emergency.ambulanceId = amb.id;
      emergency.status = 'AMBULANCE_DISPATCHED';
    }
  }

  if (newStatus === 'RESOLVED') {
    emergency.resolvedAt = new Date().toISOString();
    cancelAutoEscalation(emergencyId);
  }

  broadcast({ type: 'EMERGENCY_UPDATE', facilityId: emergency.originFacilityId, data: emergency, timestamp: new Date().toISOString() });
  return emergency;
}

export function dispatchAmbulance(emergencyId: string): Ambulance | null {
  const emergency = emergencies.get(emergencyId);
  if (!emergency) return null;

  const availableAmbs = Array.from(ambulances.values()).filter((a) => a.status === 'AVAILABLE');
  if (availableAmbs.length === 0) return null;

  const origin = mockFacilities.find((f) => f.id === emergency.originFacilityId);
  if (!origin) return null;

  let nearest: Ambulance | null = null;
  let minDist = Infinity;
  for (const amb of availableAmbs) {
    const home = mockFacilities.find((f) => f.id === amb.facilityId);
    if (!home) continue;
    const d = haversineDistance(home.latitude, home.longitude, origin.latitude, origin.longitude);
    if (d < minDist) {
      minDist = d;
      nearest = amb;
    }
  }

  if (!nearest) return null;

  nearest.status = 'DISPATCHED';
  nearest.assignedEmergencyId = emergency.id;
  emergency.ambulanceId = nearest.id;
  emergency.estimatedArrivalMinutes = Math.round((minDist / 40) * 60);

  addTimelineEvent(emergency, 'AMBULANCE_DISPATCHED', `Ambulance ${nearest.vehicleNumber} dispatched, ETA ${emergency.estimatedArrivalMinutes} minutes`, undefined, true);

  broadcast({ type: 'AMBULANCE_DISPATCHED', facilityId: emergency.originFacilityId, data: { emergency, ambulance: nearest }, timestamp: new Date().toISOString() });
  return nearest;
}

export function getActiveEmergencies(): Emergency[] {
  return Array.from(emergencies.values())
    .filter((e) => e.status !== 'RESOLVED')
    .sort((a, b) => {
      const levelOrder: Record<EmergencyProtocolLevel, number> = { LEVEL_1: 0, LEVEL_2: 1, LEVEL_3: 2 };
      if (levelOrder[a.protocolLevel] !== levelOrder[b.protocolLevel]) return levelOrder[a.protocolLevel] - levelOrder[b.protocolLevel];
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
}

export function getEmergencyTimeline(emergencyId: string): EmergencyEvent[] {
  return emergencies.get(emergencyId)?.timeline || [];
}

export function getEmergencyStats(): EmergencyStats {
  const all = Array.from(emergencies.values());
  const active = all.filter((e) => e.status !== 'RESOLVED');
  const resolved = all.filter((e) => e.status === 'RESOLVED');
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const todayEmergencies = all.filter((e) => new Date(e.createdAt) >= todayStart);
  const todayResolved = todayEmergencies.filter((e) => e.status === 'RESOLVED');
  const weekEmergencies = all.filter((e) => new Date(e.createdAt) >= weekStart);
  const weekResolved = weekEmergencies.filter((e) => e.status === 'RESOLVED');

  const acknowledgedWithTimes = active.filter((e) => e.acknowledgedAt).map((e) => (new Date(e.acknowledgedAt!).getTime() - new Date(e.createdAt).getTime()) / 60000);
  const resolvedWithTimes = resolved.filter((e) => e.resolvedAt).map((e) => (new Date(e.resolvedAt!).getTime() - new Date(e.createdAt).getTime()) / 60000);

  const ambCounts = Array.from(ambulances.values());
  return {
    active: {
      level1: active.filter((e) => e.protocolLevel === 'LEVEL_1').length,
      level2: active.filter((e) => e.protocolLevel === 'LEVEL_2').length,
      level3: active.filter((e) => e.protocolLevel === 'LEVEL_3').length,
      total: active.length,
    },
    today: { total: todayEmergencies.length, resolved: todayResolved.length, avgResponseMinutes: acknowledgedWithTimes.length ? Math.round(acknowledgedWithTimes.reduce((a, b) => a + b, 0) / acknowledgedWithTimes.length) : 0 },
    thisWeek: { total: weekEmergencies.length, resolved: weekResolved.length },
    avgAcknowledgeTimeMinutes: acknowledgedWithTimes.length ? Math.round((acknowledgedWithTimes.reduce((a, b) => a + b, 0) / acknowledgedWithTimes.length) * 10) / 10 : 0,
    avgResolveTimeMinutes: resolvedWithTimes.length ? Math.round((resolvedWithTimes.reduce((a, b) => a + b, 0) / resolvedWithTimes.length) * 10) / 10 : 0,
    ambulancesAvailable: ambCounts.filter((a) => a.status === 'AVAILABLE').length,
    ambulancesDispatched: ambCounts.filter((a) => a.status !== 'AVAILABLE').length,
  };
}

export function getAmbulances(): Ambulance[] {
  return Array.from(ambulances.values());
}

export function getEmergencyById(id: string): Emergency | undefined {
  return emergencies.get(id);
}

export function seedAmbulances() {
  if (ambulances.size > 0) return;
  ambulances.set('amb-1', {
    id: 'amb-1',
    vehicleNumber: 'MH12AB1234',
    driverName: 'Ramesh Kolekar',
    driverPhone: '+91-9876543210',
    currentLocation: { lat: 18.52, lng: 73.87 },
    status: 'AVAILABLE',
    facilityId: 'facility-8',
  });
  ambulances.set('amb-2', {
    id: 'amb-2',
    vehicleNumber: 'MH12CD5678',
    driverName: 'Suresh Pawar',
    driverPhone: '+91-9876543211',
    currentLocation: { lat: 18.35, lng: 73.85 },
    status: 'AVAILABLE',
    facilityId: 'facility-6',
  });
  ambulances.set('amb-3', {
    id: 'amb-3',
    vehicleNumber: 'MH12EF9012',
    driverName: 'Amit Jadhav',
    driverPhone: '+91-9876543212',
    currentLocation: { lat: 18.45, lng: 73.78 },
    status: 'DISPATCHED',
    facilityId: 'facility-2',
  });
}

export function seedDemoEmergencies() {
  if (emergencies.size > 0) return;

  const emg1 = createEmergency({
    patientName: 'Rajesh Patil',
    patientAge: 55,
    patientGender: 'M',
    condition: 'cardiac_arrest',
    description: 'Severe chest pain, collapsed at home. Family brought to PHC.',
    originFacilityId: 'facility-2',
    initiatedBy: 'user-asha-1',
  });
  emg1.status = 'AMBULANCE_EN_ROUTE';
  emg1.ambulanceId = 'amb-3';
  emg1.estimatedArrivalMinutes = 8;
  addTimelineEvent(emg1, 'ACKNOWLEDGED', 'Emergency acknowledged by Dr. Sharma', 'user-doc-1');
  addTimelineEvent(emg1, 'AMBULANCE_DISPATCHED', 'Ambulance MH12EF9012 dispatched, ETA 8 minutes', undefined, true);
  addTimelineEvent(emg1, 'AMBULANCE_EN_ROUTE', 'Ambulance en route to facility', undefined, true);
  emergencies.set(emg1.id, emg1);

  const emg2 = createEmergency({
    patientName: 'Baby of Sunita More',
    patientAge: 2,
    patientGender: 'F',
    condition: 'severe_dehydration',
    description: 'Child with persistent diarrhea and vomiting for 2 days, very lethargic.',
    originFacilityId: 'facility-1',
    initiatedBy: 'user-asha-2',
  });
  emg2.status = 'ACKNOWLEDGED';
  emg2.acknowledgedBy = 'user-nurse-1';
  emg2.acknowledgedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  addTimelineEvent(emg2, 'ACKNOWLEDGED', 'Emergency acknowledged by Nurse Kavita', 'user-nurse-1');
  emergencies.set(emg2.id, emg2);
}
