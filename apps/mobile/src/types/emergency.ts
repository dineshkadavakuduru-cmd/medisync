export interface Emergency {
  id: string;
  patientId?: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  condition: string;
  description: string;
  protocolLevel: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
  status: 'INITIATED' | 'ACKNOWLEDGED' | 'AMBULANCE_DISPATCHED' | 'AMBULANCE_EN_ROUTE' | 'PATIENT_PICKED_UP' | 'EN_ROUTE_TO_HOSPITAL' | 'ARRIVED' | 'UNDER_TREATMENT' | 'RESOLVED' | 'ESCALATED';
  originFacilityId: string;
  destinationFacilityId?: string;
  ambulanceId?: string;
  initiatedBy: string;
  acknowledgedBy?: string;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  estimatedArrivalMinutes?: number;
  timeline: any[];
  firstAidSteps: string[];
}
