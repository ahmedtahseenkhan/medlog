import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'
import {
  toFhirPatient, toFhirObservation, toFhirDiagnosticReport,
  toFhirEncounter, buildFhirBundle,
} from '../services/fhir/mapper.js'

const FHIR_CONTENT_TYPE = 'application/fhir+json'

/** Sets FHIR content-type on all responses from this plugin */
async function setFhirHeaders(reply: { header: (k: string, v: string) => void }) {
  reply.header('Content-Type', FHIR_CONTENT_TYPE)
}

export async function fhirRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)
  app.addHook('onSend', async (_req, reply) => { reply.header('Content-Type', FHIR_CONTENT_TYPE) })

  // ── Patient ─────────────────────────────────────────────────────────────────

  app.get('/Patient/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const patient = await prisma.patient.findUnique({ where: { id }, include: { ward: true } })
    if (!patient) return reply.status(404).send({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found' }] })
    return reply.send(toFhirPatient(patient))
  })

  app.get('/Patient', async (request, reply) => {
    const query = z.object({ identifier: z.string().optional(), _count: z.coerce.number().max(100).default(20) }).safeParse(request.query)
    if (!query.success) return reply.status(400).send({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'invalid' }] })

    const where = query.data.identifier ? { mrNumber: query.data.identifier } : {}
    const patients = await prisma.patient.findMany({ where, take: query.data._count, include: { ward: true } })
    return reply.send(buildFhirBundle(patients.map(toFhirPatient)))
  })

  // ── Observation (Lab) ────────────────────────────────────────────────────────

  app.get('/Observation/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const lab = await prisma.labReport.findUnique({ where: { id } })
    if (!lab) return reply.status(404).send({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found' }] })
    return reply.send(toFhirObservation(lab))
  })

  app.get('/Observation', async (request, reply) => {
    const query = z.object({ subject: z.string().optional(), _count: z.coerce.number().max(100).default(50) }).safeParse(request.query)
    if (!query.success) return reply.status(400).send({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'invalid' }] })

    const patientId = query.data.subject?.replace('Patient/', '')
    const labs = await prisma.labReport.findMany({
      where: patientId ? { patientId } : {},
      orderBy: { reportedAt: 'desc' },
      take: query.data._count,
    })
    return reply.send(buildFhirBundle(labs.map(toFhirObservation)))
  })

  // ── DiagnosticReport (Clinical Note) ────────────────────────────────────────

  app.get('/DiagnosticReport/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const note = await prisma.clinicalNote.findUnique({ where: { id }, include: { author: true } })
    if (!note) return reply.status(404).send({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found' }] })
    const labs = await prisma.labReport.findMany({ where: { patientId: note.patientId }, select: { id: true } })
    return reply.send(toFhirDiagnosticReport({ ...note, content: note.content as Record<string, string> }, labs.map((l) => l.id)))
  })

  // ── Encounter ────────────────────────────────────────────────────────────────

  app.get('/Encounter/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const patient = await prisma.patient.findUnique({ where: { id }, include: { ward: true } })
    if (!patient) return reply.status(404).send({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found' }] })
    return reply.send(toFhirEncounter(patient))
  })

  // ── Patient $everything — full bundle for a patient ──────────────────────────

  app.get('/Patient/:id/$everything', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [patient, labs, notes] = await Promise.all([
      prisma.patient.findUnique({ where: { id }, include: { ward: true } }),
      prisma.labReport.findMany({ where: { patientId: id }, orderBy: { reportedAt: 'desc' }, take: 200 }),
      prisma.clinicalNote.findMany({ where: { patientId: id, isDraft: false }, include: { author: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
    ])
    if (!patient) return reply.status(404).send({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found' }] })

    const labIds = labs.map((l) => l.id)
    const resources = [
      toFhirPatient(patient),
      toFhirEncounter(patient),
      ...labs.map(toFhirObservation),
      ...notes.map((n) => toFhirDiagnosticReport({ ...n, content: n.content as Record<string, string> }, labIds)),
    ]

    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'FHIR_EXPORT', resourceType: 'PATIENT', resourceId: id },
    })

    return reply.send(buildFhirBundle(resources))
  })

  // ── FHIR CapabilityStatement ─────────────────────────────────────────────────

  app.get('/metadata', async (_request, reply) => {
    return reply.send({
      resourceType: 'CapabilityStatement',
      status: 'active',
      date: '2025-01-01',
      kind: 'instance',
      fhirVersion: '4.0.1',
      format: ['application/fhir+json'],
      rest: [{
        mode: 'server',
        resource: ['Patient', 'Observation', 'DiagnosticReport', 'Encounter'].map((rt) => ({
          type: rt,
          interaction: [{ code: 'read' }, { code: 'search-type' }],
        })),
      }],
    })
  })
}
