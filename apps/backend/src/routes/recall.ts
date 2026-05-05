import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'

const createSchema = z.object({
  intervalDays: z.number().int().min(1).max(3650),
  diagnosisNote: z.string().max(500).optional(),
})

const updateSchema = z.object({
  intervalDays: z.number().int().min(1).max(3650).optional(),
  active: z.boolean().optional(),
  nextDueAt: z.string().datetime().optional(),
})

export async function recallRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  // GET /patient/:patientId — list recall rules for patient
  app.get('/patient/:patientId', async (request, reply) => {
    const { patientId } = request.params as { patientId: string }

    const rules = await prisma.recallRule.findMany({
      where: { patientId },
      orderBy: { nextDueAt: 'asc' },
      include: { patient: { select: { id: true, mrNumber: true } } },
    })

    return reply.send({ data: rules })
  })

  // POST /patient/:patientId — create recall rule
  app.post('/patient/:patientId', async (request, reply) => {
    const { patientId } = request.params as { patientId: string }
    const body = createSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })
    }

    const nextDueAt = new Date()
    nextDueAt.setDate(nextDueAt.getDate() + body.data.intervalDays)

    const rule = await prisma.recallRule.create({
      data: {
        patientId,
        createdById: request.user.sub,
        intervalDays: body.data.intervalDays,
        diagnosisNote: body.data.diagnosisNote,
        nextDueAt,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: request.user.sub,
        action: 'RECALL_RULE_CREATE',
        resourceId: rule.id,
        resourceType: 'RECALL_RULE',
        metadata: { patientId },
      },
    })

    return reply.status(201).send({ data: rule })
  })

  // PATCH /:id — update recall rule
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = updateSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })
    }

    const existing = await prisma.recallRule.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Recall rule not found' })
    }

    const data: Record<string, any> = { ...body.data }
    if (body.data.nextDueAt) data.nextDueAt = new Date(body.data.nextDueAt)
    // If intervalDays changed but nextDueAt not provided, recalculate from now
    if (body.data.intervalDays && !body.data.nextDueAt) {
      const next = new Date()
      next.setDate(next.getDate() + body.data.intervalDays)
      data.nextDueAt = next
    }

    const rule = await prisma.recallRule.update({ where: { id }, data })

    return reply.send({ data: rule })
  })

  // DELETE /:id — delete recall rule
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.recallRule.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Recall rule not found' })
    }

    await prisma.recallRule.delete({ where: { id } })

    return reply.status(204).send()
  })
}
