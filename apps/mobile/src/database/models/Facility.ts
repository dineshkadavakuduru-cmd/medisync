import { Model } from '@nozbe/watermelondb';
import { field, text, date, readonly } from '@nozbe/watermelondb/decorators';

export default class Facility extends Model {
  static table = 'facilities';

  @text('name') name!: string;
  @text('type') type!: string;
  @field('latitude') latitude!: number;
  @field('longitude') longitude!: number;
  @text('district') district!: string;
  @text('taluka') taluka!: string;
  @field('total_beds') totalBeds!: number;
  @field('available_beds') availableBeds!: number;
  @field('medicine_pct') medicinePct!: number;
  @text('specialists') specialists!: string; // JSON string
  @text('contact_phone') contactPhone!: string;
  @field('is_active') isActive!: boolean;
  @date('synced_at') syncedAt!: Date | null;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}