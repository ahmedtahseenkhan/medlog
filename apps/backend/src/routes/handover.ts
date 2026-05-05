import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'

/** Builds a structured handover summary for a patient by aggregating
 *  recent notes, pending tasks, and critical labs. */
async function buildHandoverSummary(patientId: string) {
  const [patient, notes, tasks, labs] = await Promise.all([
    prisma.patient.findUniqueOrThrow({
      where: { id: patientId },
      include: { ward: true },
    }),
    prisma.clinicalNote.findMany({
      where: { patientId, isDraft: false },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { author: { select: { name: true, role: true } } },
    }),
    prisma.task.findMany({
      where: { patientId, status: { not: 'DONE' } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    }),
    prisma.labReport.findMany({
      where: { patientId, isAbnormal: true },
      orderBy: { reportedAt: 'desc' },
      take: 10,
    }),
  ])

  const criticalLabs = labs.filter((l) => l.isCritical)
  const abnormalLabs = labs.filter((l) => l.isAbnormal && !l.isCritical)

  const urgentTasks = tasks.filter((t) => t.priority === 'URGENT' || t.priority === 'HIGH')
  const routineTasks = tasks.filter((t) => t.priority !== 'URGENT' && t.priority !== 'HIGH')

  const latestNote = notes[0]
  const latestPlan = latestNote?.type === 'SOAP'
    ? (latestNote.content as Record<string, string>).plan
    : null

  return {
    patient: {
      mrNumber: patient.mrNumber,
      ward: patient.ward?.name ?? 'Unassigned',
      bed: patient.bedNumber ?? '—',
      admissionDiagnosis: patient.admissionDiagnosis,
      admissionDate: patient.admissionDate,
    },
    currentPlan: latestPlan ?? 'No recent plan documented',
    recentNotes: notes.map((n) => ({
      type: n.type,
      author: n.author.name,
      role: n.author.role,
      date: n.createdAt,
      summary: n.type === 'SOAP'
        ? (n.content as Record<string, string>).assessment ?? 'No assessment'
        : ((n.content as Record<string, string>).freeText ?? '').slice(0, 200),
    })),
    pendingTasks: {
      urgent: urgentTasks.map((t) => ({ id: t.id, title: t.title, priority: t.priority, dueAt: t.dueAt })),
      routine: routineTasks.map((t) => ({ id: t.id, title: t.title, priority: t.priority, dueAt: t.dueAt })),
    },
    abnormalLabs: {
      critical: criticalLabs.map((l) => ({ testName: l.testName, value: l.value, unit: l.unit, reportedAt: l.reportedAt })),
      abnormal: abnormalLabs.map((l) => ({ testName: l.testName, value: l.value, unit: l.unit, reportedAt: l.reportedAt })),
    },
    generatedAt: new Date().toISOString(),
  }
}

export async function handoverRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  /** Preview handover for a single patient */
  app.get('/patient/:patientId', async (request, reply) => {
    const { patientId } = request.params as { patientId: string }
    const summary = await buildHandoverSummary(patientId)
    return reply.send({ data: summary })
  })

  /** Batch handover — all admitted patients for the requesting user's team */
  app.get('/team', async (request, reply) => {
    const patients = await prisma.patient.findMany({
      where: { status: 'ADMITTED', teamId: request.user.teamId ?? undefined },
      select: { id: true },
    })
    const summaries = await Promise.all(patients.map((p) => buildHandoverSummary(p.id)))
    return reply.send({ data: summaries })
  })

  /** Commit handover — create a HANDOVER note for the patient and (optionally) assign tasks to another user */
  app.post('/patient/:patientId/commit', async (request, reply) => {
    const { patientId } = request.params as { patientId: string }
    const body = z.object({
      transferToUserId: z.string().min(1).optional(),
      additionalNotes: z.string().max(2000).optional(),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const summary = await buildHandoverSummary(patientId)

    const note = await prisma.clinicalNote.create({
      data: {
        patientId,
        type: 'HANDOVER',
        authorId: request.user.sub,
        isDraft: false,
        content: {
          handoverSummary: summary,
          additionalNotes: body.data.additionalNotes ?? '',
          transferTo: body.data.transferToUserId ?? null,
        },
      },
    })

    // Reassign pending tasks to the new user if specified
    if (body.data.transferToUserId) {
      await prisma.task.updateMany({
        where: { patientId, status: { not: 'DONE' } },
        data: { assignedToId: body.data.transferToUserId },
      })
    }

    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'HANDOVER_COMMIT', resourceType: 'PATIENT', resourceId: patientId },
    })

    return reply.status(201).send({ data: { noteId: note.id, summary } })
  })
}
