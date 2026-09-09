import { Alert, AlertPriority, AlertType } from '../types/index.js';

export function createEmergencyAlert(
  patientId: string,
  facilityId: string,
  message: string
): Alert {
  return {
    id: `alert-${Date.now()}`,
    type: AlertType.EMERGENCY,
    priority: AlertPriority.CRITICAL,
    title: 'Emergency Alert',
    message,
    facilityId,
    patientId,
    isResolved: false,
    createdAt: new Date(),
  };
}

export function sendMultiChannelAlert(alert: Alert): void {
  void alert;
  console.log('Sending push notification...');
  console.log('Sending SMS...');
  console.log('Broadcasting WebSocket...');
}
