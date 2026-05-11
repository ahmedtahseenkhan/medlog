import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export class LabReport extends Model {
  static table = 'lab_reports'

  @field('patient_id') patientId!: string
  @field('test_name') testName!: string
  @field('value') value!: string
  @field('unit') unit!: string
  @field('reference_range_low') referenceRangeLow!: number | null
  @field('reference_range_high') referenceRangeHigh!: number | null
  @field('is_abnormal') isAbnormal!: boolean
  @field('is_critical') isCritical!: boolean
  @field('reported_at') reportedAt!: number
  @field('server_id') serverId!: string | null
  @field('synced_at') syncedAt!: number | null
  @field('local_only') localOnly!: boolean
  @field('notification_id') notificationId!: string | null
}
