import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'

export async function pushTokenRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  app.post('/register', async (request, reply) => {
    const body = z.object({
      token: z.string().min(10),
      platform: z.enum(['expo', 'web']),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    await prisma.pushToken.upsert({
      where: { token: body.data.token },
      update: { userId: request.user.sub, updatedAt: new Date() },
      create: { token: body.data.token, platform: body.data.platform, userId: request.user.sub },
    })
    return reply.send({ message: 'Token registered' })
  })

  app.delete('/unregister', async (request, reply) => {
    const body = z.object({ token: z.string() }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })
    await prisma.pushToken.deleteMany({ where: { token: body.data.token, userId: request.user.sub } })
    return reply.status(204).send()
  })
}
