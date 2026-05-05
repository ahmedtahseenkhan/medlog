import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'

const noteContentSchema = z.object({
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
  freeText: z.string().optional(),
})

const createNoteSchema = z.object({
  patientId: z.string().min(1),
  type: z.enum(['SOAP', 'FREE_TEXT', 'HANDOVER']),
  content: noteContentSchema,
  isDraft: z.boolean().default(false),
})

export async function noteRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  app.get('/patient/:patientId', async (request, reply) => {
    const { patientId } = request.params as { patientId: string }
    const notes = await prisma.clinicalNote.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, name: true, role: true } } },
    })
    return reply.send({ data: notes })
  })

  app.post('/', async (request, reply) => {
    const body = createNoteSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const note = await prisma.clinicalNote.create({
      data: { ...body.data, content: body.data.content as object, authorId: request.user.sub },
    })

    if (!body.data.isDraft) {
      await prisma.auditLog.create({
        data: { userId: request.user.sub, action: 'NOTE_CREATE', resourceId: note.id, resourceType: 'NOTE' },
      })
    }

    return reply.status(201).send({ data: note })
  })

  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createNoteSchema.partial().safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const note = await prisma.clinicalNote.update({
      where: { id, authorId: request.user.sub },
      data: { ...body.data, ...(body.data.content ? { content: body.data.content as object } : {}) },
    })

    return reply.send({ data: note })
  })
}
