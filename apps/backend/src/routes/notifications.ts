import type { FastifyInstance } from 'fastify'
import { prisma } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'

export async function notificationRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  /** GET / — unread + last 50, newest first */
  app.get('/', async (request, reply) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: request.user.sub },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return reply.send({ data: notifications })
  })

  /** PATCH /:id/read — mark one as read */
  app.patch('/:id/read', async (request, reply) => {
    const { id } = request.params as { id: string }
    const notification = await prisma.notification.findUnique({ where: { id } })
    if (!notification) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Notification not found' })
    if (notification.userId !== request.user.sub) {
      return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Access denied' })
    }
    const updated = await prisma.notification.update({ where: { id }, data: { read: true } })
    return reply.send({ data: updated })
  })

  /** PATCH /read-all — mark all as read for current user */
  app.patch('/read-all', async (request, reply) => {
    await prisma.notification.updateMany({
      where: { userId: request.user.sub, read: false },
      data: { read: true },
    })
    return reply.send({ message: 'All notifications marked as read' })
  })

  /** DELETE /:id — delete one */
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const notification = await prisma.notification.findUnique({ where: { id } })
    if (!notification) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Notification not found' })
    if (notification.userId !== request.user.sub) {
      return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Access denied' })
    }
    await prisma.notification.delete({ where: { id } })
    return reply.status(204).send()
  })
}
