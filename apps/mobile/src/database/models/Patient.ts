import { Model } from '@nozbe/watermelondb';
import { field, text, date, readonly } from '@nozbe/watermelondb/decorators';

export default class Patient extends Model {
  static table = 'patients';

  @text('abha_id') abhaId!: string;
  @text('name') name!: string;
  @field('age') age!: number;
  @text('gender') gender!: string;
  @text('phone') phone!: string;
  @text('village') village!: string;
  @text('district') district!: string;
  @text('language') language!: string;
  @date('synced_at') syncedAt!: Date | null;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}