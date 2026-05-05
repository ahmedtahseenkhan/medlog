import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Printer, QrCode } from 'lucide-react'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface DrugRow { name: string; dose: string; route: string; frequency: string; duration: string; instructions: string }
const EMPTY_DRUG: DrugRow = { name: '', dose: '', route: 'PO', frequency: '', duration: '', instructions: '' }
const ROUTES = ['PO', 'IV', 'IM', 'SC', 'SL', 'INH', 'TOP', 'PR', 'NGT', 'OTHER']

interface Props { patientId: string; onClose: () => void }

export function PrescriptionBuilder({ patientId, onClose }: Props) {
  const [drugs, setDrugs] = useState<DrugRow[]>([{ ...EMPTY_DRUG }])
  const [notes, setNotes] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [result, setResult] = useState<{ id: string; qrUrl: string } | null>(null)
  const sigCanvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const qc = useQueryClient()

  const create = useMutation({
    mutationFn: () => api.post<{ data: { id: string; qrUrl: string } }>('/prescriptions', {
      patientId,
      drugs: drugs.filter((d) => d.name.trim()),
      notes: notes || undefined,
      signature: signature ?? undefined,
    }),
    onSuccess: (res) => { setResult(res.data.data); qc.invalidateQueries({ queryKey: ['prescriptions', patientId] }) },
  })

  function updateDrug(i: number, patch: Partial<DrugRow>) {
    setDrugs((prev) => prev.map((d, idx) => idx === i ? { ...d, ...patch } : d))
  }

  // Signature canvas handlers
  function startDraw(e: React.MouseEvent<HTMLCanvasElement>) {
    setDrawing(true)
    const ctx = sigCanvasRef.current?.getContext('2d')
    if (!ctx) return
    const r = sigCanvasRef.current!.getBoundingClientRect()
    ctx.beginPath(); ctx.moveTo(e.clientX - r.left, e.clientY - r.top)
  }
  function draw(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing) return
    const ctx = sigCanvasRef.current?.getContext('2d')
    if (!ctx) return
    const r = sigCanvasRef.current!.getBoundingClientRect()
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top)
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke()
  }
  function endDraw() {
    setDrawing(false)
    setSignature(sigCanvasRef.current?.toDataURL('image/png') ?? null)
  }
  function clearSig() {
    const ctx = sigCanvasRef.current?.getContext('2d')
    ctx?.clearRect(0, 0, 300, 80)
    setSignature(null)
  }

  if (result) {
    const printUrl = `/api/v1/prescriptions/${result.id}/print`
    return (
      <Modal title="Prescription created" onClose={onClose}>
        <div className="space-y-4 text-center">
          <QrCode className="w-12 h-12 text-brand-500 mx-auto" />
          <p className="text-sm text-gray-700">Prescription created successfully.</p>
          <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono text-gray-600 break-all">{result.qrUrl}</div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => window.open(printUrl, '_blank')}>
              <Printer className="w-3.5 h-3.5" /> Print / PDF
            </Button>
            <Button className="flex-1" onClick={onClose}>Done</Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="New prescription" onClose={onClose} size="xl">
      <div className="space-y-4">
        {/* Drug rows */}
        <div className="space-y-2">
          {drugs.map((d, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500">Drug {i + 1}</p>
                {drugs.length > 1 && (
                  <button onClick={() => setDrugs((prev) => prev.filter((_, idx) => idx !== i))} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input value={d.name} onChange={(e) => updateDrug(i, { name: e.target.value })} placeholder="Drug name *" className={`${inputCls} col-span-2`} />
                <input value={d.dose} onChange={(e) => updateDrug(i, { dose: e.target.value })} placeholder="Dose *" className={inputCls} />
                <select value={d.route} onChange={(e) => updateDrug(i, { route: e.target.value })} className={inputCls}>
                  {ROUTES.map((r) => <option key={r}>{r}</option>)}
                </select>
                <input value={d.frequency} onChange={(e) => updateDrug(i, { frequency: e.target.value })} placeholder="Frequency *" className={inputCls} />
                <input value={d.duration} onChange={(e) => updateDrug(i, { duration: e.target.value })} placeholder="Duration *" className={inputCls} />
                <input value={d.instructions} onChange={(e) => updateDrug(i, { instructions: e.target.value })} placeholder="Instructions" className={`${inputCls} col-span-3`} />
              </div>
            </div>
          ))}
          <button onClick={() => setDrugs((p) => [...p, { ...EMPTY_DRUG }])} className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700">
            <Plus className="w-4 h-4" /> Add drug
          </button>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Prescriber notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} w-full resize-none`} placeholder="Additional instructions for pharmacist…" />
        </div>

        {/* E-signature */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-600">Digital signature</label>
            <button onClick={clearSig} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
          </div>
          <canvas
            ref={sigCanvasRef}
            width={460}
            height={80}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            className="w-full border border-gray-200 rounded-lg cursor-crosshair bg-white touch-none"
            style={{ height: 80 }}
          />
          <p className="text-xs text-gray-400 mt-1">Draw your signature above</p>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1"
            loading={create.isPending}
            disabled={!drugs.some((d) => d.name.trim() && d.dose && d.frequency && d.duration)}
            onClick={() => create.mutate()}
          >
            Create prescription
          </Button>
        </div>
      </div>
    </Modal>
  )
}

const inputCls = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white'
