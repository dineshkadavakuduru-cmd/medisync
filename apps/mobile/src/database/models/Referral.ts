import { Model } from '@nozbe/watermelondb';
import { field, text, date, readonly } from '@nozbe/watermelondb/decorators';

export default class Referral extends Model {
  static table = 'referrals';

  @text('patient_id') patientId!: string;
  @text('from_facility_id') fromFacilityId!: string;
  @text('to_facility_id') toFacilityId!: string;
  @text('severity') severity!: string;
  @text('status') status!: string;
  @text('reason') reason!: string;
  @text('ai_summary') aiSummary!: string;
  @text('qr_code') qrCode!: string;
  @date('synced_at') syncedAt!: Date | null;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}