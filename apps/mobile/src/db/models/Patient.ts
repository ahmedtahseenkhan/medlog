import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export class Patient extends Model {
  static table = 'patients'

  @field('mr_number') mrNumber!: string
  @field('name') name!: string | null
  @field('phone') phone!: string | null
  @field('status') status!: string
  @field('ward_id') wardId!: string | null
  @field('bed_number') bedNumber!: string | null
  @field('admission_date') admissionDate!: number | null
  @field('admission_diagnosis') admissionDiagnosis!: string | null
  @field('team_id') teamId!: string | null
  @field('server_id') serverId!: string | null
  @field('synced_at') syncedAt!: number | null
  @field('follow_up_date') followUpDate!: number | null
  @field('follow_up_notes') followUpNotes!: string | null
  @field('follow_up_notif_id') followUpNotifId!: string | null
}
