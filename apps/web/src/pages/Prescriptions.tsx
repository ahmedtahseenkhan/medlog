import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Printer, CheckCircle, XCircle, FileText } from 'lucide-react'
import { api } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Drug {
  name: string
  dose: string
  route: string
  frequency: string
  duration: string
  instructions?: string
}

interface Prescription {
  id: string
  patientId: string
  drugs: Drug[]
  notes?: string
  hash: string
  qrUrl?: string
  createdAt: string
  revokedAt?: string
  verifiedAt?: string
}

interface Patient {
  id: string
  mrNumber: string
  admissionDiagnosis?: string
}

interface IssuedResult {
  id: string
  hash: string
  qrUrl: string
}

const ROUTES = ['Oral', 'IV', 'IM', 'SC', 'Inhaled', 'PR', 'SL']
const FREQUENCIES = ['OD', 'BD', 'TDS', 'QDS', 'Stat', 'PRN', 'Nocte']

function emptyDrug(): Drug {
  return { name: '', dose: '', route: 'Oral', frequency: 'OD', duration: '', instructions: '' }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function drugSummary(drugs: Drug[]): string {
  if (!drugs || drugs.length === 0) return '—'
  const first = drugs[0]?.name ?? '—'
  return drugs.length > 1 ? `${first} +${drugs.length - 1} more` : first
}

function rxStatus(rx: Prescription): 'Active' | 'Dispensed' | 'Revoked' {
  if (rx.revokedAt) return 'Revoked'
  if (rx.verifiedAt) return 'Dispensed'
  return 'Active'
}

function StatusBadge({ status }: { status: 'Active' | 'Dispensed' | 'Revoked' }) {
  const cls =
    status === 'Active'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'Dispensed'
      ? 'bg-blue-50 text-blue-700'
      : 'bg-red-50 text-red-500 line-through'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{status}</span>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PrescriptionsPage() {
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [issuedResult, setIssuedResult] = useState<IssuedResult | null>(null)
  const qc = useQueryClient()

  const { data: rxList = [], isLoading } = useQuery<Prescription[]>({
    queryKey: ['prescriptions-all'],
    queryFn: async () => {
      // Fetch recent prescriptions — backend returns all when no patientId given,
      // we use the patient-scoped endpoint per patient. For the index view we
      // load all by hitting the search-patients endpoint and collecting results,
      // but a simpler approach is to expose just per-patient lookup.
      // Since the backend doesn't have a "list all" endpoint we return [] and
      // users filter by MR# which triggers a patient-scoped fetch.
      return []
    },
    enabled: false, // disabled — we use per-patient fetch triggered by search
  })

  const { data: searchedRx = [], isLoading: searchLoading } = useQuery<Prescription[]>({
    queryKey: ['prescriptions-search', search],
    enabled: search.trim().length >= 2,
    staleTime: 0,
    queryFn: async () => {
      // Look up patient by MR# first
      const pRes = await api.get<{ data: Patient[] }>(`/patients?search=${encodeURIComponent(search)}`)
      const patients: Patient[] = pRes.data.data ?? []
      if (patients.length === 0) return []
      // Fetch prescriptions for all matched patients
      const nested = await Promise.all(
        patients.map((p) =>
          api
            .get<{ data: Prescription[] }>(`/prescriptions/patient/${p.id}`)
            .then((r) => (r.data.data ?? []).map((rx) => ({ ...rx, _mrNumber: p.mrNumber })))
            .catch(() => [] as (Prescription & { _mrNumber: string })[])
        )
      )
      return nested.flat()
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/prescriptions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prescriptions-search'] }),
  })

  const verifyMutation = useMutation({
    mutationFn: (id: string) => api.post(`/prescriptions/${id}/verify`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prescriptions-search'] }),
  })

  const displayList: (Prescription & { _mrNumber?: string })[] =
    search.trim().length >= 2 ? searchedRx as any : []

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-500" />
            Prescriptions
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">E-prescribing &amp; dispensing</p>
        </div>
        <button
          onClick={() => { setIssuedResult(null); setShowModal(true) }}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Prescription
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by patient MR# (min 2 chars)…"
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {search.trim().length < 2 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            Enter a patient MR# to view prescriptions
          </div>
        ) : searchLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Searching…</div>
        ) : displayList.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No prescriptions found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-medium">MR#</th>
                <th className="px-5 py-3 text-left font-medium">Drugs</th>
                <th className="px-5 py-3 text-left font-medium">Date</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayList.map((rx) => {
                const status = rxStatus(rx)
                const parsedDrugs: Drug[] =
                  typeof rx.drugs === 'string' ? JSON.parse(rx.drugs) : rx.drugs ?? []
                return (
                  <tr key={rx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-900">
                      {(rx as any)._mrNumber ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 text-gray-700">{drugSummary(parsedDrugs)}</td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {new Date(rx.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => window.open(`/api/v1/prescriptions/${rx.id}/print`, '_blank')}
                          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                          title="Print"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {status === 'Active' && (
                          <>
                            <button
                              onClick={() => verifyMutation.mutate(rx.id)}
                              disabled={verifyMutation.isPending}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Dispense
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Revoke this prescription?')) revokeMutation.mutate(rx.id)
                              }}
                              disabled={revokeMutation.isPending}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Revoke
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <NewPrescriptionModal
          onClose={() => setShowModal(false)}
          onSuccess={(result) => {
            setIssuedResult(result)
            qc.invalidateQueries({ queryKey: ['prescriptions-search'] })
          }}
          issuedResult={issuedResult}
        />
      )}
    </div>
  )
}

// ── New Prescription Modal ────────────────────────────────────────────────────

function NewPrescriptionModal({
  onClose,
  onSuccess,
  issuedResult,
}: {
  onClose: () => void
  onSuccess: (r: IssuedResult) => void
  issuedResult: IssuedResult | null
}) {
  const [patientSearch, setPatientSearch] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [drugs, setDrugs] = useState<Drug[]>([emptyDrug()])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const { data: patientResults = [], isFetching: patientFetching } = useQuery<Patient[]>({
    queryKey: ['patient-search', patientSearch],
    enabled: patientSearch.trim().length >= 2 && !selectedPatient,
    staleTime: 0,
    queryFn: async () => {
      const r = await api.get<{ data: Patient[] }>(`/patients?search=${encodeURIComponent(patientSearch)}`)
      return r.data.data ?? []
    },
  })

  const issueMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        patientId: selectedPatient!.id,
        drugs: drugs.map(({ instructions, ...d }) =>
          instructions?.trim() ? { ...d, instructions } : d
        ),
        notes: notes.trim() || undefined,
      }
      const res = await api.post<{ data: IssuedResult }>('/prescriptions', payload)
      return res.data.data
    },
    onSuccess: (data) => onSuccess(data),
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Failed to issue prescription'),
  })

  function updateDrug(idx: number, field: keyof Drug, value: string) {
    setDrugs((prev) => prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d)))
  }

  function removeDrug(idx: number) {
    setDrugs((prev) => prev.filter((_, i) => i !== idx))
  }

  const canIssue =
    !!selectedPatient &&
    drugs.every((d) => d.name.trim() && d.dose.trim() && d.duration.trim())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">New Prescription</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {issuedResult ? (
          /* ── Success view ── */
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Prescription Issued</h3>
            <p className="text-sm text-gray-500 text-center">
              Prescription ID: <span className="font-mono text-gray-700">{issuedResult.id}</span>
            </p>
            <div className="bg-gray-50 rounded-xl p-4 flex flex-col items-center gap-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Verification QR</p>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${issuedResult.hash}`}
                alt="Prescription QR Code"
                className="rounded-lg border border-gray-200"
              />
              <p className="text-xs text-gray-400 font-mono">{issuedResult.hash}</p>
            </div>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => window.open(`/api/v1/prescriptions/${issuedResult.id}/print`, '_blank')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* ── Form view ── */
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Patient Picker */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Patient
              </label>
              {selectedPatient ? (
                <div className="flex items-center justify-between px-3 py-2.5 bg-brand-50 border border-brand-200 rounded-lg">
                  <span className="text-sm font-medium text-brand-700">MR# {selectedPatient.mrNumber}</span>
                  <button
                    onClick={() => { setSelectedPatient(null); setPatientSearch('') }}
                    className="text-xs text-brand-500 hover:text-brand-700"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Search patient MR#…"
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  {patientSearch.trim().length >= 2 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                      {patientFetching ? (
                        <div className="px-4 py-3 text-sm text-gray-400">Searching…</div>
                      ) : patientResults.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-400">No patients found</div>
                      ) : (
                        patientResults.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setSelectedPatient(p)}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                          >
                            <span className="font-medium text-gray-900">MR# {p.mrNumber}</span>
                            {p.admissionDiagnosis && (
                              <span className="text-gray-500 ml-2">— {p.admissionDiagnosis}</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Drug Rows */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Drugs
              </label>
              <div className="space-y-3">
                {drugs.map((drug, idx) => (
                  <DrugRow
                    key={idx}
                    drug={drug}
                    index={idx}
                    onChange={updateDrug}
                    onRemove={drugs.length > 1 ? () => removeDrug(idx) : undefined}
                  />
                ))}
              </div>
              <button
                onClick={() => setDrugs((prev) => [...prev, emptyDrug()])}
                className="mt-3 flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Drug
              </button>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Prescriber notes…"
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
          </div>
        )}

        {/* Footer */}
        {!issuedResult && (
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => issueMutation.mutate()}
              disabled={!canIssue || issueMutation.isPending}
              className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {issueMutation.isPending ? 'Issuing…' : 'Issue Prescription'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Drug Row ──────────────────────────────────────────────────────────────────

function DrugRow({
  drug,
  index,
  onChange,
  onRemove,
}: {
  drug: Drug
  index: number
  onChange: (idx: number, field: keyof Drug, value: string) => void
  onRemove?: () => void
}) {
  const inputCls =
    'w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-brand-500'
  const selectCls =
    'w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white'

  return (
    <div className="bg-gray-50 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Drug {index + 1}
        </span>
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            Remove
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <input
            value={drug.name}
            onChange={(e) => onChange(index, 'name', e.target.value)}
            placeholder="Drug name *"
            className={inputCls}
          />
        </div>
        <input
          value={drug.dose}
          onChange={(e) => onChange(index, 'dose', e.target.value)}
          placeholder="Dose e.g. 500mg *"
          className={inputCls}
        />
        <input
          value={drug.duration}
          onChange={(e) => onChange(index, 'duration', e.target.value)}
          placeholder="Duration e.g. 7 days *"
          className={inputCls}
        />
        <select
          value={drug.route}
          onChange={(e) => onChange(index, 'route', e.target.value)}
          className={selectCls}
        >
          {ROUTES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <select
          value={drug.frequency}
          onChange={(e) => onChange(index, 'frequency', e.target.value)}
          className={selectCls}
        >
          {FREQUENCIES.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <div className="col-span-2">
          <input
            value={drug.instructions ?? ''}
            onChange={(e) => onChange(index, 'instructions', e.target.value)}
            placeholder="Special instructions (optional)"
            className={inputCls}
          />
        </div>
      </div>
    </div>
  )
}
