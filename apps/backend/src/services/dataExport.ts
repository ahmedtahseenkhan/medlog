import { createCipheriv, randomBytes } from 'crypto'
import { prisma } from '../db/client.js'
import { encrypt } from '../lib/crypto.js'

export interface PatientExportData {
  exportedAt: string
  exportedBy: string
  patient: object
  notes: object[]
  tasks: object[]
  labReports: object[]
  medications: object[]
  auditTrail: object[]
}

/** Compiles all records for a patient into a structured export object */
export async function compilePatientExport(patientId: string, requestedBy: string): Promise<PatientExportData> {
  const [patient, notes, tasks, labs, meds, auditTrail] = await Promise.all([
    prisma.patient.findUniqueOrThrow({ where: { id: patientId }, include: { ward: true } }),
    prisma.clinicalNote.findMany({ where: { patientId }, orderBy: { createdAt: 'asc' } }),
    prisma.task.findMany({ where: { patientId }, orderBy: { createdAt: 'asc' } }),
    prisma.labReport.findMany({ where: { patientId }, orderBy: { reportedAt: 'asc' } }),
    prisma.medicationLog.findMany({ where: { patientId }, orderBy: { startDate: 'asc' } }),
    prisma.auditLog.findMany({ where: { resourceId: patientId }, orderBy: { createdAt: 'asc' }, take: 1000 }),
  ])

  await prisma.auditLog.create({
    data: { userId: requestedBy, action: 'DATA_EXPORT', resourceType: 'PATIENT', resourceId: patientId },
  })

  return {
    exportedAt: new Date().toISOString(),
    exportedBy: requestedBy,
    patient,
    notes,
    tasks,
    labReports: labs,
    medications: meds,
    auditTrail,
  }
}

/** Returns the export as an AES-256-GCM encrypted JSON string */
export function encryptExport(data: PatientExportData): { payload: string; keyHint: string } {
  const json = JSON.stringify(data, null, 2)
  const payload = encrypt(json)
  // keyHint helps the recipient know which key to use (last 6 chars of encryption key)
  const keyHint = (process.env.ENCRYPTION_KEY ?? '').slice(-6)
  return { payload, keyHint }
}

/** Builds a minimal plain-text "PDF-ready" report (HTML string — render with headless browser in prod) */
export function buildHtmlReport(data: PatientExportData): string {
  const p = data.patient as Record<string, unknown>
  const noteRows = (data.notes as Record<string, unknown>[]).map((n) => {
    const c = (n.content as Record<string, string>) ?? {}
    const text = c.freeText ?? [c.subjective, c.objective, c.assessment, c.plan].filter(Boolean).join(' | ')
    return `<tr><td>${new Date(n.createdAt as string).toLocaleDateString()}</td><td>${n.type}</td><td>${escHtml(text.slice(0, 300))}</td></tr>`
  }).join('')

  const labRows = (data.labReports as Record<string, unknown>[]).map((l) =>
    `<tr><td>${l.testName}</td><td>${l.value} ${l.unit}</td><td>${l.isAbnormal ? '<b style="color:red">ABNORMAL</b>' : 'Normal'}</td><td>${new Date(l.reportedAt as string).toLocaleDateString()}</td></tr>`
  ).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Patient Export MR# ${p.mrNumber}</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;margin:32px}h1{font-size:16px}h2{font-size:13px;margin-top:24px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #ccc;padding:4px 8px;text-align:left}th{background:#f5f5f5}.disclaimer{background:#fff3cd;border:1px solid #ffc107;padding:8px;margin-bottom:16px;font-size:11px}</style>
</head>
<body>
<div class="disclaimer">⚠ This document contains confidential patient information. Handle in accordance with your organisation's data protection policy.</div>
<h1>Patient Record Export</h1>
<p><strong>MR#:</strong> ${p.mrNumber} &nbsp; <strong>Status:</strong> ${p.status} &nbsp; <strong>Exported:</strong> ${new Date(data.exportedAt).toLocaleString()}</p>
${p.admissionDiagnosis ? `<p><strong>Admission diagnosis:</strong> ${escHtml(p.admissionDiagnosis as string)}</p>` : ''}

<h2>Clinical Notes (${data.notes.length})</h2>
<table><tr><th>Date</th><th>Type</th><th>Content</th></tr>${noteRows || '<tr><td colspan="3">None</td></tr>'}</table>

<h2>Laboratory Results (${data.labReports.length})</h2>
<table><tr><th>Test</th><th>Result</th><th>Flag</th><th>Date</th></tr>${labRows || '<tr><td colspan="4">None</td></tr>'}</table>
</body></html>`
}

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
