import type { FastifyRequest, FastifyReply } from 'fastify'
import type { UserRole } from '@medlog/types'

export interface JwtPayload {
  sub: string
  email: string
  role: UserRole
  teamId?: string
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid token' })
  }
}

export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply)
    if (!roles.includes(request.user.role)) {
      reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Insufficient role' })
    }
  }
}
