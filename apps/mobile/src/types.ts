// Inlined from @medlog/types — keeps the mobile build self-contained

export type UserRole = 'CONSULTANT' | 'RESIDENT' | 'INTERN' | 'ADMIN'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  teamId?: string
  createdAt: string
  updatedAt: string
}

export interface AuthSession {
  userId: string
  role: UserRole
  teamId?: string
  expiresAt: string
}

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

export type NoteType = 'SOAP' | 'FREE_TEXT' | 'HANDOVER'
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface ClinicalNote {
  id: string
  patientId: string
  type: NoteType
  authorId: string
  content: NoteContent
  isDraft: boolean
  createdAt: string
  updatedAt: string
}

export interface NoteContent {
  subjective?: string
  objective?: string
  assessment?: string
  plan?: string
  freeText?: string
}

export interface Task {
  id: string
  patientId: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  assignedTo?: string
  dueAt?: string
  completedAt?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface LabReport {
  id: string
  patientId: string
  testName: string
  value: string
  unit: string
  referenceRangeLow?: number
  referenceRangeHigh?: number
  isAbnormal: boolean
  isCritical: boolean
  reportedAt: string
  createdBy: string
}

export interface MedicationLog {
  id: string
  patientId: string
  drugName: string
  dose: string
  route: string
  frequency: string
  startDate: string
  endDate?: string
  administeredAt?: string
  missedAt?: string
  isPrn: boolean
  createdBy: string
}

export interface ApiResponse<T> {
  data: T
  meta?: {
    total?: number
    page?: number
    pageSize?: number
  }
}

export interface ApiError {
  statusCode: number
  error: string
  message: string
}

export interface PaginationQuery {
  page?: number
  pageSize?: number
}
