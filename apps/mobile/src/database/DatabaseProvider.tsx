import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { schema, models } from './index';

const adapter = new SQLiteAdapter({
  schema,
  // For development - remove in production
  onSetUpError: (error) => {
    console.error('Database setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: models,
});

export { models } from './index';
export type { default as Patient } from './models/Patient';
export type { default as HealthRecord } from './models/HealthRecord';
export type { default as Referral } from './models/Referral';
export type { default as Facility } from './models/Facility';
export type { default as Alert } from './models/Alert';
