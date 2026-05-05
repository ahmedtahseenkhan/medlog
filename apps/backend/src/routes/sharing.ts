import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'
import { encrypt, decrypt } from '../lib/crypto.js'

const SHARE_TTL_HOURS = 72

export async function sharingRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  /** Generate a time-limited encrypted share link for a patient's summary */
  app.post('/referral', async (request, reply) => {
    const body = z.object({
      patientId: z.string().min(1),
      ttlHours: z.number().int().min(1).max(168).default(72), // max 1 week
      purpose: z.enum(['referral', 'telemedicine']).default('referral'),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + body.data.ttlHours * 3_600_000)

    const link = await prisma.shareLink.create({
      data: {
        patientId: body.data.patientId,
        createdById: request.user.sub,
        token,
        expiresAt,
        purpose: body.data.purpose,
      },
    })

    const shareUrl = `${process.env.APP_URL ?? 'http://localhost:5173'}/share/${token}`

    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'SHARE_LINK_CREATE', resourceType: 'PATIENT', resourceId: body.data.patientId, metadata: { purpose: body.data.purpose, expiresAt } },
    })

    return reply.send({ data: { linkId: link.id, shareUrl, expiresAt, ttlHours: body.data.ttlHours } })
  })

  /** Resolve a share link — no auth required (public endpoint) */
  app.get('/resolve/:token', async (request, reply) => {
    const { token } = request.params as { token: string }

    const link = await prisma.shareLink.findUnique({
      where: { token },
      include: { patient: { include: { ward: true } } },
    })

    if (!link) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invalid or expired link' })
    if (link.expiresAt < new Date()) return reply.status(410).send({ statusCode: 410, error: 'Gone', message: 'Link has expired' })

    await prisma.shareLink.update({ where: { id: link.id }, data: { usedAt: new Date() } })

    const [notes, labs, tasks] = await Promise.all([
      prisma.clinicalNote.findMany({
        where: { patientId: link.patientId, isDraft: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { author: { select: { name: true, role: true } } },
      }),
      prisma.labReport.findMany({
        where: { patientId: link.patientId, isAbnormal: true },
        orderBy: { reportedAt: 'desc' },
        take: 20,
      }),
      prisma.task.findMany({
        where: { patientId: link.patientId, status: { not: 'DONE' } },
        orderBy: [{ priority: 'desc' }],
        take: 10,
      }),
    ])

    await prisma.auditLog.create({
      data: { userId: link.createdById, action: 'SHARE_LINK_ACCESSED', resourceType: 'PATIENT', resourceId: link.patientId, metadata: { token: token.slice(0, 8) + '…' } },
    })

    return reply.send({
      data: {
        patient: {
          mrNumber: link.patient.mrNumber,
          admissionDiagnosis: link.patient.admissionDiagnosis,
          ward: link.patient.ward?.name,
          status: link.patient.status,
        },
        notes: notes.map((n) => ({
          type: n.type,
          date: n.createdAt,
          author: n.author.name,
          content: n.content,
        })),
        abnormalLabs: labs.map((l) => ({ testName: l.testName, value: l.value, unit: l.unit, isCritical: l.isCritical })),
        pendingTasks: tasks.map((t) => ({ title: t.title, priority: t.priority })),
        sharedBy: link.createdById,
        expiresAt: link.expiresAt,
        purpose: link.purpose,
      },
    })
  })

  // ── Telemedicine session notes ───────────────────────────────────────────────

  app.post('/telemedicine-note', async (request, reply) => {
    const body = z.object({
      patientId: z.string().min(1),
      platform: z.string().max(100).default('Video call'),
      duration: z.number().int().min(1).optional(), // minutes
      summary: z.string().min(1).max(5000),
      followUpPlan: z.string().max(2000).optional(),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const content = {
      freeText: [
        `[Telemedicine — ${body.data.platform}${body.data.duration ? `, ${body.data.duration} min` : ''}]`,
        body.data.summary,
        body.data.followUpPlan ? `\nFollow-up plan: ${body.data.followUpPlan}` : '',
      ].join('\n').trim(),
      telemedPlatform: body.data.platform,
      telemedDurationMinutes: body.data.duration,
    }

    const note = await prisma.clinicalNote.create({
      data: {
        patientId: body.data.patientId,
        type: 'FREE_TEXT',
        content,
        isDraft: false,
        authorId: request.user.sub,
      },
    })

    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'TELEMED_NOTE_CREATE', resourceType: 'NOTE', resourceId: note.id },
    })

    return reply.status(201).send({ data: note })
  })
}
