import type { FastifyInstance } from 'fastify'
import { healthRoutes } from './health.js'
import { authRoutes } from './auth.js'
import { mfaRoutes } from './mfa.js'
import { patientRoutes } from './patients.js'
import { wardRoutes } from './wards.js'
import { noteRoutes } from './notes.js'
import { handoverRoutes } from './handover.js'
import { taskRoutes } from './tasks.js'
import { labRoutes } from './labs.js'
import { medicationRoutes } from './medications.js'
import { radiologyRoutes } from './radiology.js'
import { radiologyAIRoutes } from './radiologyAI.js'
import { pushTokenRoutes } from './pushTokens.js'
import { syncRoutes } from './sync.js'
import { ocrRoutes } from './ocr.js'
import { voiceRoutes } from './voice.js'
import { ddxRoutes } from './ddx.js'
// Phase 5
import { fhirRoutes } from './fhir.js'
import { hl7Routes } from './hl7.js'
import { prescriptionRoutes } from './prescriptions.js'
import { sharingRoutes } from './sharing.js'
import { teamRoutes } from './teams.js'
import { auditLogRoutes } from './auditLogs.js'
import { dataExportRoutes } from './dataExport.js'
import { gdprRoutes } from './gdpr.js'
import { complianceRoutes } from './compliance.js'
import { analyticsRoutes } from './analytics.js'
import { consultRoutes } from './consults.js'
import { pharmaRoutes } from './pharma.js'
import { notificationRoutes } from './notifications.js'
import { appointmentRoutes } from './appointments.js'
import { recallRoutes } from './recall.js'

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoutes,      { prefix: '/health' })
  await app.register(authRoutes,        { prefix: '/api/v1/auth' })
  await app.register(mfaRoutes,         { prefix: '/api/v1/mfa' })
  await app.register(patientRoutes,     { prefix: '/api/v1/patients' })
  await app.register(wardRoutes,        { prefix: '/api/v1/wards' })
  await app.register(noteRoutes,        { prefix: '/api/v1/notes' })
  await app.register(handoverRoutes,    { prefix: '/api/v1/handover' })
  await app.register(taskRoutes,        { prefix: '/api/v1/tasks' })
  await app.register(labRoutes,         { prefix: '/api/v1/labs' })
  await app.register(medicationRoutes,  { prefix: '/api/v1/medications' })
  await app.register(radiologyRoutes,   { prefix: '/api/v1/radiology' })
  await app.register(radiologyAIRoutes, { prefix: '/api/v1/radiology-ai' })
  await app.register(pushTokenRoutes,   { prefix: '/api/v1/push-tokens' })
  await app.register(syncRoutes,        { prefix: '/api/v1/sync' })
  await app.register(ocrRoutes,         { prefix: '/api/v1/ocr' })
  await app.register(voiceRoutes,       { prefix: '/api/v1/voice' })
  await app.register(ddxRoutes,         { prefix: '/api/v1/ddx' })
  // Phase 4
  await app.register(teamRoutes,        { prefix: '/api/v1/teams' })
  await app.register(auditLogRoutes,    { prefix: '/api/v1/audit-logs' })
  await app.register(dataExportRoutes,  { prefix: '/api/v1/export' })
  await app.register(gdprRoutes,        { prefix: '/api/v1/gdpr' })
  await app.register(complianceRoutes,  { prefix: '/api/v1/compliance' })
  await app.register(analyticsRoutes,   { prefix: '/api/v1/analytics' })
  await app.register(consultRoutes,     { prefix: '/api/v1/consults' })
  await app.register(pharmaRoutes,      { prefix: '/api/v1/pharma' })
  await app.register(notificationRoutes,  { prefix: '/api/v1/notifications' })
  // Phase 6
  await app.register(appointmentRoutes,  { prefix: '/api/v1/appointments' })
  await app.register(recallRoutes,       { prefix: '/api/v1/recall' })
  // Phase 5
  await app.register(fhirRoutes,        { prefix: '/api/v1/fhir' })
  await app.register(hl7Routes,         { prefix: '/api/v1/hl7' })
  await app.register(prescriptionRoutes,{ prefix: '/api/v1/prescriptions' })
  await app.register(sharingRoutes,     { prefix: '/api/v1/sharing' })
}
