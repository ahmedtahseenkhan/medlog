import type { FastifyRequest, FastifyReply } from 'fastify'

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || !roles.includes(request.user.role)) {
      return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Insufficient permissions' })
    }
  }
}
