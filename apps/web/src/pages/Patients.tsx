import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Search, ChevronRight } from 'lucide-react'
import { api } from '../lib/api'
import type { ApiResponse, Patient, CreatePatientInput } from '@medlog/types'

export default function PatientsPage() {
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['patients'],
    queryFn: () => api.get<ApiResponse<Patient[]>>('/patients?pageSize=50').then((r) => r.data),
  })

  const patients = (data?.data ?? []).filter((p) =>
    search ? p.mrNumber.toLowerCase().includes(search.toLowerCase()) : true
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Patients</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.meta?.total ?? 0} total</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add patient
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by MR#…"
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : patients.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No patients found</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {patients.map((p) => (
              <Link
                key={p.id}
                to={`/patients/${p.id}`}
                className="flex items-center px-5 py-3.5 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">MR# {p.mrNumber}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {p.admissionDiagnosis ?? 'No diagnosis'} · Admitted {p.admissionDate ? new Date(p.admissionDate).toLocaleDateString() : '—'}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium mr-3 ${
                  p.status === 'ADMITTED' ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {p.status}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {showAdd && <AddPatientModal onClose={() => setShowAdd(false)} onSuccess={() => { setShowAdd(false); qc.invalidateQueries({ queryKey: ['patients'] }) }} />}
    </div>
  )
}

function AddPatientModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [mrNumber, setMrNumber] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (input: CreatePatientInput) => api.post('/patients', input),
    onSuccess,
    onError: (e: { response?: { data?: { message?: string } } }) => setError(e.response?.data?.message ?? 'Failed to add patient'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-base font-semibold mb-4">Add patient</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">MR Number *</label>
            <input
              value={mrNumber}
              onChange={(e) => setMrNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g. MRN-2024-001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admission diagnosis</label>
            <input
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g. Community-acquired pneumonia"
            />
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => mutation.mutate({ mrNumber, admissionDiagnosis: diagnosis || undefined, admissionDate: new Date().toISOString() })}
            disabled={!mrNumber || mutation.isPending}
            className="flex-1 bg-brand-500 hover:bg-brand-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Adding…' : 'Add patient'}
          </button>
        </div>
      </div>
    </div>
  )
}
