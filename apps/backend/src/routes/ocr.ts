import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'
import { analyseDocument, mapFieldsToLabResults } from '../services/ai/ocr.js'

export async function ocrRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  /**
   * Trigger OCR on a radiology/document image already uploaded to S3.
   * Returns extracted fields for human review before committing.
   */
  app.post('/analyse', async (request, reply) => {
    const body = z.object({
      imageId: z.string(),         // RadiologyImage id — already confirmed in S3
      patientId: z.string().min(1),
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const image = await prisma.radiologyImage.findUnique({ where: { id: body.data.imageId } })
    if (!image) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Image not found' })

    const ocrResult = await analyseDocument(image.s3Bucket, image.s3Key)
    const mappedFields = mapFieldsToLabResults(ocrResult.fields)

    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'OCR_ANALYSE', resourceType: 'RADIOLOGY', resourceId: image.id },
    })

    return reply.send({
      data: {
        rawText: ocrResult.rawText,
        fields: mappedFields,
        overallConfidence: Math.round(ocrResult.overallConfidence),
        needsReview: ocrResult.needsReview,
      },
    })
  })

  /**
   * Human confirms/edits OCR fields and commits them as lab results.
   * This is the "human-review step before commit" (WBS 3.1.3).
   */
  app.post('/commit', async (request, reply) => {
    const labFieldSchema = z.object({
      testName: z.string().min(1),
      value: z.string(),
      unit: z.string(),
      referenceRangeLow: z.number().optional(),
      referenceRangeHigh: z.number().optional(),
    })

    const body = z.object({
      patientId: z.string().min(1),
      confirmedFields: z.array(labFieldSchema),
      reportedAt: z.string().datetime().optional(),
    }).safeParse(request.body)

    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const { patientId, confirmedFields, reportedAt } = body.data
    const ts = reportedAt ?? new Date().toISOString()

    const created = await Promise.all(
      confirmedFields.map(async (field) => {
        const numVal = parseFloat(field.value)
        const isAbnormal =
          !isNaN(numVal) &&
          ((field.referenceRangeLow != null && numVal < field.referenceRangeLow) ||
            (field.referenceRangeHigh != null && numVal > field.referenceRangeHigh))
        const isCritical =
          isAbnormal &&
          ((field.referenceRangeLow != null && numVal < field.referenceRangeLow * 0.5) ||
            (field.referenceRangeHigh != null && numVal > field.referenceRangeHigh * 1.5))

        return prisma.labReport.create({
          data: {
            patientId,
            testName: field.testName,
            value: field.value,
            unit: field.unit,
            referenceRangeLow: field.referenceRangeLow,
            referenceRangeHigh: field.referenceRangeHigh,
            isAbnormal,
            isCritical,
            reportedAt: new Date(ts),
            createdById: request.user.sub,
          },
        })
      })
    )

    await prisma.auditLog.create({
      data: {
        userId: request.user.sub,
        action: 'OCR_COMMIT',
        resourceType: 'LAB',
        resourceId: patientId,
        metadata: { count: created.length },
      },
    })

    return reply.status(201).send({ data: { created: created.length, labs: created } })
  })
}
