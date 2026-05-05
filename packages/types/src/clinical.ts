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
