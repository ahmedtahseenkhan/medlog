import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'
import { sendNotification } from '../services/notifications/sender.js'

const createLabSchema = z.object({
  patientId: z.string().min(1),
  testName: z.string().min(1).max(200),
  value: z.string().min(1),
  unit: z.string().max(50),
  referenceRangeLow: z.number().optional(),
  referenceRangeHigh: z.number().optional(),
  reportedAt: z.string().datetime(),
})

function detectAbnormal(value: string, low?: number | null, high?: number | null) {
  const num = parseFloat(value)
  if (isNaN(num) || (low == null && high == null)) return { isAbnormal: false, isCritical: false }
  const isAbnormal = (low != null && num < low) || (high != null && num > high)
  const criticalThreshold = 0.5
  const isCritical =
    isAbnormal &&
    ((low != null && num < low * (1 - criticalThreshold)) ||
      (high != null && num > high * (1 + criticalThreshold)))
  return { isAbnormal, isCritical }
}

export async function labRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  app.get('/patient/:patientId', async (request, reply) => {
    const { patientId } = request.params as { patientId: string }
    const labs = await prisma.labReport.findMany({
      where: { patientId },
      orderBy: { reportedAt: 'desc' },
    })
    return reply.send({ data: labs })
  })

  app.post('/', async (request, reply) => {
    const body = createLabSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const { isAbnormal, isCritical } = detectAbnormal(
      body.data.value,
      body.data.referenceRangeLow,
      body.data.referenceRangeHigh
    )

    const lab = await prisma.labReport.create({
      data: { ...body.data, isAbnormal, isCritical, createdById: request.user.sub },
    })

    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'LAB_CREATE', resourceId: lab.id, resourceType: 'LAB' },
    })

    if (isCritical) {
      // Notify all members of the patient's team
      const patient = await prisma.patient.findUnique({
        where: { id: lab.patientId },
        include: { team: { include: { members: { select: { id: true } } } } },
      })
      const memberIds = patient?.team?.members.map((m) => m.id) ?? []
      // Always include the creator
      const recipientIds = [...new Set([...memberIds, request.user.sub])]
      await Promise.all(
        recipientIds.map((uid) =>
          sendNotification(
            uid,
            'CRITICAL_LAB',
            'Critical Lab Result',
            `Critical value for MR#${patient?.mrNumber ?? lab.patientId}: ${lab.testName} = ${lab.value} ${lab.unit}`,
            lab.patientId,
            lab.id,
          )
        )
      )
    }

    return reply.status(201).send({ data: lab })
  })
}
