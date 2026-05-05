import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '../db/client.js'
import { authenticate, requireRole } from '../middleware/auth.js'

const INVITE_TTL_HOURS = 48

export async function teamRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  /** Create a team — CONSULTANT or ADMIN only */
  app.post('/', { onRequest: [requireRole('CONSULTANT', 'ADMIN')] }, async (request, reply) => {
    const body = z.object({ name: z.string().min(2).max(100) }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const team = await prisma.team.create({
      data: {
        name: body.data.name,
        members: { connect: { id: request.user.sub } },
      },
    })

    await prisma.user.update({ where: { id: request.user.sub }, data: { teamId: team.id } })

    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'TEAM_CREATE', resourceType: 'TEAM', resourceId: team.id },
    })

    return reply.status(201).send({ data: team })
  })

  /** Get current user's team + members */
  app.get('/me', async (request, reply) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.user.sub },
      include: {
        team: {
          include: {
            members: {
              select: { id: true, name: true, email: true, role: true, lastLoginAt: true },
              orderBy: { role: 'asc' },
            },
          },
        },
      },
    })
    if (!user.team) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Not in a team' })
    return reply.send({ data: user.team })
  })

  /** Invite a user by email — generates a token, stores it, emails in prod */
  app.post('/invite', { onRequest: [requireRole('CONSULTANT', 'ADMIN')] }, async (request, reply) => {
    const body = z.object({
      email: z.string().email(),
      role: z.enum(['RESIDENT', 'INTERN']).default('RESIDENT'),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const inviter = await prisma.user.findUniqueOrThrow({
      where: { id: request.user.sub },
      include: { team: true },
    })
    if (!inviter.teamId) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'You must be in a team to invite' })

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3_600_000)

    const invite = await prisma.teamInvite.upsert({
      where: { email_teamId: { email: body.data.email, teamId: inviter.teamId } },
      update: { token, expiresAt, role: body.data.role, usedAt: null },
      create: {
        email: body.data.email,
        teamId: inviter.teamId,
        invitedById: request.user.sub,
        role: body.data.role,
        token,
        expiresAt,
      },
    })

    // In production, send an email here (SES / SendGrid)
    const acceptUrl = `${process.env.APP_URL ?? 'http://localhost:5173'}/accept-invite?token=${token}`

    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'TEAM_INVITE_SEND', resourceType: 'TEAM', resourceId: inviter.teamId },
    })

    return reply.send({
      data: { inviteId: invite.id, acceptUrl, expiresAt },
      message: 'Invite created. In production this would be emailed.',
    })
  })

  /** Accept an invite */
  app.post('/accept-invite', async (request, reply) => {
    const body = z.object({ token: z.string() }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const invite = await prisma.teamInvite.findUnique({ where: { token: body.data.token } })
    if (!invite) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invalid invite token' })
    if (invite.usedAt) return reply.status(410).send({ statusCode: 410, error: 'Gone', message: 'Invite already used' })
    if (invite.expiresAt < new Date()) return reply.status(410).send({ statusCode: 410, error: 'Gone', message: 'Invite expired' })

    // Accept — join team and set role
    const user = await prisma.user.update({
      where: { id: request.user.sub },
      data: { teamId: invite.teamId, role: invite.role as 'RESIDENT' | 'INTERN' },
      select: { id: true, email: true, name: true, role: true, teamId: true },
    })

    await prisma.teamInvite.update({ where: { id: invite.id }, data: { usedAt: new Date() } })

    await prisma.auditLog.create({
      data: { userId: user.id, action: 'TEAM_INVITE_ACCEPT', resourceType: 'TEAM', resourceId: invite.teamId },
    })

    // Re-issue JWT so new teamId is reflected immediately
    const accessToken = app.jwt.sign({
      sub: user.id, email: user.email, role: user.role, teamId: user.teamId ?? undefined,
    })
    const refreshToken = app.jwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' })

    return reply.send({ data: { user, accessToken, refreshToken } })
  })

  /** List pending invites for my team */
  app.get('/invites', { onRequest: [requireRole('CONSULTANT', 'ADMIN')] }, async (request, reply) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user.sub } })
    if (!user.teamId) return reply.send({ data: [] })

    const invites = await prisma.teamInvite.findMany({
      where: { teamId: user.teamId, usedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ data: invites })
  })

  /** Remove a member from the team */
  app.delete('/members/:userId', { onRequest: [requireRole('CONSULTANT', 'ADMIN')] }, async (request, reply) => {
    const { userId } = request.params as { userId: string }
    const inviter = await prisma.user.findUniqueOrThrow({ where: { id: request.user.sub } })
    if (!inviter.teamId) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Not in a team' })

    await prisma.user.update({
      where: { id: userId, teamId: inviter.teamId },
      data: { teamId: null },
    })

    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'TEAM_MEMBER_REMOVE', resourceType: 'TEAM', resourceId: inviter.teamId, metadata: { removedUserId: userId } },
    })

    return reply.status(204).send()
  })
}
