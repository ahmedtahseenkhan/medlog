import { prisma } from '../../db/client.js'
import { parseHl7, component, type ParsedHl7 } from './parser.js'

export interface Hl7ProcessResult {
  messageType: string
  action: 'created' | 'updated' | 'ignored'
  resourceType?: string
  resourceId?: string
  error?: string
}

/**
 * Routes an HL7 v2 message to the appropriate handler.
 * Supported:
 *   ADT^A01 — Patient admission
 *   ADT^A03 — Patient discharge
 *   ADT^A08 — Patient update
 *   ORU^R01 — Lab results
 */
export async function processHl7Message(raw: string, importedBy: string): Promise<Hl7ProcessResult> {
  const msg = parseHl7(raw)
  const type = msg.type.toUpperCase()

  try {
    if (type.startsWith('ADT^A01')) return await handleAdmission(msg, importedBy)
    if (type.startsWith('ADT^A03')) return await handleDischarge(msg, importedBy)
    if (type.startsWith('ADT^A08')) return await handlePatientUpdate(msg, importedBy)
    if (type.startsWith('ORU^R01')) return await handleLabResult(msg, importedBy)

    return { messageType: type, action: 'ignored' }
  } catch (err) {
    return { messageType: type, action: 'ignored', error: String(err) }
  }
}

// ── ADT^A01 — Admission ───────────────────────────────────────────────────────

async function handleAdmission(msg: ParsedHl7, importedBy: string): Promise<Hl7ProcessResult> {
  const pid = msg.segments.get('PID')?.[0]
  const pv1 = msg.segments.get('PV1')?.[0]
  if (!pid) return { messageType: msg.type, action: 'ignored', error: 'Missing PID segment' }

  const mrNumber = pid.fields[3]?.split('^')[0] ?? pid.fields[2] ?? ''
  if (!mrNumber) return { messageType: msg.type, action: 'ignored', error: 'No MR number in PID-3' }

  // PV1-3: assigned patient location (ward^room^bed)
  const wardCode = component(pv1?.fields[3] ?? '', 0)
  const bedNumber = component(pv1?.fields[3] ?? '', 2)
  const admitDate = parseHl7Date(pv1?.fields[44])

  // DG1 segment: admission diagnosis
  const dg1 = msg.segments.get('DG1')?.[0]
  const diagnosis = dg1 ? component(dg1.fields[3], 1) || component(dg1.fields[3], 0) : undefined

  // Find or create ward
  let wardId: string | undefined
  if (wardCode) {
    const ward = await prisma.ward.findFirst({ where: { code: wardCode } })
    wardId = ward?.id
  }

  const patient = await prisma.patient.upsert({
    where: { mrNumber },
    update: { status: 'ADMITTED', wardId: wardId ?? null, bedNumber: bedNumber || null, admissionDate: admitDate, admissionDiagnosis: diagnosis },
    create: {
      mrNumber,
      status: 'ADMITTED',
      wardId: wardId ?? null,
      bedNumber: bedNumber || null,
      admissionDate: admitDate,
      admissionDiagnosis: diagnosis,
      createdById: importedBy,
    },
  })

  await prisma.auditLog.create({
    data: { userId: importedBy, action: 'HL7_ADT_ADMIT', resourceType: 'PATIENT', resourceId: patient.id },
  })

  return { messageType: msg.type, action: 'created', resourceType: 'Patient', resourceId: patient.id }
}

// ── ADT^A03 — Discharge ───────────────────────────────────────────────────────

async function handleDischarge(msg: ParsedHl7, importedBy: string): Promise<Hl7ProcessResult> {
  const pid = msg.segments.get('PID')?.[0]
  const mrNumber = pid?.fields[3]?.split('^')[0] ?? ''
  if (!mrNumber) return { messageType: msg.type, action: 'ignored' }

  const pv1 = msg.segments.get('PV1')?.[0]
  const dischargeDate = parseHl7Date(pv1?.fields[45])

  const patient = await prisma.patient.findFirst({ where: { mrNumber } })
  if (!patient) return { messageType: msg.type, action: 'ignored' }

  await prisma.patient.update({
    where: { id: patient.id },
    data: { status: 'DISCHARGED', dischargeDate },
  })

  return { messageType: msg.type, action: 'updated', resourceType: 'Patient', resourceId: patient.id }
}

