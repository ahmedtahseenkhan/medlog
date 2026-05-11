import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export class ClinicalNote extends Model {
  static table = 'clinical_notes'

  @field('patient_id') patientId!: string
  @field('type') type!: string
  @field('content_json') contentJson!: string
  @field('is_draft') isDraft!: boolean
  @field('author_id') authorId!: string
  @field('server_id') serverId!: string | null
  @field('synced_at') syncedAt!: number | null
  @field('local_only') localOnly!: boolean

  get content() {
    return JSON.parse(this.contentJson)
  }
}
