import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'
import { generateUploadPresignedUrl } from '../services/s3.js'
import { startTranscriptionJob, getTranscriptionResult } from '../services/ai/transcribe.js'

export async function voiceRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  /** Step 1: get a presigned URL to upload the audio recording */
  app.post('/upload-url', async (request, reply) => {
    const body = z.object({ patientId: z.string().min(1) }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const { url, key, bucket } = await generateUploadPresignedUrl({
      patientId: body.data.patientId,
      modality: 'AUDIO',
      contentType: 'audio/m4a',
      filename: `voice-${Date.now()}.m4a`,
    })

    return reply.send({ data: { uploadUrl: url, s3Key: key, s3Bucket: bucket } })
  })

  /** Step 2: trigger transcription after audio is in S3 */
  app.post('/transcribe', async (request, reply) => {
    const body = z.object({
      s3Key: z.string(),
      s3Bucket: z.string(),
      patientId: z.string().min(1),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const jobName = await startTranscriptionJob(body.data.s3Key, body.data.s3Bucket)

    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'VOICE_TRANSCRIBE_START', resourceType: 'PATIENT', resourceId: body.data.patientId },
    })

    return reply.send({ data: { jobName, status: 'IN_PROGRESS' } })
  })

  /** Step 3: poll for result (mobile polls this after ~10s) */
  app.get('/result/:jobName', async (request, reply) => {
    const { jobName } = request.params as { jobName: string }
    const result = await getTranscriptionResult(jobName, 5000) // short poll, 5s timeout
    return reply.send({ data: result })
  })

  /** Step 4: save transcript as a clinical note (draft) */
  app.post('/save', async (request, reply) => {
    const body = z.object({
      patientId: z.string().min(1),
      transcript: z.string().min(1),
      noteType: z.enum(['SOAP', 'FREE_TEXT']).default('FREE_TEXT'),
      soapField: z.enum(['subjective', 'objective', 'assessment', 'plan']).optional(),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const { patientId, transcript, noteType, soapField } = body.data
    const content = noteType === 'SOAP' && soapField
      ? { [soapField]: transcript }
      : { freeText: transcript }

    const note = await prisma.clinicalNote.create({
      data: { patientId, type: noteType, content, isDraft: true, authorId: request.user.sub },
    })

    return reply.status(201).send({ data: note })
  })
}
