import { appSchema, tableSchema } from '@nozbe/watermelondb';

import Patient from './models/Patient';
import HealthRecord from './models/HealthRecord';
import Referral from './models/Referral';
import Facility from './models/Facility';
import Alert from './models/Alert';

// Prepared schema only: the app's AsyncStorage queue is not a database sync engine.
export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'patients',
      columns: [
        { name: 'abha_id', type: 'string', isIndexed: true, isOptional: false },
        { name: 'name', type: 'string', isOptional: false },
        { name: 'age', type: 'number', isOptional: false },
        { name: 'gender', type: 'string', isOptional: false },
        { name: 'phone', type: 'string', isOptional: false },
        { name: 'village', type: 'string', isOptional: false },
        { name: 'district', type: 'string', isOptional: false },
        { name: 'language', type: 'string', isOptional: false },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number', isOptional: false },
        { name: 'updated_at', type: 'number', isOptional: false },
      ],
    }),
    tableSchema({
      name: 'health_records',
      columns: [
        { name: 'patient_id', type: 'string', isIndexed: true, isOptional: false },
        { name: 'facility_id', type: 'string', isIndexed: true, isOptional: false },
        { name: 'visit_date', type: 'number', isOptional: false },
        { name: 'doctor_name', type: 'string', isOptional: false },
        { name: 'diagnosis', type: 'string', isOptional: false },
        { name: 'prescription', type: 'string', isOptional: false },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number', isOptional: false },
        { name: 'updated_at', type: 'number', isOptional: false },
      ],
    }),
    tableSchema({
      name: 'referrals',
      columns: [
        { name: 'patient_id', type: 'string', isIndexed: true, isOptional: false },
        { name: 'from_facility_id', type: 'string', isIndexed: true, isOptional: false },
        { name: 'to_facility_id', type: 'string', isIndexed: true, isOptional: false },
        { name: 'severity', type: 'string', isOptional: false },
        { name: 'status', type: 'string', isOptional: false },
        { name: 'reason', type: 'string', isOptional: false },
        { name: 'ai_summary', type: 'string', isOptional: false },
        { name: 'qr_code', type: 'string', isOptional: false },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number', isOptional: false },
        { name: 'updated_at', type: 'number', isOptional: false },
      ],
    }),
    tableSchema({
      name: 'facilities',
      columns: [
        { name: 'name', type: 'string', isOptional: false },
        { name: 'type', type: 'string', isOptional: false },
        { name: 'latitude', type: 'number', isOptional: false },
        { name: 'longitude', type: 'number', isOptional: false },
        { name: 'district', type: 'string', isIndexed: true, isOptional: false },
        { name: 'taluka', type: 'string', isOptional: false },
        { name: 'total_beds', type: 'number', isOptional: false },
        { name: 'available_beds', type: 'number', isOptional: false },
        { name: 'medicine_pct', type: 'number', isOptional: false },
        { name: 'specialists', type: 'string', isOptional: true },
        { name: 'contact_phone', type: 'string', isOptional: false },
        { name: 'is_active', type: 'number', isOptional: false }, // boolean as 0/1
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number', isOptional: false },
        { name: 'updated_at', type: 'number', isOptional: false },
      ],
    }),
    tableSchema({
      name: 'alerts',
      columns: [
        { name: 'type', type: 'string', isOptional: false },
        { name: 'priority', type: 'string', isOptional: false },
        { name: 'title', type: 'string', isOptional: false },
        { name: 'message', type: 'string', isOptional: false },
        { name: 'facility_id', type: 'string', isIndexed: true, isOptional: false },
        { name: 'patient_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'is_resolved', type: 'number', isOptional: false }, // boolean as 0/1
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number', isOptional: false },
        { name: 'updated_at', type: 'number', isOptional: false },
      ],
    }),
  ],
});

export const models = [Patient, HealthRecord, Referral, Facility, Alert];
