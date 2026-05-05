export type PatientStatus = 'ADMITTED' | 'DISCHARGED' | 'ARCHIVED'

export interface Patient {
  id: string
  mrNumber: string
  wardId?: string
  bedNumber?: string
  status: PatientStatus
  admissionDate?: string
  admissionDiagnosis?: string
  dischargeDate?: string
  dischargeSummary?: string
  createdBy: string
  teamId?: string
  createdAt: string
  updatedAt: string
}

export interface Ward {
  id: string
  name: string
  code: string
  totalBeds: number
}

export interface CreatePatientInput {
  mrNumber: string
  wardId?: string
  bedNumber?: string
  admissionDate?: string
  admissionDiagnosis?: string
}
