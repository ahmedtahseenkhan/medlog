import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'
import { generateDifferentials } from '../services/ai/ddx.js'
import { sendNotification } from '../services/notifications/sender.js'

const ddxInputSchema = z.object({
  patientId: z.string().min(1),
  symptoms: z.array(z.string()).min(1),
  examination: z.string().default(''),
  history: z.string().default(''),
  age: z.number().int().min(0).max(150).optional(),
  sex: z.enum(['M', 'F', 'Other']).optional(),
})

export async function ddxRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  const DDX_RATE_LIMIT = { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }

  app.post('/generate', DDX_RATE_LIMIT, async (request, reply) => {
    const body = ddxInputSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    // Pull recent abnormal labs for context
    const recentLabs = await prisma.labReport.findMany({
      where: { patientId: body.data.patientId },
      orderBy: { reportedAt: 'desc' },
      take: 20,
      select: { testName: true, value: true, unit: true, isAbnormal: true },
    })

    const result = await generateDifferentials({ ...body.data, labs: recentLabs })

    // Store for feedback loop
    const stored = await prisma.ddxSession.create({
      data: {
        patientId: body.data.patientId,
        requestedById: request.user.sub,
        input: body.data as object,
        result: result as object,
        modelVersion: result.modelVersion,
      },
    })

    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'DDX_GENERATE', resourceType: 'PATIENT', resourceId: body.data.patientId },
    })

    const topDx = Array.isArray((result as any).differentials) && (result as any).differentials.length > 0
      ? (result as any).differentials[0].diagnosis
      : 'differential diagnosis generated'

    await sendNotification(
      request.user.sub,
      'DIAGNOSIS_ALERT',
      'DDx Ready',
      `MR#${body.data.patientId}: Top diagnosis — ${topDx}`,
      body.data.patientId,
      stored.id,
    )

    return reply.send({ data: { sessionId: stored.id, ...result } })
  })

  /** Thumbs up / down feedback for model improvement (WBS 3.3.4) */
  app.post('/:sessionId/feedback', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    const body = z.object({
      rating: z.enum(['up', 'down']),
      comment: z.string().max(1000).optional(),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    await prisma.ddxSession.update({
      where: { id: sessionId },
      data: { feedback: body.data.rating, feedbackComment: body.data.comment },
    })

    return reply.send({ message: 'Feedback recorded' })
  })

  /** Retrieve stored DDx sessions for a patient */
  app.get('/patient/:patientId', async (request, reply) => {
    const { patientId } = request.params as { patientId: string }
    const sessions = await prisma.ddxSession.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, createdAt: true, result: true, feedback: true, modelVersion: true },
    })
    return reply.send({ data: sessions })
  })
}
