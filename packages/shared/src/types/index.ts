import { TriageSeverity, FacilityType, ReferralStatus, AlertPriority, AlertType } from '../constants/severity.js';
import { WSMessageType, WSMessage } from './websocket.js';

export interface Patient {
  id: string;
  abhaId: string;
  name: string;
  age: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  phone: string;
  village: string;
  district: string;
  languagePreference: string;
  createdAt: Date | string;
}

export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  latitude: number;
  longitude: number;
  district: string;
  taluka: string;
  beds: {
    total: number;
    available: number;
    occupied: number;
  };
  medicineAvailability: number; // 0-100 percentage
  specialists: string[];
  contactPhone: string;
  isActive: boolean;
}

export interface Referral {
  id: string;
  patientId: string;
  fromFacilityId: string;
  toFacilityId: string;
  severity: TriageSeverity;
  status: ReferralStatus;
  reason: string;
  aiTriageSummary: string;
  qrCode: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface TriageResult {
  severity: TriageSeverity;
  confidence: number;
  symptoms: string[];
  recommendation: string;
  needsReferral: boolean;
  suggestedFacilityType: FacilityType;
}

export interface Alert {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  title: string;
  message: string;
  facilityId: string;
  patientId?: string;
  isResolved: boolean;
  createdAt: Date | string;
}

export interface HealthRecord {
  id: string;
  patientId: string;
  facilityId: string;
  visitDate: Date | string;
  doctorName: string;
  diagnosis: string;
  prescription: string;
  documents: string[];
  notes: string;
}

export interface User {
  id: string;
  phone: string;
  name: string;
  role: 'ASHA' | 'DOCTOR' | 'ADMIN' | 'PATIENT';
  facilityId?: string;
  createdAt: Date | string;
}

export interface MedicineInventory {
  id: string;
  facilityId: string;
  medicineName: string;
  currentStock: number;
  threshold: number;
  lastUpdated: Date | string;
}

export type MedicineItemStatus = 'ADEQUATE' | 'LOW' | 'CRITICAL' | 'OUT_OF_STOCK';
export type MedicineCategory = 'essential' | 'antibiotic' | 'analgesic' | 'antimalaria' | 'vitamin' | 'ors' | 'vaccine' | 'other';

export interface MedicineItem {
  id: string;
  facilityId: string;
  name: string;
  category: MedicineCategory;
  currentStock: number;
  minThreshold: number;
  maxCapacity: number;
  unit: string;
  expiryDate?: string;
  lastRestocked: string;
  status: MedicineItemStatus;
}

export type StaffRole = 'DOCTOR' | 'NURSE' | 'ASHA' | 'ANM' | 'PHARMACIST' | 'LAB_TECH' | 'ADMIN';

export interface StaffMember {
  id: string;
  facilityId: string;
  name: string;
  role: StaffRole;
  specialization?: string;
  phone: string;
  isOnDuty: boolean;
  shiftStart?: string;
  shiftEnd?: string;
  languages: string[];
}

export interface DashboardStats {
  todaysReferrals: number;
  referralTrend: number;
  medicineAvailability: number;
  patientsWaiting: number;
  highRiskAlerts: number;
  activeFacilities: number;
}

export interface FacilitySummary {
  facility: Facility;
  beds: {
    total: number;
    available: number;
    occupied: number;
    occupancyRate: number;
  };
  medicine: {
    overallAvailability: number;
    totalItems: number;
    adequate: number;
    low: number;
    critical: number;
    outOfStock: number;
    criticalItems: { name: string; currentStock: number; minThreshold: number }[];
  };
  staff: {
    total: number;
    onDuty: number;
    doctors: number;
    doctorsOnDuty: number;
    specialists: string[];
    specialistsOnDuty: string[];
  };
  recentReferralsIn: number;
  recentReferralsOut: number;
  activeAlerts: number;
}

export interface FacilitiesAnalytics {
  facilities: {
    id: string;
    name: string;
    type: FacilityType;
    bedOccupancy: number;
    medicineAvailability: number;
    staffOnDuty: number;
    todayPatients: number;
    pendingReferrals: number;
    performanceScore: number;
  }[];
  districtSummary: {
    totalBeds: number;
    availableBeds: number;
    avgMedicineAvailability: number;
    totalStaffOnDuty: number;
    facilitiesWithCriticalStock: number;
  };
}

export type EmergencyProtocolLevel = 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
export type EmergencyStatus = 'INITIATED' | 'ACKNOWLEDGED' | 'AMBULANCE_DISPATCHED' | 'AMBULANCE_EN_ROUTE' | 'PATIENT_PICKED_UP' | 'EN_ROUTE_TO_HOSPITAL' | 'ARRIVED' | 'UNDER_TREATMENT' | 'RESOLVED' | 'ESCALATED';

export interface EmergencyEvent {
  id: string;
  timestamp: string;
  event: string;
  description: string;
  userId?: string;
  automated: boolean;
}

export interface Emergency {
  id: string;
  patientId?: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  condition: string;
  description: string;
  protocolLevel: EmergencyProtocolLevel;
  status: EmergencyStatus;
  originFacilityId: string;
  destinationFacilityId?: string;
  ambulanceId?: string;
  initiatedBy: string;
  acknowledgedBy?: string;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  estimatedArrivalMinutes?: number;
  timeline: EmergencyEvent[];
  firstAidSteps: string[];
}

export interface Ambulance {
  id: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
  currentLocation: { lat: number; lng: number };
  status: 'AVAILABLE' | 'DISPATCHED' | 'EN_ROUTE' | 'AT_PICKUP' | 'TRANSPORTING' | 'RETURNING';
  assignedEmergencyId?: string;
  facilityId: string;
}

export interface EmergencyStats {
  active: { level1: number; level2: number; level3: number; total: number };
  today: { total: number; resolved: number; avgResponseMinutes: number };
  thisWeek: { total: number; resolved: number };
  avgAcknowledgeTimeMinutes: number;
  avgResolveTimeMinutes: number;
  ambulancesAvailable: number;
  ambulancesDispatched: number;
}
