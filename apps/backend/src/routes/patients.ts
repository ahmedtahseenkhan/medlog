import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'
import { pushDischargeToHis } from '../services/fhir/hisSync.js'

const createPatientSchema = z.object({
  mrNumber: z.string().min(1).max(50),
  wardName: z.string().max(100).optional(),
  wardId: z.string().min(1).optional(),
  bedNumber: z.string().max(10).optional(),
  admissionDate: z.string().datetime().optional(),
  admissionDiagnosis: z.string().max(500).optional(),
})

export async function patientRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  app.get('/', async (request, reply) => {
    const { page = 1, pageSize = 20, wardId, status } = request.query as Record<string, string>

    // Scope: team members see all team patients; solo doctors see only their own
    const ownershipFilter = request.user.teamId
      ? { teamId: request.user.teamId }
      : { createdById: request.user.sub }

    const where = {
      ...ownershipFilter,
      ...(wardId ? { wardId } : {}),
      ...(status ? { status: status as any } : {}),
    }
    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        orderBy: { createdAt: 'desc' },
        include: { ward: true },
      }),
      prisma.patient.count({ where }),
    ])
    return reply.send({ data: patients, meta: { total, page: Number(page), pageSize: Number(pageSize) } })
  })

  app.post('/', async (request, reply) => {
    const body = createPatientSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const existing = await prisma.patient.findFirst({ where: { mrNumber: body.data.mrNumber } })
    if (existing) return reply.status(409).send({ statusCode: 409, error: 'Conflict', message: 'MR# already exists' })

    const patient = await prisma.patient.create({
      data: {
        ...body.data,
        status: 'ADMITTED',
        createdById: request.user.sub,
        teamId: request.user.teamId ?? null,
      },
    })

    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'PATIENT_CREATE', resourceId: patient.id, resourceType: 'PATIENT' },
    })

    return reply.status(201).send({ data: patient })
  })

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: { ward: true, notes: { orderBy: { createdAt: 'desc' }, take: 10 }, tasks: { where: { status: { not: 'DONE' } } } },
    })
    if (!patient) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Patient not found' })

    // Access control: must belong to same team or be the creator
    const canAccess = request.user.teamId
      ? patient.teamId === request.user.teamId
      : patient.createdById === request.user.sub
    if (!canAccess) return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Access denied' })

    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'PATIENT_VIEW', resourceId: patient.id, resourceType: 'PATIENT' },
    })

    return reply.send({ data: patient })
  })

  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const patchSchema = createPatientSchema.partial().omit({ wardId: true }).extend({
      status: z.enum(['ADMITTED', 'DISCHARGED', 'ARCHIVED']).optional(),
      contactPrefs: z.object({
        channel: z.enum(['sms', 'push', 'email', 'whatsapp']),
        notes: z.string().max(500).optional(),
      }).optional(),
    })
    const body = patchSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const patient = await prisma.patient.update({ where: { id }, data: body.data })
    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'PATIENT_UPDATE', resourceId: patient.id, resourceType: 'PATIENT' },
    })

    return reply.send({ data: patient })
  })

  app.post('/:id/discharge', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = z.object({ dischargeSummary: z.string().optional() }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: body.error.message })

    const patient = await prisma.patient.update({
      where: { id },
      data: { status: 'DISCHARGED', dischargeDate: new Date().toISOString(), ...body.data },
    })

    await prisma.auditLog.create({
      data: { userId: request.user.sub, action: 'PATIENT_DISCHARGE', resourceId: patient.id, resourceType: 'PATIENT' },
    })

    // Fire-and-forget HIS sync — don't block the response
    pushDischargeToHis(patient.id).catch((err) => app.log.warn({ err }, 'HIS sync failed'))

    return reply.send({ data: patient })
  })
}
