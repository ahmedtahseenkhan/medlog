import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'

const createTaskSchema = z.object({
  patientId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  assignedTo: z.string().min(1).optional(),
  dueAt: z.string().datetime().optional(),
})

export async function taskRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  // All tasks for the authenticated user's team (for My Tasks screen)
  app.get('/', async (request, reply) => {
    const query = z.object({ status: z.string().optional() }).safeParse(request.query)
    const patientScope = request.user.teamId
      ? { teamId: request.user.teamId }
      : { createdById: request.user.sub }
    const tasks = await prisma.task.findMany({
      where: {
        patient: patientScope,
        ...(query.data?.status ? { status: query.data.status as any } : {}),
      },
      include: { patient: { select: { id: true, mrNumber: true } } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    })
    return reply.send({ data: tasks })
  })

  app.get('/patient/:patientId', async (request, reply) => {
    const { patientId } = request.params as { patientId: string }
    const tasks = await prisma.task.findMany({
      where: { patientId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    })
    return reply.send({ data: tasks })
  })

  app.post('/', async (request, reply) => {
    const body = createTaskSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const task = await prisma.task.create({
      data: { ...body.data, status: 'PENDING', createdById: request.user.sub },
    })
    return reply.status(201).send({ data: task })
  })

  app.patch('/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = z.object({ status: z.enum(['PENDING', 'IN_PROGRESS', 'DONE']) }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const task = await prisma.task.update({
      where: { id },
      data: {
        status: body.data.status,
        ...(body.data.status === 'DONE' ? { completedAt: new Date().toISOString() } : {}),
      },
    })
    return reply.send({ data: task })
  })

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await prisma.task.delete({ where: { id, createdById: request.user.sub } })
    return reply.status(204).send()
  })
}
