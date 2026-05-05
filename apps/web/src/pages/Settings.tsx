import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Shield, Download, Trash2, Users, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { TeamPanel } from '../components/team/TeamPanel'

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'ADMIN'

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Team */}
        <Section title="Team" icon={Users}>
          <TeamPanel />
        </Section>

        {/* Data & Privacy */}
        <Section title="Data & privacy" icon={Shield}>
          <DataSummaryPanel />
          <div className="mt-4 space-y-2">
            <ExportPanel />
            <ErasurePanel />
          </div>
        </Section>

        {/* Admin: Compliance */}
        {isAdmin && (
          <Section title="Compliance status" icon={Shield}>
            <CompliancePanel />
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function DataSummaryPanel() {
  const { data } = useQuery({
    queryKey: ['gdpr-summary'],
    queryFn: () => api.get<{ data: object }>('/gdpr/me/data-summary').then((r) => r.data.data),
  })

  if (!data) return null
  const d = data as Record<string, Record<string, unknown>>

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Data we hold about you</p>
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(d.recordsHeld ?? {}).map(([key, val]) => (
          <div key={key} className="text-center">
            <p className="text-lg font-semibold text-gray-900">{String(val)}</p>
            <p className="text-xs text-gray-400">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExportPanel() {
  const [showExport, setShowExport] = useState(false)
  return (
    <>
      <button onClick={() => setShowExport(true)} className="w-full flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors text-left">
        <Download className="w-4 h-4 text-gray-400" />
        <div>
          <p className="text-sm font-medium text-gray-900">Export my data</p>
          <p className="text-xs text-gray-400">Download a copy of all your records (JSON or HTML report)</p>
        </div>
      </button>
      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
    </>
  )
}

function ExportModal({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [exportToken, setExportToken] = useState('')
  const [patientId, setPatientId] = useState('')
  const [step, setStep] = useState<'verify' | 'export'>('verify')

  const getToken = useMutation({
    mutationFn: () => api.post<{ data: { exportToken: string } }>('/export/request-export-token', { password }),
    onSuccess: (res) => { setExportToken(res.data.data.exportToken); setStep('export') },
  })

  async function downloadExport(format: 'json' | 'html') {
    const res = await api.post(`/export/patient/${patientId}/${format}`, { verificationToken: exportToken }, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a'); a.href = url; a.download = `medlog-export-${patientId}.${format === 'json' ? 'enc' : 'html'}`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal title="Export patient data" onClose={onClose}>
      {step === 'verify' ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Confirm your identity to generate an export token (valid 10 minutes).</p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="Your current password" />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" disabled={!password} loading={getToken.isPending} onClick={() => getToken.mutate()}>Verify identity</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-brand-50 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4 text-brand-500" /><p className="text-sm text-brand-700">Identity verified — token valid 10 min</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Patient ID</label>
            <input value={patientId} onChange={(e) => setPatientId(e.target.value)} className={inputCls} placeholder="Patient UUID" />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" disabled={!patientId} onClick={() => downloadExport('html')}>
              <Download className="w-3.5 h-3.5" /> HTML report
            </Button>
            <Button className="flex-1" disabled={!patientId} onClick={() => downloadExport('json')}>
              <Download className="w-3.5 h-3.5" /> Encrypted JSON
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function ErasurePanel() {
  const [showErasure, setShowErasure] = useState(false)
  return (
    <>
      <button onClick={() => setShowErasure(true)} className="w-full flex items-center gap-3 bg-white rounded-xl border border-red-100 p-4 hover:border-red-200 transition-colors text-left">
        <Trash2 className="w-4 h-4 text-red-400" />
        <div>
          <p className="text-sm font-medium text-red-700">Delete my account</p>
          <p className="text-xs text-gray-400">Anonymise your personal data (GDPR right to erasure). Clinical records are retained as required by medical law.</p>
        </div>
      </button>
      {showErasure && <ErasureModal onClose={() => setShowErasure(false)} />}
    </>
  )
}

function ErasureModal({ onClose }: { onClose: () => void }) {
  const [confirmation, setConfirmation] = useState('')
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const navigate = useNavigate()

  const erase = useMutation({
    mutationFn: () => api.delete('/gdpr/me', { data: { confirmation: 'DELETE MY ACCOUNT', password } }),
    onSuccess: () => setDone(true),
  })

  if (done) {
    return (
      <Modal title="Account deleted" onClose={() => { clearAuth(); navigate('/login') }}>
        <div className="space-y-3 text-center py-4">
          <CheckCircle2 className="w-10 h-10 text-brand-500 mx-auto" />
          <p className="text-sm text-gray-700">Your personal data has been anonymised.</p>
          <Button className="w-full" onClick={() => { clearAuth(); navigate('/login') }}>Sign out</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Delete account" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-3">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">This will anonymise your name, email, and credentials. Clinical notes and lab entries you authored are retained as medical records. This cannot be undone.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Type <strong>DELETE MY ACCOUNT</strong> to confirm</label>
          <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="danger" className="flex-1" disabled={confirmation !== 'DELETE MY ACCOUNT' || !password} loading={erase.isPending} onClick={() => erase.mutate()}>
            Delete account
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function CompliancePanel() {
  const { data } = useQuery({
    queryKey: ['compliance'],
    queryFn: () => api.get<{ data: { overall: string; checks: Record<string, { status: string }> } }>('/compliance/status').then((r) => r.data.data),
  })
  if (!data) return null

  const statusColors: Record<string, string> = {
    compliant: 'text-brand-600', partial: 'text-amber-600', action_required: 'text-red-600', review_required: 'text-amber-600',
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className={`text-sm font-semibold ${statusColors[data.overall] ?? 'text-gray-700'}`}>
          Overall: {data.overall.replace('_', ' ')}
        </span>
      </div>
      {Object.entries(data.checks).map(([key, check]) => (
        <div key={key} className="flex items-center justify-between text-sm">
          <span className="text-gray-700 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
          <span className={`text-xs font-medium ${statusColors[check.status] ?? 'text-gray-500'}`}>{check.status.replace('_', ' ')}</span>
        </div>
      ))}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
