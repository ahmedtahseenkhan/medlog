import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'

export async function mfaRoutes(app: FastifyInstance) {
  // Strict rate limit on all MFA endpoints
  const mfaRateLimit = { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }

  /** Step 1 — generate a TOTP secret for the authenticated user */
  app.post('/setup', { onRequest: [authenticate], ...mfaRateLimit }, async (request, reply) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user.sub } })
    const { secret, uri, qrData } = app.totp.generateSecret(user.email)

    // Store pending (not yet verified) secret
    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecretPending: secret, totpEnabled: false },
    })

    return reply.send({ uri, qrData, message: 'Scan the QR code then call /mfa/verify to activate' })
  })

  /** Step 2 — confirm the TOTP token to activate MFA */
  app.post('/verify', { onRequest: [authenticate], ...mfaRateLimit }, async (request, reply) => {
    const body = z.object({ token: z.string().length(6) }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'token must be 6 digits' })

    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user.sub } })
    if (!user.totpSecretPending) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Run /mfa/setup first' })
    }

    const valid = app.totp.verify(user.totpSecretPending, body.data.token)
    if (!valid) return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid TOTP token' })

    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: user.totpSecretPending, totpSecretPending: null, totpEnabled: true },
    })

    await prisma.auditLog.create({
      data: { userId: user.id, action: 'MFA_ENABLED', resourceType: 'USER', resourceId: user.id },
    })

    return reply.send({ message: 'MFA enabled successfully' })
  })

  /** Called after password login when totpEnabled=true */
  app.post('/challenge', { ...mfaRateLimit }, async (request, reply) => {
    const body = z.object({ mfaToken: z.string(), totpCode: z.string().length(6) }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    let payload: { sub: string; type: string }
    try {
      payload = app.jwt.verify<{ sub: string; type: string }>(body.data.mfaToken)
      if (payload.type !== 'mfa_challenge') throw new Error()
    } catch {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid MFA token' })
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: payload.sub } })
    if (!user.totpSecret) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'MFA not configured' })

    const valid = app.totp.verify(user.totpSecret, body.data.totpCode)
    if (!valid) {
      await prisma.auditLog.create({
        data: { userId: user.id, action: 'MFA_FAIL', resourceType: 'USER', resourceId: user.id, ipAddress: request.ip },
      })
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid TOTP code' })
    }

    const accessToken = app.jwt.sign({ sub: user.id, email: user.email, role: user.role, teamId: user.teamId ?? undefined })
    const refreshToken = app.jwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' })

    await prisma.auditLog.create({
      data: { userId: user.id, action: 'LOGIN_MFA_SUCCESS', resourceType: 'USER', resourceId: user.id, ipAddress: request.ip },
    })

    return reply.send({ accessToken, refreshToken })
  })

  /** Disable MFA — requires current TOTP code */
  app.delete('/disable', { onRequest: [authenticate], ...mfaRateLimit }, async (request, reply) => {
    const body = z.object({ totpCode: z.string().length(6) }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'totpCode required' })

    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user.sub } })
    if (!user.totpSecret || !app.totp.verify(user.totpSecret, body.data.totpCode)) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid TOTP code' })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: null, totpSecretPending: null, totpEnabled: false },
    })

    await prisma.auditLog.create({
      data: { userId: user.id, action: 'MFA_DISABLED', resourceType: 'USER', resourceId: user.id },
    })

    return reply.send({ message: 'MFA disabled' })
  })
}
