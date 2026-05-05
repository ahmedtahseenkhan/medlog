import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate, requireRole } from '../middleware/auth.js'
import { processHl7Message } from '../services/hl7/processor.js'

export async function hl7Routes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  /** Receive a single HL7 v2 message (e.g. from a HIS MLLP bridge) */
  app.post('/message', { onRequest: [requireRole('ADMIN')] }, async (request, reply) => {
    const body = z.object({
      message: z.string().min(10),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const result = await processHl7Message(body.data.message, request.user.sub)

    if (result.error) {
      app.log.warn({ result }, 'HL7 message processing warning')
    }

    return reply.send({ data: result })
  })

  /** Batch ingest — array of HL7 messages (e.g. file upload replay) */
  app.post('/batch', { onRequest: [requireRole('ADMIN')] }, async (request, reply) => {
    const body = z.object({
      messages: z.array(z.string().min(10)).max(500),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const results = await Promise.all(
      body.data.messages.map((msg) => processHl7Message(msg, request.user.sub))
    )

    const summary = {
      total: results.length,
      created: results.filter((r) => r.action === 'created').length,
      updated: results.filter((r) => r.action === 'updated').length,
      ignored: results.filter((r) => r.action === 'ignored').length,
      errors: results.filter((r) => r.error).length,
    }

    return reply.send({ data: { summary, results } })
  })
}
