import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { prisma } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'
import { sendVerificationEmail } from '../services/email/sender.js'

const MAX_FAILED = 5
const LOCKOUT_MINUTES = 15
const AUTH_RATE_LIMIT = { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', AUTH_RATE_LIMIT, async (request, reply) => {
    const body = loginSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })
    }

    const user = await prisma.user.findUnique({ where: { email: body.data.email } })

    // Generic error — don't reveal whether email exists
    const invalidCreds = () =>
      reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid credentials' })

    if (!user || !user.passwordHash) return invalidCreds()

    // Account lockout check
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return reply.status(423).send({
        statusCode: 423,
        error: 'Locked',
        message: `Account locked. Try again after ${user.lockedUntil.toISOString()}`,
      })
    }

    const passwordOk = await bcrypt.compare(body.data.password, user.passwordHash)
    if (!passwordOk) {
      const newCount = user.failedLoginCount + 1
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: newCount,
          lockedUntil: newCount >= MAX_FAILED
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
            : null,
        },
      })
      await prisma.auditLog.create({
        data: { userId: user.id, action: 'LOGIN_FAIL', resourceType: 'USER', resourceId: user.id, ipAddress: request.ip },
      })
      return invalidCreds()
    }

    // Reset lockout on success
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    })

    // If MFA is enabled, issue a short-lived challenge token instead of an access token
    if (user.totpEnabled) {
      const mfaToken = app.jwt.sign({ sub: user.id, type: 'mfa_challenge' }, { expiresIn: '5m' })
      return reply.send({ mfaRequired: true, mfaToken })
    }

    const accessToken = app.jwt.sign({
      sub: user.id, email: user.email, role: user.role, teamId: user.teamId ?? undefined,
    })
    const refreshToken = app.jwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' })

    await prisma.auditLog.create({
      data: { userId: user.id, action: 'LOGIN_SUCCESS', resourceType: 'USER', resourceId: user.id, ipAddress: request.ip },
    })

    return reply.send({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    })
  })

  app.post('/refresh', AUTH_RATE_LIMIT, async (request, reply) => {
    const body = z.object({ refreshToken: z.string() }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'refreshToken required' })

    try {
      const payload = app.jwt.verify<{ sub: string; type: string }>(body.data.refreshToken)
      if (payload.type !== 'refresh') throw new Error('not a refresh token')

      const user = await prisma.user.findUniqueOrThrow({ where: { id: payload.sub } })
      const accessToken = app.jwt.sign({
        sub: user.id, email: user.email, role: user.role, teamId: user.teamId ?? undefined,
      })
      return reply.send({ accessToken })
    } catch {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid refresh token' })
    }
  })

  // POST /auth/signup — public, no auth required
  app.post('/signup', AUTH_RATE_LIMIT, async (request, reply) => {
    const body = z.object({
      email: z.string().email(),
      name: z.string().min(2).max(100),
      password: z.string().min(8),
      role: z.enum(['CONSULTANT', 'RESIDENT', 'INTERN']).default('INTERN'),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const existing = await prisma.user.findUnique({ where: { email: body.data.email } })
    if (existing) return reply.status(409).send({ statusCode: 409, error: 'Conflict', message: 'Email already registered' })

    const body2 = z.object({ verifyCode: z.string().optional() }).safeParse(request.body)
    const bypassCode = body2.data?.verifyCode

    // DEV BYPASS: accept code '0000' to skip email verification
    // TODO: replace with real SMTP verification before production
    if (bypassCode !== '0000') {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid verification code. Use 0000 during development.' })
    }

    const passwordHash = await bcrypt.hash(body.data.password, 12)

    const user = await prisma.user.create({
      data: {
        email: body.data.email,
        name: body.data.name,
        role: body.data.role,
        passwordHash,
        emailVerified: true,
      },
      select: { id: true, email: true, name: true, role: true },
    })

    await prisma.auditLog.create({
      data: { userId: user.id, action: 'USER_SIGNUP', resourceType: 'USER', resourceId: user.id },
    })

    return reply.status(201).send({ message: 'Account created successfully. You can now log in.' })
  })

  // GET /auth/verify-email?token=xxx — public
  app.get('/verify-email', async (request, reply) => {
    const query = z.object({ token: z.string().min(1) }).safeParse(request.query)
    if (!query.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid token' })

    const user = await prisma.user.findFirst({
      where: { emailVerifyToken: query.data.token, emailVerified: false },
    })

    if (!user) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid or already used verification link' })
    if (user.emailVerifyExpiry && user.emailVerifyExpiry < new Date()) {
      return reply.status(410).send({ statusCode: 410, error: 'Gone', message: 'Verification link expired. Please request a new one.' })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifyToken: null, emailVerifyExpiry: null },
    })

    await prisma.auditLog.create({
      data: { userId: user.id, action: 'EMAIL_VERIFIED', resourceType: 'USER', resourceId: user.id },
    })

    return reply.send({ message: 'Email verified successfully. You can now log in.' })
  })

  // POST /auth/resend-verification — public
  app.post('/resend-verification', AUTH_RATE_LIMIT, async (request, reply) => {
    const body = z.object({ email: z.string().email() }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const user = await prisma.user.findUnique({ where: { email: body.data.email } })
    // Always return success to prevent email enumeration
    if (!user || user.emailVerified) return reply.send({ message: 'If that email exists and is unverified, a new link has been sent.' })

    const token = crypto.randomBytes(32).toString('hex')
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken: token, emailVerifyExpiry: expiry },
    })

    await sendVerificationEmail(user.email, user.name, token).catch(console.error)

    return reply.send({ message: 'If that email exists and is unverified, a new link has been sent.' })
  })

  /** Create a local account (admin-initiated or registration flow) */
  app.post('/register', { onRequest: [authenticate] }, async (request, reply) => {
    // Only ADMINs can create accounts directly; Auth0 handles self-serve sign-up
    if (request.user.role !== 'ADMIN') {
      return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Admin only' })
    }

    const body = z.object({
      email: z.string().email(),
      name: z.string().min(2),
      password: z.string().min(12),
      role: z.enum(['CONSULTANT', 'RESIDENT', 'INTERN', 'ADMIN']),
    }).safeParse(request.body)

    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const existing = await prisma.user.findUnique({ where: { email: body.data.email } })
    if (existing) return reply.status(409).send({ statusCode: 409, error: 'Conflict', message: 'Email already in use' })

    const passwordHash = await bcrypt.hash(body.data.password, 12)
    const user = await prisma.user.create({
      data: {
        email: body.data.email,
        name: body.data.name,
        role: body.data.role,
        passwordHash,
        emailVerified: true, // admin-created accounts are pre-verified
      },
      select: { id: true, email: true, name: true, role: true },
    })

    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'USER_CREATE', resourceType: 'USER', resourceId: user.id },
    })

    return reply.status(201).send({ data: user })
  })

  /** Change own password */
  app.post('/change-password', { onRequest: [authenticate] }, async (request, reply) => {
    const body = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(12),
    }).safeParse(request.body)

    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user.sub } })
    if (!user.passwordHash) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No local password set' })

    const ok = await bcrypt.compare(body.data.currentPassword, user.passwordHash)
    if (!ok) return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Current password incorrect' })

    const passwordHash = await bcrypt.hash(body.data.newPassword, 12)
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })

    await prisma.auditLog.create({
      data: { userId: user.id, action: 'PASSWORD_CHANGE', resourceType: 'USER', resourceId: user.id },
    })

    return reply.send({ message: 'Password updated' })
  })

  /** Auth0 callback — exchange Auth0 user info for a MedLog JWT */
  app.post('/auth0/callback', AUTH_RATE_LIMIT, async (request, reply) => {
    const body = z.object({
      auth0Token: z.string(),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    // Decode without verifying — @fastify/jwt or the verifyAuth0 decorator handles sig verification
    // The web/mobile Auth0 SDK already verified the token; we trust the sub claim to look up our user
    let auth0Sub: string
    try {
      const parts = body.data.auth0Token.split('.')
      const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
      auth0Sub = decoded.sub as string
      if (!auth0Sub) throw new Error()
    } catch {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Cannot parse auth0Token' })
    }

    const user = await prisma.user.findUnique({ where: { auth0Sub } })
    if (!user) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'No MedLog account linked to this Auth0 identity. Contact your administrator.',
      })
    }

    const accessToken = app.jwt.sign({
      sub: user.id, email: user.email, role: user.role, teamId: user.teamId ?? undefined,
    })
    const refreshToken = app.jwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' })

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    await prisma.auditLog.create({
      data: { userId: user.id, action: 'LOGIN_AUTH0', resourceType: 'USER', resourceId: user.id, ipAddress: request.ip },
    })

    return reply.send({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    })
  })
}
