import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'
import { generateViewPresignedUrl } from '../services/s3.js'
import { interpretRadiologyImage } from '../services/ai/radiologyAI.js'

export async function radiologyAIRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  const AI_RATE_LIMIT = { config: { rateLimit: { max: 30, timeWindow: '1 hour' } } }

  app.post('/interpret/:imageId', AI_RATE_LIMIT, async (request, reply) => {
    const { imageId } = request.params as { imageId: string }

    const image = await prisma.radiologyImage.findUnique({ where: { id: imageId } })
    if (!image) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Image not found' })

    // Get a time-limited public view URL so the AI service can fetch the image
    const imageUrl = await generateViewPresignedUrl(image.s3Key)

    const interpretation = await interpretRadiologyImage({
      imageUrl,
      modality: image.modality,
      bodyPart: image.bodyPart ?? undefined,
    })

    // Persist interpretation alongside the image record
    await prisma.radiologyImage.update({
      where: { id: imageId },
      data: { metadata: { ...(image.metadata as object ?? {}), aiInterpretation: interpretation } },
    })

    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'RADIOLOGY_AI_INTERPRET', resourceType: 'RADIOLOGY', resourceId: imageId },
    })

    return reply.send({ data: interpretation })
  })

  app.get('/result/:imageId', async (request, reply) => {
    const { imageId } = request.params as { imageId: string }
    const image = await prisma.radiologyImage.findUnique({ where: { id: imageId } })
    if (!image) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Image not found' })

    const metadata = image.metadata as Record<string, unknown> | null
    const interpretation = metadata?.aiInterpretation ?? null

    return reply.send({ data: interpretation })
  })
}
