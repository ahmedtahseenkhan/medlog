import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'
import { generateUploadPresignedUrl, generateViewPresignedUrl, deleteS3Object } from '../services/s3.js'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/dicom', 'image/webp']
const MAX_FILENAME_LEN = 200

export async function radiologyRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  /** Step 1: client requests a pre-signed upload URL */
  app.post('/upload-url', async (request, reply) => {
    const body = z.object({
      patientId: z.string().min(1),
      modality: z.enum(['X-RAY', 'CT', 'MRI', 'ULTRASOUND', 'OTHER']),
      contentType: z.string().refine((t) => ALLOWED_TYPES.includes(t), { message: 'Unsupported content type' }),
      filename: z.string().max(MAX_FILENAME_LEN),
      bodyPart: z.string().max(100).optional(),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const { url, key, bucket } = await generateUploadPresignedUrl(body.data)

    // Create a pending DB record — confirmed after upload
    const image = await prisma.radiologyImage.create({
      data: {
        patientId: body.data.patientId,
        s3Key: key,
        s3Bucket: bucket,
        modality: body.data.modality,
        bodyPart: body.data.bodyPart,
        uploadedById: request.user.sub,
        metadata: { filename: body.data.filename, contentType: body.data.contentType, status: 'pending' },
      },
    })

    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'RADIOLOGY_UPLOAD_INIT', resourceType: 'RADIOLOGY', resourceId: image.id },
    })

    return reply.send({ data: { uploadUrl: url, imageId: image.id } })
  })

  /** Step 2: client calls this after the direct S3 upload completes */
  app.post('/:id/confirm', async (request, reply) => {
    const { id } = request.params as { id: string }
    const image = await prisma.radiologyImage.update({
      where: { id },
      data: { metadata: { status: 'confirmed' }, uploadedAt: new Date() },
    })
    return reply.send({ data: image })
  })

  /** List images for a patient */
  app.get('/patient/:patientId', async (request, reply) => {
    const { patientId } = request.params as { patientId: string }
    const images = await prisma.radiologyImage.findMany({
      where: { patientId },
      orderBy: { uploadedAt: 'desc' },
    })
    return reply.send({ data: images })
  })

  /** Get a time-limited view URL for an image */
  app.get('/:id/view-url', async (request, reply) => {
    const { id } = request.params as { id: string }
    const image = await prisma.radiologyImage.findUnique({ where: { id } })
    if (!image) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Image not found' })

    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'RADIOLOGY_VIEW', resourceType: 'RADIOLOGY', resourceId: id },
    })

    const viewUrl = await generateViewPresignedUrl(image.s3Key)
    return reply.send({ data: { viewUrl, expiresIn: 3600 } })
  })

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const image = await prisma.radiologyImage.findUniqueOrThrow({ where: { id } })
    await deleteS3Object(image.s3Key)
    await prisma.radiologyImage.delete({ where: { id } })
    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'RADIOLOGY_DELETE', resourceType: 'RADIOLOGY', resourceId: id },
    })
    return reply.status(204).send()
  })
}
