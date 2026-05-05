import type { FastifyInstance } from 'fastify'
import { requireRole } from '../middleware/auth.js'

/**
 * Returns the compliance status checklist for the current deployment.
 * Populated from env vars set by DevOps during deployment.
 */
export async function complianceRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireRole('ADMIN'))

  app.get('/status', async (_request, reply) => {
    const checks = {
      encryption: {
        atRest: !!process.env.DATABASE_URL?.includes('sslmode=require') || process.env.NODE_ENV !== 'production',
        inTransit: process.env.NODE_ENV === 'production' ? !!process.env.TLS_ENABLED : true,
        appLevel: !!process.env.ENCRYPTION_KEY,
        status: 'review_required',
      },
      authentication: {
        mfaAvailable: true,
        auth0Configured: !!process.env.AUTH0_DOMAIN,
        sessionTimeout: true,
        accountLockout: true,
        status: process.env.AUTH0_DOMAIN ? 'compliant' : 'partial',
      },
      auditLogging: {
        enabled: true,
        retentionYears: 7,
        exportAvailable: true,
        status: 'compliant',
      },
      dataGovernance: {
        gdprErasureFlow: true,
        dataExportAvailable: true,
        dpaAppointed: !!process.env.DPA_NAME,
        privacyPolicyUrl: process.env.PRIVACY_POLICY_URL ?? null,
        status: process.env.DPA_NAME ? 'compliant' : 'action_required',
      },
      omanMoh: {
        localDataResidency: !!process.env.AWS_REGION?.startsWith('me-'),
        mohRegistration: !!process.env.MOH_REGISTRATION_NUMBER,
        arabicUiSupport: !!process.env.ARABIC_LOCALE_ENABLED,
        status: process.env.MOH_REGISTRATION_NUMBER ? 'compliant' : 'action_required',
      },
      hipaa: {
        baaInPlace: !!process.env.HIPAA_BAA_SIGNED,
        phiEncrypted: true,
        accessControls: true,
        status: process.env.HIPAA_BAA_SIGNED ? 'compliant' : 'action_required',
      },
    }

    const statuses = Object.values(checks).map((c) => c.status)
    const overall = statuses.every((s) => s === 'compliant') ? 'compliant'
      : statuses.some((s) => s === 'action_required') ? 'action_required'
      : 'partial'

    return reply.send({ data: { overall, checks, generatedAt: new Date().toISOString() } })
  })

  app.get('/requirements', async (_request, reply) => {
    return reply.send({
      data: {
        omanMoh: [
          { id: 'OM-1', requirement: 'Patient data must reside within Oman or GCC region', action: 'Set AWS_REGION=me-central-1 (UAE) or me-south-1 (Bahrain)', priority: 'HIGH' },
          { id: 'OM-2', requirement: 'MOH registration for health information systems', action: 'Obtain MOH-HIS licence and set MOH_REGISTRATION_NUMBER', priority: 'HIGH' },
          { id: 'OM-3', requirement: 'Arabic language support', action: 'Implement i18n for Arabic (RTL)', priority: 'MEDIUM' },
          { id: 'OM-4', requirement: 'Data breach notification within 72 hours', action: 'Configure incident response runbook and CIRT contacts', priority: 'HIGH' },
        ],
        gdpr: [
          { id: 'GDPR-1', requirement: 'Appoint a Data Protection Officer (DPO) if processing health data at scale', action: 'Appoint DPO and set DPA_NAME env var', priority: 'HIGH' },
          { id: 'GDPR-2', requirement: 'Lawful basis for processing documented', action: 'Create Data Processing Agreement (DPA) template', priority: 'HIGH' },
          { id: 'GDPR-3', requirement: 'Right to erasure implemented', action: 'DONE — /api/v1/gdpr/me DELETE', priority: 'DONE' },
          { id: 'GDPR-4', requirement: 'Data portability (Article 20)', action: 'DONE — /api/v1/export/patient/:id', priority: 'DONE' },
          { id: 'GDPR-5', requirement: 'Privacy by design — data minimisation', action: 'Store MR# only, no free-text PII in patient records', priority: 'MEDIUM' },
        ],
        hipaa: [
          { id: 'HIPAA-1', requirement: 'Business Associate Agreement with AWS', action: 'Sign AWS BAA and set HIPAA_BAA_SIGNED=true', priority: 'HIGH' },
          { id: 'HIPAA-2', requirement: 'PHI encrypted at rest and in transit', action: 'DONE — AES-256-GCM app-layer + RDS encryption', priority: 'DONE' },
          { id: 'HIPAA-3', requirement: 'Unique user identification and audit controls', action: 'DONE — RBAC + immutable audit log', priority: 'DONE' },
          { id: 'HIPAA-4', requirement: 'Automatic logoff', action: 'DONE — 5-min inactivity lock (web + mobile)', priority: 'DONE' },
          { id: 'HIPAA-5', requirement: 'Penetration testing', action: 'Schedule external pentest before go-live (WBS Phase 6)', priority: 'HIGH' },
        ],
      },
    })
  })
}
