import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'
import { checkNewDrugAgainstPatientMeds } from '../services/ai/drugInteractions.js'

const createMedSchema = z.object({
  patientId: z.string().min(1),
  drugName: z.string().min(1).max(200),
  dose: z.string().min(1).max(100),
  route: z.enum(['PO', 'IV', 'IM', 'SC', 'SL', 'INH', 'TOP', 'PR', 'NGT', 'OTHER']),
  frequency: z.string().min(1).max(100),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  isPrn: z.boolean().default(false),
})

export async function medicationRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  app.get('/patient/:patientId', async (request, reply) => {
    const { patientId } = request.params as { patientId: string }
    const meds = await prisma.medicationLog.findMany({
      where: { patientId },
      orderBy: { startDate: 'desc' },
    })
    return reply.send({ data: meds })
  })

  /** Pre-check DDI before adding — non-blocking, returns warnings alongside the new med */
  app.post('/check-interactions', async (request, reply) => {
    const body = z.object({ patientId: z.string().min(1), drugName: z.string() }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })
    const alerts = await checkNewDrugAgainstPatientMeds(body.data.patientId, body.data.drugName)
    return reply.send({ data: { alerts, hasContraindication: alerts.some((a) => a.severity === 'contraindicated') } })
  })

  app.post('/', async (request, reply) => {
    const body = createMedSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    // DDI check on save — attach warnings to response but don't block
    const ddiAlerts = await checkNewDrugAgainstPatientMeds(body.data.patientId, body.data.drugName)

    const med = await prisma.medicationLog.create({
      data: { ...body.data, createdById: request.user.sub },
    })
    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'MED_CREATE', resourceType: 'MEDICATION', resourceId: med.id },
    })
    return reply.status(201).send({
      data: med,
      warnings: ddiAlerts.length ? { interactions: ddiAlerts } : undefined,
    })
  })

  app.post('/:id/administer', async (request, reply) => {
    const { id } = request.params as { id: string }
    const med = await prisma.medicationLog.update({
      where: { id },
      data: { administeredAt: new Date().toISOString() },
    })
    return reply.send({ data: med })
  })

  app.post('/:id/miss', async (request, reply) => {
    const { id } = request.params as { id: string }
    const med = await prisma.medicationLog.update({
      where: { id },
      data: { missedAt: new Date().toISOString() },
    })
    return reply.send({ data: med })
  })

  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createMedSchema.partial().omit({ patientId: true }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })
    const med = await prisma.medicationLog.update({ where: { id }, data: body.data })
    return reply.send({ data: med })
  })

  app.delete('/:id', async (request, reply) => {
    await prisma.medicationLog.delete({ where: { id: request.params as unknown as string } })
    return reply.status(204).send()
  })
}
