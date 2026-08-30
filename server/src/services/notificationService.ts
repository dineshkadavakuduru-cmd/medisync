import { Emergency } from '../types/index.js';
import { mockFacilities } from '../database/facilities.js';
import { getStaff } from './staffService.js';
import { sendWebSocket, sendPushNotification, sendSMS, NotificationPayload, dispatchEmergencyAlert } from './emergencyService.js';

export { sendWebSocket, sendPushNotification, sendSMS, dispatchEmergencyAlert };
