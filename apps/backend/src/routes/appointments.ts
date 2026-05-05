import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'

const createSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  type: z.enum(['FOLLOW_UP', 'REVIEW', 'PROCEDURE', 'CONSULTATION', 'DISCHARGE_REVIEW']).default('FOLLOW_UP'),
  scheduledAt: z.string().datetime(),
  durationMins: z.number().int().min(5).max(480).default(15),
  notes: z.string().max(1000).optional(),
})

const updateSchema = z.object({
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
})

export async function appointmentRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  // GET / — list appointments for team
  app.get('/', async (request, reply) => {
    const { patientId, status, from, to } = request.query as Record<string, string>

    const where: Record<string, any> = {}

    // Scope: team members see all team appointments; solo doctors see only their own
    where.patient = request.user.teamId
      ? { teamId: request.user.teamId }
      : { createdById: request.user.sub }

    if (patientId) where.patientId = patientId
    if (status) where.status = status
    if (from || to) {
      where.scheduledAt = {}
      if (from) where.scheduledAt.gte = new Date(from)
      if (to) where.scheduledAt.lte = new Date(to)
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
      include: {
        patient: { select: { id: true, mrNumber: true } },
        doctor: { select: { id: true, name: true, role: true } },
      },
    })

    return reply.send({ data: appointments })
  })

  // GET /today — today's appointments for authenticated doctor
  app.get('/today', async (request, reply) => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)

    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId: request.user.sub,
        scheduledAt: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
      },
      orderBy: { scheduledAt: 'asc' },
      include: {
        patient: { select: { id: true, mrNumber: true } },
        doctor: { select: { id: true, name: true, role: true } },
      },
    })

    return reply.send({ data: appointments })
  })

  // POST / — create appointment
  app.post('/', async (request, reply) => {
    const body = createSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })
    }

    const appointment = await prisma.appointment.create({
      data: {
        ...body.data,
        scheduledAt: new Date(body.data.scheduledAt),
        createdById: request.user.sub,
      },
      include: {
        patient: { select: { id: true, mrNumber: true } },
        doctor: { select: { id: true, name: true, role: true } },
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: request.user.sub,
        action: 'APPOINTMENT_CREATE',
        resourceId: appointment.id,
        resourceType: 'APPOINTMENT',
      },
    })

    return reply.status(201).send({ data: appointment })
  })

  // PATCH /:id — update appointment
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = updateSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })
    }

    const existing = await prisma.appointment.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Appointment not found' })
    }

    const data: Record<string, any> = { ...body.data }
    if (body.data.scheduledAt) data.scheduledAt = new Date(body.data.scheduledAt)

    const appointment = await prisma.appointment.update({
      where: { id },
      data,
      include: {
        patient: { select: { id: true, mrNumber: true } },
        doctor: { select: { id: true, name: true, role: true } },
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: request.user.sub,
        action: 'APPOINTMENT_UPDATE',
        resourceId: appointment.id,
        resourceType: 'APPOINTMENT',
      },
    })

    return reply.send({ data: appointment })
  })

  // DELETE /:id — cancel appointment
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.appointment.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Appointment not found' })
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })

    await prisma.auditLog.create({
      data: {
        userId: request.user.sub,
        action: 'APPOINTMENT_CANCEL',
        resourceId: appointment.id,
        resourceType: 'APPOINTMENT',
      },
    })

    return reply.send({ data: appointment })
  })
}
