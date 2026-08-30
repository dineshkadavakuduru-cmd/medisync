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
export type { Patient, HealthRecord, Referral, Facility, Alert } from './models';