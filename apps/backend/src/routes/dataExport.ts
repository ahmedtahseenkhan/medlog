import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'
import { compilePatientExport, encryptExport, buildHtmlReport } from '../services/dataExport.js'

export async function dataExportRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  /** JSON export — AES-256-GCM encrypted */
  app.post('/patient/:patientId/json', async (request, reply) => {
    const { patientId } = request.params as { patientId: string }
    const body = z.object({
      // Identity verification: must re-submit credentials or TOTP code
      verificationToken: z.string().min(6),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    // Verify the token is a valid short-lived export-auth token
    try {
      const payload = app.jwt.verify<{ sub: string; type: string }>(body.data.verificationToken)
      if (payload.type !== 'export_auth' || payload.sub !== request.user.sub) throw new Error()
    } catch {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid verification token' })
    }

    const data = await compilePatientExport(patientId, request.user.sub)
    const { payload, keyHint } = encryptExport(data)

    reply.header('Content-Type', 'application/octet-stream')
    reply.header('Content-Disposition', `attachment; filename="medlog-export-${patientId}-${Date.now()}.enc"`)
    reply.header('X-Key-Hint', keyHint)
    return reply.send(payload)
  })

  /** HTML report — not encrypted, suitable for printing */
  app.post('/patient/:patientId/html', async (request, reply) => {
    const { patientId } = request.params as { patientId: string }
    const body = z.object({ verificationToken: z.string().min(6) }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    try {
      const payload = app.jwt.verify<{ sub: string; type: string }>(body.data.verificationToken)
      if (payload.type !== 'export_auth' || payload.sub !== request.user.sub) throw new Error()
    } catch {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid verification token' })
    }

    const data = await compilePatientExport(patientId, request.user.sub)
    const html = buildHtmlReport(data)

    reply.header('Content-Type', 'text/html; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="medlog-report-${patientId}-${Date.now()}.html"`)
    return reply.send(html)
  })

  /** Issue a short-lived export-auth token after re-verifying identity */
  app.post('/request-export-token', async (request, reply) => {
    const body = z.object({
      password: z.string().optional(),
      totpCode: z.string().length(6).optional(),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user.sub } })

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

    const exportToken = app.jwt.sign({ sub: user.id, type: 'export_auth' }, { expiresIn: '10m' })
    return reply.send({ data: { exportToken, expiresIn: '10 minutes' } })
  })
}
