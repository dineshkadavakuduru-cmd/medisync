import { Model } from '@nozbe/watermelondb';
import { field, text, date, readonly } from '@nozbe/watermelondb/decorators';

export default class Alert extends Model {
  static table = 'alerts';

  @text('type') type!: string;
  @text('priority') priority!: string;
  @text('title') title!: string;
  @text('message') message!: string;
  @text('facility_id') facilityId!: string;
  @text('patient_id') patientId!: string;
  @field('is_resolved') isResolved!: boolean;
  @date('synced_at') syncedAt!: Date | null;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}