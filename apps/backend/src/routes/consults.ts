import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'
import { sendNotification } from '../services/notifications/sender.js'

export async function consultRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  app.post('/', async (request, reply) => {
    const body = z.object({
      patientId: z.string().min(1),
      toUserId: z.string().min(1),
      urgency: z.enum(['ROUTINE', 'URGENT', 'EMERGENCY']).default('ROUTINE'),
      notes: z.string().optional(),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const consult = await prisma.consult.create({
      data: {
        patientId: body.data.patientId,
        fromUserId: request.user.sub,
        toUserId: body.data.toUserId,
        urgency: body.data.urgency,
        notes: body.data.notes,
      },
      include: {
        patient: true,
        fromUser: { select: { id: true, name: true, role: true } },
        toUser: { select: { id: true, name: true, role: true } },
      },
    })

    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'CONSULT_CREATED', resourceType: 'CONSULT', resourceId: consult.id },
    })

    await sendNotification(
      body.data.toUserId,
      'CONSULT_REQUEST',
      'New Consult Request',
      `Consult requested for MR#${consult.patient.mrNumber} (${body.data.urgency}) from ${consult.fromUser.name}`,
      body.data.patientId,
      consult.id,
    )

    return reply.status(201).send(consult)
  })

  app.get('/', async (request, reply) => {
    const consults = await prisma.consult.findMany({
      where: { OR: [{ fromUserId: request.user.sub }, { toUserId: request.user.sub }] },
      include: {
        patient: { select: { id: true, mrNumber: true, admissionDiagnosis: true } },
        fromUser: { select: { id: true, name: true, role: true } },
        toUser: { select: { id: true, name: true, role: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ data: consults })
  })

  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = z.object({
      status: z.enum(['ACCEPTED', 'DECLINED', 'COMPLETED']),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const consult = await prisma.consult.findUnique({ where: { id } })
    if (!consult) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Consult not found' })
    if (consult.toUserId !== request.user.sub) {
      return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Only the referred doctor can update status' })
    }

    const updated = await prisma.consult.update({
      where: { id },
      data: { status: body.data.status },
      include: {
        patient: { select: { id: true, mrNumber: true } },
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
      },
    })

    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: `CONSULT_${body.data.status}`, resourceType: 'CONSULT', resourceId: id },
    })

    return reply.send(updated)
  })

  app.post('/:id/messages', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = z.object({ body: z.string().min(1) }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const consult = await prisma.consult.findUnique({ where: { id } })
    if (!consult) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Consult not found' })
    if (consult.fromUserId !== request.user.sub && consult.toUserId !== request.user.sub) {
      return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Not a participant in this consult' })
    }

    const message = await prisma.consultMessage.create({
      data: { consultId: id, authorId: request.user.sub, body: body.data.body },
      include: { author: { select: { id: true, name: true } } },
    })

    return reply.status(201).send(message)
  })
}
