import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Check, X, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Badge } from '../ui/Badge'
import type { ApiResponse } from '@medlog/types'

interface Medication {
  id: string
  drugName: string
  dose: string
  route: string
  frequency: string
  startDate: string
  endDate?: string
  isPrn: boolean
  administeredAt?: string
  missedAt?: string
}

const ROUTES = ['PO', 'IV', 'IM', 'SC', 'SL', 'INH', 'TOP', 'PR', 'NGT', 'OTHER']

export function MedicationLog({ patientId }: { patientId: string }) {
  const [showAdd, setShowAdd] = useState(false)
  const [viewTrend, setViewTrend] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['medications', patientId],
    queryFn: () => api.get<ApiResponse<Medication[]>>(`/medications/patient/${patientId}`).then((r) => r.data),
  })

  const administer = useMutation({
    mutationFn: (id: string) => api.post(`/medications/${id}/administer`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['medications', patientId] }),
  })
  const miss = useMutation({
    mutationFn: (id: string) => api.post(`/medications/${id}/miss`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['medications', patientId] }),
  })

  const meds = data?.data ?? []
  const active = meds.filter((m) => !m.endDate || new Date(m.endDate) > new Date())
  const stopped = meds.filter((m) => m.endDate && new Date(m.endDate) <= new Date())

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Medications</h3>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="w-3.5 h-3.5" /> Add
        </Button>
      </div>

      {meds.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-8 text-center text-sm text-gray-400">No medications logged</div>
      ) : (
        <div className="space-y-2">
          {active.map((med) => (
            <MedRow key={med.id} med={med} onAdminister={() => administer.mutate(med.id)} onMiss={() => miss.mutate(med.id)} />
          ))}
          {stopped.length > 0 && (
            <details className="cursor-pointer">
              <summary className="text-xs text-gray-400 py-1 select-none">Stopped medications ({stopped.length})</summary>
              <div className="space-y-2 mt-2">
                {stopped.map((med) => <MedRow key={med.id} med={med} stopped />)}
              </div>
            </details>
          )}
        </div>
      )}

      {showAdd && (
        <AddMedModal
          patientId={patientId}
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); qc.invalidateQueries({ queryKey: ['medications', patientId] }) }}
        />
      )}
    </div>
  )
}

function MedRow({ med, onAdminister, onMiss, stopped }: {
  med: Medication
  onAdminister?: () => void
  onMiss?: () => void
  stopped?: boolean
}) {
  const wasMissed = !!med.missedAt
  const wasGiven = !!med.administeredAt

  return (
    <div className={`bg-white rounded-xl border px-4 py-3 ${stopped ? 'opacity-60 border-dashed border-gray-200' : wasMissed ? 'border-amber-200' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900">{med.drugName}</span>
            <span className="text-sm text-gray-600">{med.dose}</span>
            <Badge variant="gray">{med.route}</Badge>
            {med.isPrn && <Badge variant="purple">PRN</Badge>}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{med.frequency} · Started {format(new Date(med.startDate), 'dd MMM yyyy')}</p>
          {wasMissed && <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Missed {format(new Date(med.missedAt!), 'dd MMM HH:mm')}</p>}
          {wasGiven && <p className="text-xs text-brand-600 mt-0.5">✓ Given {format(new Date(med.administeredAt!), 'dd MMM HH:mm')}</p>}
        </div>
        {!stopped && (
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={onAdminister} title="Mark as given" className="p-1.5 rounded-lg hover:bg-brand-50 text-brand-600 transition-colors">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={onMiss} title="Mark as missed" className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function AddMedModal({ patientId, onClose, onSuccess }: { patientId: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ drugName: '', dose: '', route: 'PO', frequency: '', isPrn: false })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.post('/medications', {
      ...form,
      patientId,
      startDate: new Date().toISOString(),
    }),
    onSuccess,
    onError: (e: { response?: { data?: { message?: string } } }) => setError(e.response?.data?.message ?? 'Failed'),
  })

  return (
    <Modal title="Add medication" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Drug name *">
          <input value={form.drugName} onChange={(e) => setForm((f) => ({ ...f, drugName: e.target.value }))} className={inputCls} placeholder="e.g. Amoxicillin" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dose *">
            <input value={form.dose} onChange={(e) => setForm((f) => ({ ...f, dose: e.target.value }))} className={inputCls} placeholder="e.g. 500mg" />
          </Field>
          <Field label="Route">
            <select value={form.route} onChange={(e) => setForm((f) => ({ ...f, route: e.target.value }))} className={inputCls}>
              {ROUTES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Frequency *">
          <input value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))} className={inputCls} placeholder="e.g. TDS, BD, QDS" />
        </Field>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={form.isPrn} onChange={(e) => setForm((f) => ({ ...f, isPrn: e.target.checked }))} className="rounded" />
          PRN (as needed)
        </label>
        {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" loading={mutation.isPending} disabled={!form.drugName || !form.dose || !form.frequency} onClick={() => mutation.mutate()}>Add</Button>
        </div>
      </div>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>{children}</div>
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
