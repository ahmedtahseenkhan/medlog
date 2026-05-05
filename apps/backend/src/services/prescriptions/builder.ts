import { createHash } from 'crypto'

export interface PrescriptionData {
  id: string
  patientMrNumber: string
  doctorName: string
  doctorRole: string
  issuedAt: string
  drugs: {
    name: string
    dose: string
    route: string
    frequency: string
    duration: string
    instructions?: string
  }[]
  notes?: string
  signature?: string   // base64 SVG or PNG data URL
  qrPayload: string    // the URL the QR encodes
}

/**
 * Generates a printable HTML prescription.
 * In production pass this to Puppeteer / WeasyPrint for actual PDF generation.
 */
export function buildPrescriptionHtml(rx: PrescriptionData): string {
  const drugRows = rx.drugs.map((d) => `
    <tr>
      <td class="drug-name"><strong>${esc(d.name)}</strong></td>
      <td>${esc(d.dose)}</td>
      <td>${esc(d.route)}</td>
      <td>${esc(d.frequency)}</td>
      <td>${esc(d.duration)}</td>
      <td>${esc(d.instructions ?? '—')}</td>
    </tr>`).join('')

  const qrImg = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(rx.qrPayload)}" alt="QR" width="120" height="120" />`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Prescription ${rx.id}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 32px; color: #111; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1D9E75; padding-bottom: 12px; margin-bottom: 16px; }
  .logo { font-size: 18px; font-weight: 700; color: #1D9E75; }
  .meta { font-size: 11px; color: #555; }
  h2 { font-size: 13px; margin: 16px 0 8px; color: #333; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #f5f5f5; font-size: 11px; font-weight: 600; }
  .drug-name { min-width: 120px; }
  .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 24px; border-top: 1px solid #ddd; padding-top: 12px; }
  .sig-block { text-align: right; }
  .sig-img { max-height: 60px; display: block; margin-bottom: 4px; }
  .disclaimer { background: #fff8e1; border: 1px solid #ffc107; padding: 8px; font-size: 10px; margin-top: 16px; }
  .rx-id { font-size: 10px; color: #999; font-family: monospace; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">MedLog AI — Prescription</div>
    <div class="meta">MR# ${esc(rx.patientMrNumber)} &nbsp;·&nbsp; Issued: ${new Date(rx.issuedAt).toLocaleString()}</div>
    <div class="rx-id">Rx ID: ${esc(rx.id)}</div>
  </div>
  <div>${qrImg}</div>
</div>

<h2>Prescribed medications</h2>
<table>
  <thead>
    <tr><th>Drug</th><th>Dose</th><th>Route</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr>
  </thead>
  <tbody>${drugRows}</tbody>
</table>

${rx.notes ? `<h2>Notes</h2><p>${esc(rx.notes)}</p>` : ''}

<div class="footer">
  <div class="meta">
    <strong>${esc(rx.doctorName)}</strong><br />
    ${esc(rx.doctorRole)}
  </div>
  <div class="sig-block">
    ${rx.signature ? `<img src="${rx.signature}" class="sig-img" alt="Signature" />` : '<p style="color:#aaa;font-size:11px">[e-signature pending]</p>'}
    <div class="meta">Authorised prescriber</div>
  </div>
</div>

<div class="disclaimer">
  ⚕ This prescription is valid only when issued by a licensed clinician.
  Verify the QR code at ${esc(rx.qrPayload)} before dispensing.
</div>
</body>
</html>`
}

/** Generates a verification URL for the QR code */
export function buildQrPayload(prescriptionId: string): string {
  const base = process.env.APP_URL ?? 'https://app.medlog.ai'
  return `${base}/rx/${prescriptionId}`
}

/** Generates a tamper-evident hash of the prescription data */
export function hashPrescription(rx: Omit<PrescriptionData, 'qrPayload' | 'signature'>): string {
  const payload = JSON.stringify({ id: rx.id, drugs: rx.drugs, issuedAt: rx.issuedAt, doctor: rx.doctorName })
  return createHash('sha256').update(payload + (process.env.ENCRYPTION_KEY ?? '')).digest('hex').slice(0, 16)
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
