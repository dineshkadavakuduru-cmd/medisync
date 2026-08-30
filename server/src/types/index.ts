export enum TriageSeverity {
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  RED = 'RED',
}

export enum FacilityType {
  SUB_CENTRE = 'SUB_CENTRE',
  PHC = 'PHC',
  CHC = 'CHC',
  DISTRICT_HOSPITAL = 'DISTRICT_HOSPITAL',
}

export enum ReferralStatus {
  CREATED = 'CREATED',
  ACCEPTED = 'ACCEPTED',
  IN_TRANSIT = 'IN_TRANSIT',
  ARRIVED = 'ARRIVED',
  COMPLETED = 'COMPLETED',
  DROPPED = 'DROPPED',
}

export enum AlertPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum AlertType {
  EMERGENCY = 'EMERGENCY',
  STOCK = 'STOCK',
  OUTBREAK = 'OUTBREAK',
  SYSTEM = 'SYSTEM',
}

export enum UserRole {
  ASHA = 'ASHA',
  DOCTOR = 'DOCTOR',
  ADMIN = 'ADMIN',
  PATIENT = 'PATIENT',
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}

export interface DashboardStats {
  todayReferrals: number;
  referralTrend: number;
  medicineAvailability: number;
  patientsWaiting: number;
  pendingHighRiskAlerts: number;
  totalPatients: number;
  facilitiesActive: number;
  avgResponseTimeMinutes: number;
  referralCompletionRate: number;
  topConditions: { name: string; count: number }[];
}

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

export interface VitalSigns {
  temperature?: number;
  heartRate?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  oxygenSaturation?: number;
  respiratoryRate?: number;
}

export interface SymptomEntry {
  id: string;
  label: string;
  labelHi: string;
  labelMr: string;
  system: string;
  weight: number;
  redFlag: boolean;
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
  medicineAvailability: number;
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
  id?: string;
  severity: TriageSeverity;
  confidence: number;
  symptoms: string[];
  recommendation: string;
  needsReferral: boolean;
  suggestedFacilityType: FacilityType;
  affectedSystems: string[];
  vitalSignFlags: string[];
  aiSummary: string;
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
  role: UserRole;
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

export type StaffRole = 'DOCTOR' | 'NURSE' | 'ASHA' | 'ANM' | 'PHARMACIST' | 'LAB_TECH' | 'ADMIN' | 'DISTRICT_OFFICER';

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

export interface OutbreakAlert {
  id: string;
  condition: string;
  region: string;
  facilityIds: string[];
  caseCount: number;
  baselineAvg: number;
  anomalyScore: number;
  severity: 'WATCH' | 'WARNING' | 'OUTBREAK';
  trend: 'RISING' | 'STABLE' | 'DECLINING';
  firstDetected: string;
  lastUpdated: string;
  affectedDemographics: {
    avgAge: number;
    genderSplit: { male: number; female: number };
    mostAffectedVillages: string[];
  };
  recommendation: string;
}

export interface TrendData {
  label: string;
  value: number;
}

export interface DistrictTrends {
  patientVisits: {
    weekly: TrendData[];
    byFacilityType: { subCentre: number; phc: number; chc: number; districtHospital: number };
  };
  referrals: {
    weekly: TrendData[];
    completionRate: TrendData[];
    avgResponseMinutes: TrendData[];
  };
  topConditions: {
    condition: string;
    thisWeek: number;
    lastWeek: number;
    change: number;
    trend: 'up' | 'down' | 'stable';
  }[];
  emergencies: {
    weekly: TrendData[];
    avgResolveMinutes: TrendData[];
    byProtocolLevel: { level1: number; level2: number; level3: number };
  };
  medicineConsumption: {
    topConsumed: { name: string; consumed: number; remaining: number }[];
    stockoutRisk: { facility: string; medicine: string; daysUntilStockout: number }[];
  };
}

export interface FacilityPerformance {
  facilityId: string;
  facilityName: string;
  facilityType: string;
  scores: {
    overall: number;
    patientSatisfaction: number;
    referralCompletion: number;
    medicineAvailability: number;
    staffAttendance: number;
    emergencyResponse: number;
    recordDigitization: number;
  };
  rank: number;
  trend: 'improving' | 'stable' | 'declining';
  strengths: string[];
  improvements: string[];
}

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
  ratingDistribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
  topPositiveTags: { tag: string; count: number }[];
  topNegativeTags: { tag: string; count: number }[];
  byFacility: { facilityId: string; facilityName: string; avgRating: number; feedbackCount: number }[];
}
