import { Model } from '@nozbe/watermelondb'
import { field, readonly, date } from '@nozbe/watermelondb/decorators'

export class Task extends Model {
  static table = 'tasks'

  @field('patient_id') patientId!: string
  @field('title') title!: string
  @field('status') status!: string
  @field('priority') priority!: string
  @field('due_at') dueAt!: number | null
  @field('server_id') serverId!: string | null
  @field('synced_at') syncedAt!: number | null
  @field('local_only') localOnly!: boolean
  @field('notification_id') notificationId!: string | null
  @readonly @date('created_at') createdAt!: Date
  @readonly @date('updated_at') updatedAt!: Date
}