// ── ADT^A08 — Update ─────────────────────────────────────────────────────────

async function handlePatientUpdate(msg: ParsedHl7, importedBy: string): Promise<Hl7ProcessResult> {
  const pid = msg.segments.get('PID')?.[0]
  const mrNumber = pid?.fields[3]?.split('^')[0] ?? ''
  if (!mrNumber) return { messageType: msg.type, action: 'ignored' }

  const pv1 = msg.segments.get('PV1')?.[0]
  const wardCode = component(pv1?.fields[3] ?? '', 0)
  const bedNumber = component(pv1?.fields[3] ?? '', 2)

  let wardId: string | undefined
  if (wardCode) {
    const ward = await prisma.ward.findFirst({ where: { code: wardCode } })
    wardId = ward?.id
  }

  const patient = await prisma.patient.findFirst({ where: { mrNumber } })
  if (!patient) return handleAdmission(msg, importedBy)

  await prisma.patient.update({
    where: { id: patient.id },
    data: { wardId: wardId ?? undefined, bedNumber: bedNumber || undefined },
  })

  return { messageType: msg.type, action: 'updated', resourceType: 'Patient', resourceId: patient.id }
}

// ── ORU^R01 — Lab Results ─────────────────────────────────────────────────────

async function handleLabResult(msg: ParsedHl7, importedBy: string): Promise<Hl7ProcessResult> {
  const pid = msg.segments.get('PID')?.[0]
  const mrNumber = pid?.fields[3]?.split('^')[0] ?? ''
  if (!mrNumber) return { messageType: msg.type, action: 'ignored', error: 'No MR number' }

  const patient = await prisma.patient.findFirst({ where: { mrNumber } })
  if (!patient) return { messageType: msg.type, action: 'ignored', error: `Patient ${mrNumber} not found` }

  const obxSegments = msg.segments.get('OBX') ?? []
  const created: string[] = []

  for (const obx of obxSegments) {
    // OBX-3: observation identifier, OBX-5: value, OBX-6: units
    // OBX-7: reference range (e.g. "3.5-5.0"), OBX-8: abnormal flag
    const testName = component(obx.fields[3], 1) || component(obx.fields[3], 0)
    const value = obx.fields[5] ?? ''
    const unit = component(obx.fields[6], 0)
    const refRange = obx.fields[7] ?? ''
    const abnormalFlag = obx.fields[8]?.toUpperCase()
    const observationDate = parseHl7Date(obx.fields[14]) ?? new Date()

    if (!testName || !value) continue

    const [refLow, refHigh] = parseRefRange(refRange)
    const isAbnormal = ['A', 'AA', 'H', 'HH', 'L', 'LL'].includes(abnormalFlag ?? '')
    const isCritical = ['AA', 'HH', 'LL'].includes(abnormalFlag ?? '')

    const lab = await prisma.labReport.create({
      data: {
        patientId: patient.id,
        testName,
        value,
        unit,
        referenceRangeLow: refLow,
        referenceRangeHigh: refHigh,
        isAbnormal,
        isCritical,
        reportedAt: observationDate,
        createdById: importedBy,
      },
    })
    created.push(lab.id)
  }

  await prisma.auditLog.create({
    data: { userId: importedBy, action: 'HL7_ORU_IMPORT', resourceType: 'PATIENT', resourceId: patient.id, metadata: { count: created.length } },
  })

  return { messageType: msg.type, action: 'created', resourceType: 'LabReport', resourceId: patient.id }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseHl7Date(raw?: string): Date | undefined {
  if (!raw) return undefined
  const s = raw.replace(/\D/g, '')
  if (s.length < 8) return undefined
  const y = s.slice(0, 4); const m = s.slice(4, 6); const d = s.slice(6, 8)
  return new Date(`${y}-${m}-${d}T${s.slice(8, 10) || '00'}:${s.slice(10, 12) || '00'}:00Z`)
}

function parseRefRange(range: string): [number | undefined, number | undefined] {
  const match = range.match(/^([\d.]+)?[-–]([\d.]+)?$/)
  if (!match) return [undefined, undefined]
  return [match[1] ? parseFloat(match[1]) : undefined, match[2] ? parseFloat(match[2]) : undefined]
}
