import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { authenticate, requireRole } from '../middleware/auth.js'
import { eraseUser } from '../services/gdprErasure.js'

export async function gdprRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  /** Self-service account deletion — user erases their own data */
  app.delete('/me', async (request, reply) => {
    const body = z.object({
      confirmation: z.literal('DELETE MY ACCOUNT'),
      password: z.string().optional(),
      totpCode: z.string().length(6).optional(),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Must confirm with "DELETE MY ACCOUNT"' })

    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user.sub } })

    // Require either password or TOTP to confirm identity
    let verified = false
    if (body.data.totpCode && user.totpSecret) {
      verified = app.totp.verify(user.totpSecret, body.data.totpCode)
    } else if (body.data.password && user.passwordHash) {
      const bcrypt = await import('bcrypt')
      verified = await bcrypt.compare(body.data.password, user.passwordHash)
    }
    if (!verified) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Identity verification failed' })
    }

    const result = await eraseUser(request.user.sub, request.user.sub)

    return reply.send({
      data: result,
      message: 'Your personal data has been anonymised. Clinical records you authored are retained as required by medical law.',
    })
  })

  /** Admin-initiated erasure (e.g. on behalf of a user who cannot log in) */
  app.delete('/users/:userId', { onRequest: [requireRole('ADMIN')] }, async (request, reply) => {
    const { userId } = request.params as { userId: string }
    const result = await eraseUser(userId, request.user.sub)
    return reply.send({ data: result })
  })

  /** Data subject access request — what data do we hold on this user? */
  app.get('/me/data-summary', async (request, reply) => {
    const userId = request.user.sub
    const [user, noteCount, taskCount, labCount, auditCount, sessionCount] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, email: true, role: true, createdAt: true, lastLoginAt: true } }),
      prisma.clinicalNote.count({ where: { authorId: userId } }),
      prisma.task.count({ where: { createdById: userId } }),
      prisma.labReport.count({ where: { createdById: userId } }),
      prisma.auditLog.count({ where: { userId } }),
      prisma.ddxSession.count({ where: { requestedById: userId } }),
    ])

    return reply.send({
      data: {
        profile: user,
        recordsHeld: {
          clinicalNotesAuthored: noteCount,
          tasksCreated: taskCount,
          labResultsEntered: labCount,
          auditLogEntries: auditCount,
          aiDdxSessions: sessionCount,
        },
        retentionPolicy: {
          clinicalRecords: '7 years from last patient activity (medical law requirement)',
          auditLogs: '7 years (compliance requirement)',
          personalProfile: 'Until account deletion request',
          aiSessions: 'Until account deletion request',
        },
      },
    })
  })
}
