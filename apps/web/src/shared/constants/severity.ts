export enum TriageSeverity {
  GREEN = 'GREEN',   // Mild - OPD
  YELLOW = 'YELLOW', // Moderate - Priority
  RED = 'RED',       // Critical - Emergency
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
  CRITICAL = 'CRITICAL', // RED ALERT
}

export enum UserRole {
  ASHA = 'ASHA',
  DOCTOR = 'DOCTOR',
  ADMIN = 'ADMIN',
  PATIENT = 'PATIENT',
}

export enum AlertType {
  EMERGENCY = 'EMERGENCY',
  STOCK = 'STOCK',
  OUTBREAK = 'OUTBREAK',
  SYSTEM = 'SYSTEM',
}