import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Activity, FileText, FlaskConical, ClipboardList } from 'lucide-react'
import { format } from 'date-fns'
import { api } from '../lib/api'
import { Badge } from '../components/ui/Badge'

interface SharedData {
  patient: { mrNumber: string; admissionDiagnosis?: string; ward?: string; status: string }
  notes: { type: string; date: string; author: string; content: Record<string, string> }[]
  abnormalLabs: { testName: string; value: string; unit: string; isCritical: boolean }[]
  pendingTasks: { title: string; priority: string }[]
  expiresAt: string
  purpose: string
}

export default function SharedViewPage() {
  const { token } = useParams<{ token: string }>()

  const { data, isLoading, error } = useQuery({
    queryKey: ['share', token],
    queryFn: () => api.get<{ data: SharedData }>(`/sharing/resolve/${token}`).then((r) => r.data.data),
    retry: false,
  })

  if (isLoading) return <LoadingState />
  if (error || !data) return <ErrorState />

  const d = data
  const isExpiringSoon = new Date(d.expiresAt).getTime() - Date.now() < 3_600_000

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-5 h-5 text-brand-500" />
            <span className="font-semibold text-gray-900">MedLog AI — Referral Summary</span>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">MR# {d.patient.mrNumber}</h1>
              {d.patient.admissionDiagnosis && <p className="text-sm text-gray-500 mt-0.5">{d.patient.admissionDiagnosis}</p>}
              {d.patient.ward && <p className="text-xs text-gray-400 mt-1">{d.patient.ward}</p>}
            </div>
            <Badge variant={d.patient.status === 'ADMITTED' ? 'green' : 'gray'}>{d.patient.status}</Badge>
          </div>
        </div>

        {/* Expiry warning */}
        {isExpiringSoon && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <p className="text-sm text-amber-700">This link expires {format(new Date(d.expiresAt), 'dd MMM yyyy HH:mm')}</p>
          </div>
        )}

        {/* Critical labs */}
        {d.abnormalLabs.filter((l) => l.isCritical).length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">Critical labs</p>
            {d.abnormalLabs.filter((l) => l.isCritical).map((l, i) => (
              <p key={i} className="text-sm text-red-700"><strong>{l.testName}:</strong> {l.value} {l.unit}</p>
            ))}
          </div>
        )}

        {/* Abnormal labs */}
        {d.abnormalLabs.filter((l) => !l.isCritical).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <FlaskConical className="w-4 h-4 text-purple-500" />
              <p className="text-sm font-medium text-gray-900">Abnormal results</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {d.abnormalLabs.filter((l) => !l.isCritical).map((l, i) => (
                <div key={i} className="bg-amber-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-500">{l.testName}</p>
                  <p className="text-sm font-semibold text-amber-700">{l.value} {l.unit}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent notes */}
        {d.notes.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-blue-500" />
              <p className="text-sm font-medium text-gray-900">Recent notes ({d.notes.length})</p>
            </div>
            <div className="space-y-3">
              {d.notes.slice(0, 3).map((n, i) => {
                const c = n.content
                return (
                  <div key={i} className="border-l-2 border-blue-200 pl-3">
                    <p className="text-xs text-gray-400">{n.type} · {n.author} · {format(new Date(n.date), 'dd MMM yyyy HH:mm')}</p>
                    {c.assessment && <p className="text-sm text-gray-700 mt-0.5"><span className="font-medium">A:</span> {c.assessment}</p>}
                    {c.plan && <p className="text-sm text-gray-700"><span className="font-medium">P:</span> {c.plan}</p>}
                    {c.freeText && !c.assessment && <p className="text-sm text-gray-700 line-clamp-2">{c.freeText}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Pending tasks */}
        {d.pendingTasks.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-medium text-gray-900">Pending tasks ({d.pendingTasks.length})</p>
            </div>
            <div className="space-y-1">
              {d.pendingTasks.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{t.title}</span>
                  <Badge variant={t.priority === 'URGENT' ? 'red' : t.priority === 'HIGH' ? 'amber' : 'gray'}>{t.priority}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center pb-4">
          This is a time-limited referral summary generated by MedLog AI.
          Link expires {format(new Date(d.expiresAt), 'dd MMM yyyy HH:mm')}.
        </p>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Activity className="w-8 h-8 text-brand-500 mx-auto mb-3 animate-pulse" />
        <p className="text-sm text-gray-500">Loading referral summary…</p>
      </div>
    </div>
  )
}

function ErrorState() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center max-w-sm">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h2 className="text-base font-semibold text-gray-900 mb-1">Link unavailable</h2>
        <p className="text-sm text-gray-500">This link has expired, been revoked, or is invalid.</p>
      </div>
    </div>
  )
}
