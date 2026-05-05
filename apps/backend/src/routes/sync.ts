import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'

/**
 * WatermelonDB sync pull: returns all records changed since lastPulledAt
 * scoped to the authenticated user's team.
 */
export async function syncRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  app.get('/pull', async (request, reply) => {
    const query = z.object({ lastPulledAt: z.coerce.number().optional() }).safeParse(request.query)
    if (!query.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: query.error.message })

    const since = query.data.lastPulledAt ? new Date(query.data.lastPulledAt) : new Date(0)
    const teamId = request.user.teamId ?? undefined
    const now = Date.now()

    const [patients, notes, tasks, labs] = await Promise.all([
      prisma.patient.findMany({
        where: { teamId, updatedAt: { gte: since } },
        orderBy: { updatedAt: 'asc' },
      }),
      prisma.clinicalNote.findMany({
        where: { patient: { teamId }, updatedAt: { gte: since } },
        orderBy: { updatedAt: 'asc' },
      }),
      prisma.task.findMany({
        where: { patient: { teamId }, updatedAt: { gte: since } },
        orderBy: { updatedAt: 'asc' },
      }),
      prisma.labReport.findMany({
        where: { patient: { teamId }, createdAt: { gte: since } },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    // WatermelonDB expects { created, updated, deleted } per table
    // We use server_id to identify existing local records
    const toWatermelon = (records: object[]) => ({ created: records, updated: [], deleted: [] })

    return reply.send({
      changes: {
        patients: toWatermelon(patients.map(mapPatient)),
        clinical_notes: toWatermelon(notes.map(mapNote)),
        tasks: toWatermelon(tasks.map(mapTask)),
        lab_reports: toWatermelon(labs.map(mapLab)),
      },
      timestamp: now,
    })
  })

  app.post('/push', async (request, reply) => {
    const body = z.object({
      changes: z.record(z.object({
        created: z.array(z.record(z.unknown())).default([]),
        updated: z.array(z.record(z.unknown())).default([]),
        deleted: z.array(z.string()).default([]),
      })),
    }).safeParse(request.body)

    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const { changes } = body.data

    // Push new clinical notes created offline
    if (changes.clinical_notes?.created?.length) {
      for (const note of changes.clinical_notes.created) {
        const patientId = note.patient_id as string
        if (!patientId) continue
        await prisma.clinicalNote.upsert({
          where: { id: (note.id as string | undefined) ?? 'nonexistent' },
          update: {},
          create: {
            patientId,
            type: (note.type as string) || 'FREE_TEXT',
            content: JSON.parse((note.content_json as string) || '{}'),
            isDraft: Boolean(note.is_draft),
            authorId: request.user.sub,
          },
        })
      }
    }

    // Push new tasks created offline
    if (changes.tasks?.created?.length) {
      for (const task of changes.tasks.created) {
        const patientId = task.patient_id as string
        if (!patientId) continue
        await prisma.task.upsert({
          where: { id: (task.id as string | undefined) ?? 'nonexistent' },
          update: {},
          create: {
            patientId,
            title: task.title as string,
            status: (task.status as string) || 'PENDING',
            priority: (task.priority as string) || 'MEDIUM',
            createdById: request.user.sub,
          },
        })
      }
    }

    return reply.send({ message: 'Push accepted' })
  })
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapPatient(p: { id: string; mrNumber: string; status: string; wardId: string | null; bedNumber: string | null; admissionDate: Date | null; admissionDiagnosis: string | null; teamId: string | null; updatedAt: Date }) {
  return {
    id: p.id,
    server_id: p.id,
    mr_number: p.mrNumber,
    status: p.status,
    ward_id: p.wardId,
    bed_number: p.bedNumber,
    admission_date: p.admissionDate?.getTime() ?? null,
    admission_diagnosis: p.admissionDiagnosis,
    team_id: p.teamId,
    synced_at: p.updatedAt.getTime(),
  }
}

function mapNote(n: { id: string; patientId: string; type: string; content: object; isDraft: boolean; authorId: string; updatedAt: Date }) {
  return {
    id: n.id,
    server_id: n.id,
    patient_id: n.patientId,
    type: n.type,
    content_json: JSON.stringify(n.content),
    is_draft: n.isDraft,
    author_id: n.authorId,
    local_only: false,
    synced_at: n.updatedAt.getTime(),
  }
}

function mapTask(t: { id: string; patientId: string; title: string; status: string; priority: string; dueAt: Date | null; updatedAt: Date }) {
  return {
    id: t.id,
    server_id: t.id,
    patient_id: t.patientId,
    title: t.title,
    status: t.status,
    priority: t.priority,
    due_at: t.dueAt?.getTime() ?? null,
    local_only: false,
    synced_at: t.updatedAt.getTime(),
  }
}

function mapLab(l: { id: string; patientId: string; testName: string; value: string; unit: string; referenceRangeLow: number | null; referenceRangeHigh: number | null; isAbnormal: boolean; isCritical: boolean; reportedAt: Date; createdAt: Date }) {
  return {
    id: l.id,
    server_id: l.id,
    patient_id: l.patientId,
    test_name: l.testName,
    value: l.value,
    unit: l.unit,
    reference_range_low: l.referenceRangeLow,
    reference_range_high: l.referenceRangeHigh,
    is_abnormal: l.isAbnormal,
    is_critical: l.isCritical,
    reported_at: l.reportedAt.getTime(),
    local_only: false,
    synced_at: l.createdAt.getTime(),
  }
}
