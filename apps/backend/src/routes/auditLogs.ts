import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { requireRole } from '../middleware/auth.js'

export async function auditLogRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireRole('ADMIN', 'CONSULTANT'))

  app.get('/', async (request, reply) => {
    const query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(200).default(50),
      userId: z.string().optional(),
      action: z.string().optional(),
      resourceType: z.string().optional(),
      resourceId: z.string().optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }).safeParse(request.query)

    if (!query.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: query.error.message })

    const { page, pageSize, userId, action, resourceType, resourceId, from, to } = query.data
    const where = {
      ...(userId ? { userId } : {}),
      ...(action ? { action: { contains: action, mode: 'insensitive' as const } } : {}),
      ...(resourceType ? { resourceType } : {}),
      ...(resourceId ? { resourceId } : {}),
      ...(from || to ? {
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
      } : {}),
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ])

    return reply.send({ data: logs, meta: { total, page, pageSize } })
  })

  /** Export to CSV — streams directly, max 10,000 rows */
  app.get('/export', async (request, reply) => {
    const query = z.object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }).safeParse(request.query)

    if (!query.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: query.error.message })

    const where = query.data.from || query.data.to
      ? { createdAt: { ...(query.data.from ? { gte: new Date(query.data.from) } : {}), ...(query.data.to ? { lte: new Date(query.data.to) } : {}) } }
      : {}

    const logs = await prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10_000,
    })

    const header = 'id,timestamp,userId,userName,userEmail,action,resourceType,resourceId,ipAddress\n'
    const rows = logs.map((l) =>
      [l.id, l.createdAt.toISOString(), l.userId, `"${l.user.name}"`, l.user.email, l.action, l.resourceType, l.resourceId, l.ipAddress ?? ''].join(',')
    ).join('\n')

    reply.header('Content-Type', 'text/csv')
    reply.header('Content-Disposition', `attachment; filename="audit-log-${Date.now()}.csv"`)
    return reply.send(header + rows)
  })
}
