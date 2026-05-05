import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { authenticate, requireRole } from '../middleware/auth.js'

export async function wardRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  app.get('/', async (_req, reply) => {
    const wards = await prisma.ward.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { patients: { where: { status: 'ADMITTED' } } } },
      },
    })
    return reply.send({ data: wards })
  })

  app.post('/', { onRequest: [requireRole('ADMIN', 'CONSULTANT')] }, async (request, reply) => {
    const body = z.object({
      name: z.string().min(1),
      code: z.string().min(1).max(20).toUpperCase(),
      totalBeds: z.number().int().min(1),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const ward = await prisma.ward.create({ data: body.data })
    return reply.status(201).send({ data: ward })
  })

  // Returns bed occupancy for a ward
  app.get('/:id/beds', async (request, reply) => {
    const { id } = request.params as { id: string }
    const ward = await prisma.ward.findUnique({
      where: { id },
      include: {
        patients: {
          where: { status: 'ADMITTED' },
          select: { id: true, mrNumber: true, bedNumber: true, admissionDiagnosis: true },
          orderBy: { bedNumber: 'asc' },
        },
      },
    })
    if (!ward) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Ward not found' })
    return reply.send({ data: ward })
  })
}
