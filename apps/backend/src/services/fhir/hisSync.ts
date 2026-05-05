import { prisma } from '../../db/client.js'
import { toFhirPatient, toFhirObservation, toFhirDiagnosticReport, toFhirEncounter, buildFhirBundle } from './mapper.js'

const HIS_BASE_URL = process.env.HIS_FHIR_BASE_URL
const HIS_API_KEY = process.env.HIS_FHIR_API_KEY

interface HisSyncResult {
  patientId: string
  pushed: string[]
  errors: string[]
}

/**
 * Pushes a patient's discharge summary bundle to the hospital HIS via FHIR R4.
 * Called automatically on POST /patients/:id/discharge.
 */
export async function pushDischargeToHis(patientId: string): Promise<HisSyncResult> {
  if (!HIS_BASE_URL) {
    return { patientId, pushed: [], errors: ['HIS_FHIR_BASE_URL not configured — skipping HIS sync'] }
  }

  const [patient, labs, notes] = await Promise.all([
    prisma.patient.findUniqueOrThrow({ where: { id: patientId }, include: { ward: true } }),
    prisma.labReport.findMany({ where: { patientId }, orderBy: { reportedAt: 'desc' }, take: 200 }),
    prisma.clinicalNote.findMany({
      where: { patientId, isDraft: false },
      include: { author: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])

  const labIds = labs.map((l) => l.id)
  const bundle = buildFhirBundle([
    toFhirPatient(patient),
    toFhirEncounter(patient),
    ...labs.map(toFhirObservation),
    ...notes.map((n) => toFhirDiagnosticReport({ ...n, content: n.content as Record<string, string> }, labIds)),
  ])

  const pushed: string[] = []
  const errors: string[] = []

  try {
    const res = await fetch(`${HIS_BASE_URL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json',
        ...(HIS_API_KEY ? { 'Authorization': `Bearer ${HIS_API_KEY}` } : {}),
      },
      body: JSON.stringify(bundle),
    })

    if (!res.ok) {
      const body = await res.text()
      errors.push(`HIS returned ${res.status}: ${body.slice(0, 200)}`)
    } else {
      pushed.push('bundle')
      await prisma.auditLog.create({
        data: { userId: 'system', action: 'HIS_SYNC_PUSH', resourceType: 'PATIENT', resourceId: patientId, metadata: { resources: (bundle as { total: number }).total } },
      })
    }
  } catch (err) {
    errors.push(`Network error: ${String(err)}`)
  }

  return { patientId, pushed, errors }
}

/**
 * Checks whether the HIS FHIR endpoint is reachable and responds to a
 * CapabilityStatement request — used by the compliance status route.
 */
export async function pingHis(): Promise<{ reachable: boolean; fhirVersion?: string; error?: string }> {
  if (!HIS_BASE_URL) return { reachable: false, error: 'HIS_FHIR_BASE_URL not set' }
  try {
    const res = await fetch(`${HIS_BASE_URL}/metadata`, {
      headers: { Accept: 'application/fhir+json' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return { reachable: false, error: `HTTP ${res.status}` }
    const cap = await res.json() as { fhirVersion?: string }
    return { reachable: true, fhirVersion: cap.fhirVersion }
  } catch (err) {
    return { reachable: false, error: String(err) }
  }
}
