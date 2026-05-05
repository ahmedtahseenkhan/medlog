import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { authenticate, requireRole } from '../middleware/auth.js'

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000)
}

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  /** Personal stats for the authenticated user */
  app.get('/me', async (request, reply) => {
    const query = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }).safeParse(request.query)
    if (!query.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: query.error.message })

    const since = daysAgo(query.data.days)
    const userId = request.user.sub

    const [
      patientsManaged,
      notesWritten,
      tasksCreated,
      tasksDone,
      labsEntered,
      ddxSessions,
      handoversCommitted,
    ] = await Promise.all([
      prisma.patient.count({ where: { createdById: userId, createdAt: { gte: since } } }),
      prisma.clinicalNote.count({ where: { authorId: userId, isDraft: false, createdAt: { gte: since } } }),
      prisma.task.count({ where: { createdById: userId, createdAt: { gte: since } } }),
      prisma.task.count({ where: { createdById: userId, status: 'DONE', completedAt: { gte: since } } }),
      prisma.labReport.count({ where: { createdById: userId, createdAt: { gte: since } } }),
      prisma.ddxSession.count({ where: { requestedById: userId, createdAt: { gte: since } } }),
      prisma.clinicalNote.count({ where: { authorId: userId, type: 'HANDOVER', createdAt: { gte: since } } }),
    ])

    const taskCompletionRate = tasksCreated > 0 ? Math.round((tasksDone / tasksCreated) * 100) : null

    // Activity by day (last 14 days)
    const recentNotes = await prisma.clinicalNote.findMany({
      where: { authorId: userId, createdAt: { gte: daysAgo(14) }, isDraft: false },
      select: { createdAt: true },
    })
    const activityByDay = buildDailyActivity(recentNotes.map((n) => n.createdAt), 14)

    return reply.send({
      data: {
        period: { days: query.data.days, from: since.toISOString(), to: new Date().toISOString() },
        summary: {
          patientsManaged,
          notesWritten,
          tasksCreated,
          tasksDone,
          taskCompletionRate,
          labsEntered,
          ddxSessions,
          handoversCommitted,
        },
        activityByDay,
      },
    })
  })

  /** Team performance view — CONSULTANT and ADMIN only */
  app.get('/team', { onRequest: [requireRole('CONSULTANT', 'ADMIN')] }, async (request, reply) => {
    const query = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }).safeParse(request.query)
    if (!query.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: query.error.message })

    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user.sub } })
    if (!user.teamId) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Not in a team' })

    const since = daysAgo(query.data.days)

    const members = await prisma.user.findMany({
      where: { teamId: user.teamId },
      select: { id: true, name: true, role: true },
    })

    const memberStats = await Promise.all(members.map(async (m) => {
      const [patients, notes, tasks, tasksDone, handovers] = await Promise.all([
        prisma.patient.count({ where: { createdById: m.id, createdAt: { gte: since } } }),
        prisma.clinicalNote.count({ where: { authorId: m.id, isDraft: false, createdAt: { gte: since } } }),
        prisma.task.count({ where: { createdById: m.id, createdAt: { gte: since } } }),
        prisma.task.count({ where: { createdById: m.id, status: 'DONE', completedAt: { gte: since } } }),
        prisma.clinicalNote.count({ where: { authorId: m.id, type: 'HANDOVER', createdAt: { gte: since } } }),
      ])
      return {
        userId: m.id,
        name: m.name,
        role: m.role,
        patientsManaged: patients,
        notesWritten: notes,
        taskCompletionRate: tasks > 0 ? Math.round((tasksDone / tasks) * 100) : null,
        handoversCommitted: handovers,
      }
    }))

    // Team-level totals
    const admittedPatients = await prisma.patient.count({
      where: { teamId: user.teamId, status: 'ADMITTED' },
    })
    const pendingTasks = await prisma.task.count({
      where: { patient: { teamId: user.teamId }, status: { not: 'DONE' } },
    })
    const criticalLabs = await prisma.labReport.count({
      where: { patient: { teamId: user.teamId }, isCritical: true, createdAt: { gte: since } },
    })

    return reply.send({
      data: {
        period: { days: query.data.days, from: since.toISOString() },
        teamSummary: { admittedPatients, pendingTasks, criticalLabsThisPeriod: criticalLabs },
        memberStats: memberStats.sort((a, b) => b.patientsManaged - a.patientsManaged),
      },
    })
  })

  /** GET /overview — team-scoped aggregate counts */
  app.get('/overview', async (request, reply) => {
    try {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user.sub } })
      const patientScope = user.teamId ? { teamId: user.teamId } : { createdById: user.id }
      const [
        totalPatients,
        admittedPatients,
        urgentTasks,
        totalTasks,
        pendingTasks,
        completedTasks,
        totalNotes,
      ] = await Promise.all([
        prisma.patient.count({ where: patientScope }),
        prisma.patient.count({ where: { ...patientScope, status: 'ADMITTED' } }),
        prisma.task.count({ where: { patient: patientScope, priority: 'URGENT' } }),
        prisma.task.count({ where: { patient: patientScope } }),
        prisma.task.count({ where: { patient: patientScope, status: { not: 'DONE' } } }),
        prisma.task.count({ where: { patient: patientScope, status: 'DONE' } }),
        prisma.clinicalNote.count({ where: { patient: patientScope, isDraft: false } }),
      ])
      return reply.send({ data: { totalPatients, admittedPatients, urgentTasks, totalTasks, pendingTasks, completedTasks, totalNotes } })
    } catch (err) {
      request.log.error(err)
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to fetch overview' })
    }
  })

  /** GET /diagnoses — top 10 admission diagnoses for the user's team */
  app.get('/diagnoses', async (request, reply) => {
    try {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user.sub } })
      const patientScope = user.teamId ? { teamId: user.teamId } : { createdById: user.id }
      const rows = await prisma.patient.groupBy({
        by: ['admissionDiagnosis'],
        where: { ...patientScope, admissionDiagnosis: { not: null } },
        _count: { admissionDiagnosis: true },
        orderBy: { _count: { admissionDiagnosis: 'desc' } },
        take: 10,
      })
      const data = rows.map((r) => ({ diagnosis: r.admissionDiagnosis ?? 'Unknown', count: r._count.admissionDiagnosis }))
      return reply.send({ data })
    } catch (err) {
      request.log.error(err)
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to fetch diagnoses' })
    }
  })

  /** GET /task-completion — per-user task completion rate within the team */
  app.get('/task-completion', async (request, reply) => {
    try {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user.sub } })
      if (!user.teamId) return reply.send({ data: [] })
      const members = await prisma.user.findMany({
        where: { teamId: user.teamId },
        select: { id: true, name: true },
      })
      const data = await Promise.all(members.map(async (m) => {
        const [completed, pending] = await Promise.all([
          prisma.task.count({ where: { assignedToId: m.id, status: 'DONE' } }),
          prisma.task.count({ where: { assignedToId: m.id, status: { not: 'DONE' } } }),
        ])
        const total = completed + pending
        return { userId: m.id, name: m.name, completed, pending, rate: total > 0 ? Math.round((completed / total) * 100) : 0 }
      }))
      return reply.send({ data })
    } catch (err) {
      request.log.error(err)
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to fetch task completion' })
    }
  })

  /** GET /lab-trends — avg lab values by testName for last 30 days */
  app.get('/lab-trends', async (request, reply) => {
    try {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user.sub } })
      const patientScope = user.teamId ? { teamId: user.teamId } : { createdById: user.id }
      const since = daysAgo(30)
      const rows = await prisma.labReport.groupBy({
        by: ['testName'],
        where: { patient: patientScope, createdAt: { gte: since } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      })
      const data = rows.map((r) => ({
        testName: r.testName,
        sampleCount: r._count.id,
      }))
      return reply.send({ data })
    } catch (err) {
      request.log.error(err)
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to fetch lab trends' })
    }
  })
}  // end analyticsRoutes

function buildDailyActivity(dates: Date[], days: number): { date: string; count: number }[] {
  const result: { date: string; count: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgo(i)
    const dateStr = d.toISOString().slice(0, 10)
    const count = dates.filter((dt) => dt.toISOString().slice(0, 10) === dateStr).length
    result.push({ date: dateStr, count })
  }
  return result
}
