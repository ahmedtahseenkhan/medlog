import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export class Vitals extends Model {
  static table = 'vitals'

  @field('patient_id') patientId!: string
  @field('bp_systolic') bpSystolic!: number | null
  @field('bp_diastolic') bpDiastolic!: number | null
  @field('heart_rate') heartRate!: number | null
  @field('temperature') temperature!: number | null
  @field('spo2') spo2!: number | null
  @field('respiratory_rate') respiratoryRate!: number | null
  @field('recorded_at') recordedAt!: number
  @field('notes') notes!: string | null
}
