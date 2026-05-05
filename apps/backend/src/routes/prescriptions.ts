import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'
import { buildPrescriptionHtml, buildQrPayload, hashPrescription } from '../services/prescriptions/builder.js'

const drugSchema = z.object({
  name: z.string().min(1).max(200),
  dose: z.string().min(1).max(100),
  route: z.string().max(50),
  frequency: z.string().max(100),
  duration: z.string().max(100),
  instructions: z.string().max(500).optional(),
})

export async function prescriptionRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  app.post('/', async (request, reply) => {
    const body = z.object({
      patientId: z.string().min(1),
      drugs: z.array(drugSchema).min(1).max(20),
      notes: z.string().max(1000).optional(),
      signature: z.string().max(50_000).optional(), // base64 image
    }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const doctor = await prisma.user.findUniqueOrThrow({ where: { id: request.user.sub } })
    const patient = await prisma.patient.findUniqueOrThrow({ where: { id: body.data.patientId } })

    const rx = await prisma.prescription.create({
      data: {
        patientId: body.data.patientId,
        prescribedById: request.user.sub,
        drugs: body.data.drugs,
        notes: body.data.notes,
        signature: body.data.signature,
        hash: '', // filled below
      },
    })

    const hash = hashPrescription({
      id: rx.id, patientMrNumber: patient.mrNumber, doctorName: doctor.name,
      doctorRole: doctor.role, issuedAt: rx.createdAt.toISOString(),
      drugs: body.data.drugs, notes: body.data.notes,
    })

    await prisma.prescription.update({ where: { id: rx.id }, data: { hash } })

    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'PRESCRIPTION_CREATE', resourceType: 'PRESCRIPTION', resourceId: rx.id },
    })

    return reply.status(201).send({ data: { id: rx.id, hash, qrUrl: buildQrPayload(rx.id) } })
  })

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const rx = await prisma.prescription.findUnique({
      where: { id },
      include: { patient: true },
    })
    if (!rx) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Prescription not found' })
    return reply.send({ data: rx })
  })

  /** Render as printable HTML — for browser print / headless PDF */
  app.get('/:id/print', async (request, reply) => {
    const { id } = request.params as { id: string }
    const rx = await prisma.prescription.findUnique({ where: { id }, include: { patient: true } })
    if (!rx || rx.revokedAt) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Prescription not found or revoked' })

    const doctor = await prisma.user.findUniqueOrThrow({ where: { id: rx.prescribedById } })

    const html = buildPrescriptionHtml({
      id: rx.id,
      patientMrNumber: rx.patient.mrNumber,
      doctorName: doctor.name,
      doctorRole: doctor.role,
      issuedAt: rx.createdAt.toISOString(),
      drugs: rx.drugs as Parameters<typeof buildPrescriptionHtml>[0]['drugs'],
      notes: rx.notes ?? undefined,
      signature: rx.signature ?? undefined,
      qrPayload: buildQrPayload(rx.id),
    })

    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'PRESCRIPTION_PRINT', resourceType: 'PRESCRIPTION', resourceId: rx.id },
    })

    reply.header('Content-Type', 'text/html; charset=utf-8')
    return reply.send(html)
  })

  /** QR code scan — verify and mark as dispensed */
  app.post('/:id/verify', async (request, reply) => {
    const { id } = request.params as { id: string }
    const rx = await prisma.prescription.findUnique({ where: { id } })
    if (!rx) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Prescription not found' })
    if (rx.revokedAt) return reply.status(410).send({ statusCode: 410, error: 'Gone', message: 'Prescription has been revoked' })

    await prisma.prescription.update({ where: { id }, data: { verifiedAt: new Date() } })
    return reply.send({ data: { id: rx.id, hash: rx.hash, valid: true, verifiedAt: new Date().toISOString() } })
  })

  /** Revoke a prescription */
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await prisma.prescription.update({ where: { id }, data: { revokedAt: new Date() } })
    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'PRESCRIPTION_REVOKE', resourceType: 'PRESCRIPTION', resourceId: id },
    })
    return reply.send({ message: 'Prescription revoked' })
  })

  app.get('/patient/:patientId', async (request, reply) => {
    const { patientId } = request.params as { patientId: string }
    const rxs = await prisma.prescription.findMany({
      where: { patientId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ data: rxs })
  })
}
