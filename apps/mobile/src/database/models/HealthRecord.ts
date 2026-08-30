import { Model } from '@nozbe/watermelondb';
import { field, text, date, readonly } from '@nozbe/watermelondb/decorators';

export default class HealthRecord extends Model {
  static table = 'health_records';

  @text('patient_id') patientId!: string;
  @text('facility_id') facilityId!: string;
  @date('visit_date') visitDate!: Date;
  @text('doctor_name') doctorName!: string;
  @text('diagnosis') diagnosis!: string;
  @text('prescription') prescription!: string;
  @text('notes') notes!: string;
  @date('synced_at') syncedAt!: Date | null;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}