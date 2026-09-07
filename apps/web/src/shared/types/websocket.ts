export type WSMessageType =
  | 'BED_UPDATE'
  | 'MEDICINE_UPDATE'
  | 'ALERT_NEW'
  | 'ALERT_RESOLVED'
  | 'REFERRAL_UPDATE'
  | 'STAFF_UPDATE'
  | 'EMERGENCY_NEW'
  | 'EMERGENCY_UPDATE'
  | 'EMERGENCY_ESCALATED'
  | 'AMBULANCE_DISPATCHED'
  | 'CONNECTED';

export interface WSMessage {
  type: WSMessageType;
  facilityId: string;
  data: unknown;
  timestamp: string;
}
