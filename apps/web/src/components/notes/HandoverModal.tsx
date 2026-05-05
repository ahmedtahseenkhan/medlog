import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ClipboardCopy, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import { api } from '../../lib/api'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'

interface HandoverSummary {
  patient: { mrNumber: string; ward: string; bed: string; admissionDiagnosis?: string }
  currentPlan: string
  recentNotes: { type: string; author: string; date: string; summary: string }[]
  pendingTasks: {
    urgent: { id: string; title: string; priority: string; dueAt?: string }[]
    routine: { id: string; title: string; priority: string; dueAt?: string }[]
  }
  abnormalLabs: {
    critical: { testName: string; value: string; unit: string; reportedAt: string }[]
    abnormal: { testName: string; value: string; unit: string; reportedAt: string }[]
  }
}

export function HandoverModal({ patientId, onClose, onCommitted }: {
  patientId: string
  onClose: () => void
  onCommitted: () => void
}) {
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [copied, setCopied] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['handover', patientId],
    queryFn: () => api.get<{ data: HandoverSummary }>(`/handover/patient/${patientId}`).then((r) => r.data),
  })

  const commit = useMutation({
    mutationFn: () => api.post(`/handover/patient/${patientId}/commit`, { additionalNotes }),
    onSuccess: onCommitted,
  })

  const summary = data?.data

  function copyToClipboard() {
    if (!summary) return
    const text = buildPlainText(summary, additionalNotes)
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal title="Shift handover" onClose={onClose} size="xl">
      {isLoading ? (
        <div className="py-10 text-center text-sm text-gray-400">Building summary…</div>
      ) : summary ? (
        <div className="space-y-4">
          {/* Header */}
          <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
            <p className="font-medium text-gray-900">MR# {summary.patient.mrNumber} · {summary.patient.ward} · Bed {summary.patient.bed}</p>
            {summary.patient.admissionDiagnosis && <p className="text-gray-500 mt-0.5">{summary.patient.admissionDiagnosis}</p>}
          </div>

          {/* Critical labs alert */}
          {summary.abnormalLabs.critical.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-700 mb-1">CRITICAL LABS</p>
                {summary.abnormalLabs.critical.map((l, i) => (
                  <p key={i} className="text-xs text-red-600">{l.testName}: <strong>{l.value} {l.unit}</strong></p>
                ))}
              </div>
            </div>
          )}

          {/* Current plan */}
          <Section title="Current plan">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{summary.currentPlan}</p>
          </Section>

          {/* Pending tasks */}
          {(summary.pendingTasks.urgent.length > 0 || summary.pendingTasks.routine.length > 0) && (
            <Section title={`Pending tasks (${summary.pendingTasks.urgent.length + summary.pendingTasks.routine.length})`}>
              {summary.pendingTasks.urgent.map((t) => (
                <div key={t.id} className="flex items-center gap-2 py-0.5">
                  <Badge variant="red">{t.priority}</Badge>
                  <span className="text-sm text-gray-800">{t.title}</span>
                  {t.dueAt && <span className="text-xs text-gray-400 ml-auto">Due {format(new Date(t.dueAt), 'HH:mm')}</span>}
                </div>
              ))}
              {summary.pendingTasks.routine.map((t) => (
                <div key={t.id} className="flex items-center gap-2 py-0.5">
                  <Badge variant="gray">{t.priority}</Badge>
                  <span className="text-sm text-gray-600">{t.title}</span>
                </div>
              ))}
            </Section>
          )}

          {/* Abnormal labs */}
          {summary.abnormalLabs.abnormal.length > 0 && (
            <Section title="Abnormal labs">
              <div className="grid grid-cols-2 gap-1">
                {summary.abnormalLabs.abnormal.map((l, i) => (
                  <p key={i} className="text-xs text-gray-700">{l.testName}: <span className="font-semibold text-amber-700">{l.value} {l.unit}</span></p>
                ))}
              </div>
            </Section>
          )}

          {/* Recent notes */}
          {summary.recentNotes.length > 0 && (
            <Section title="Recent notes">
              {summary.recentNotes.map((n, i) => (
                <div key={i} className="text-sm border-l-2 border-gray-200 pl-3 py-0.5">
                  <p className="text-xs text-gray-400">{n.type} · {n.author} · {format(new Date(n.date), 'dd MMM HH:mm')}</p>
                  <p className="text-gray-700 mt-0.5 line-clamp-2">{n.summary}</p>
                </div>
              ))}
            </Section>
          )}

          {/* Additional notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Additional handover notes</label>
            <textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              placeholder="Any extra information for the incoming team…"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={copyToClipboard} className="flex-1">
              {copied ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copied!</> : <><ClipboardCopy className="w-3.5 h-3.5" /> Copy text</>}
            </Button>
            <Button onClick={() => commit.mutate()} loading={commit.isPending} className="flex-1">
              Commit handover
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function buildPlainText(s: HandoverSummary, extra: string) {
  const lines = [
    `HANDOVER — MR# ${s.patient.mrNumber}`,
    `Ward: ${s.patient.ward} | Bed: ${s.patient.bed}`,
    s.patient.admissionDiagnosis ? `Diagnosis: ${s.patient.admissionDiagnosis}` : '',
    '',
    'PLAN:',
    s.currentPlan,
  ]
  if (s.abnormalLabs.critical.length) {
    lines.push('', '⚠ CRITICAL LABS:')
    s.abnormalLabs.critical.forEach((l) => lines.push(`  ${l.testName}: ${l.value} ${l.unit}`))
  }
  if (s.pendingTasks.urgent.length) {
    lines.push('', 'URGENT TASKS:')
    s.pendingTasks.urgent.forEach((t) => lines.push(`  [${t.priority}] ${t.title}`))
  }
  if (s.pendingTasks.routine.length) {
    lines.push('', 'ROUTINE TASKS:')
    s.pendingTasks.routine.forEach((t) => lines.push(`  [ ] ${t.title}`))
  }
  if (extra) { lines.push('', 'NOTES:', extra) }
  return lines.filter((l) => l !== null).join('\n')
}
