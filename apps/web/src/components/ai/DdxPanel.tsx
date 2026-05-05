import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Sparkles, ThumbsUp, ThumbsDown, AlertTriangle, ChevronDown, ChevronRight, Info } from 'lucide-react'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import type { ApiResponse, LabReport } from '@medlog/types'

interface Differential {
  diagnosis: string
  likelihood: 'High' | 'Moderate' | 'Low'
  supportingFindings: string[]
  againstFindings: string[]
  rationale: string
}
interface ManagementStep {
  category: string
  action: string
  urgency: 'Immediate' | 'Urgent' | 'Routine'
}
interface DdxResult {
  sessionId: string
  differentials: Differential[]
  managementPlan: ManagementStep[]
  redFlags: string[]
  modelVersion: string
}

const likelihoodVariant: Record<string, 'red' | 'amber' | 'gray'> = { High: 'red', Moderate: 'amber', Low: 'gray' }
const urgencyVariant: Record<string, 'red' | 'amber' | 'blue'> = { Immediate: 'red', Urgent: 'amber', Routine: 'blue' }

const DISCLAIMER = 'AI-generated suggestions are for educational support only. All clinical decisions must be made by a licensed clinician using full patient context. Never rely solely on this output.'

export function DdxPanel({ patientId }: { patientId: string }) {
  const [symptoms, setSymptoms] = useState('')
  const [examination, setExamination] = useState('')
  const [history, setHistory] = useState('')
  const [result, setResult] = useState<DdxResult | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0)
  const [feedbackGiven, setFeedbackGiven] = useState(false)
  const qc = useQueryClient()

  const { data: labsData } = useQuery({
    queryKey: ['labs', patientId],
    queryFn: () => api.get<ApiResponse<LabReport[]>>(`/labs/patient/${patientId}`).then((r) => r.data),
  })

  const generate = useMutation({
    mutationFn: () => api.post<{ data: DdxResult }>('/ddx/generate', {
      patientId,
      symptoms: symptoms.split(',').map((s) => s.trim()).filter(Boolean),
      examination,
      history,
    }),
    onSuccess: (res) => { setResult(res.data.data); setExpandedIdx(0); setFeedbackGiven(false) },
  })

  const feedback = useMutation({
    mutationFn: ({ rating, comment }: { rating: 'up' | 'down'; comment?: string }) =>
      api.post(`/ddx/${result!.sessionId}/feedback`, { rating, comment }),
    onSuccess: () => setFeedbackGiven(true),
  })

  const abnormalLabs = labsData?.data?.filter((l) => l.isAbnormal) ?? []

  return (
    <div className="space-y-4">
      {/* Disclaimer */}
      <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">{DISCLAIMER}</p>
      </div>

      {/* Input */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Clinical input</p>

        {abnormalLabs.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 mb-1">Auto-included from chart:</p>
            <div className="flex flex-wrap gap-1">
              {abnormalLabs.map((l) => (
                <Badge key={l.id} variant={l.isCritical ? 'red' : 'amber'}>{l.testName} {l.value} {l.unit}</Badge>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Symptoms (comma-separated) *</label>
          <input value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="e.g. fever, productive cough, dyspnoea"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Examination findings</label>
          <textarea value={examination} onChange={(e) => setExamination(e.target.value)} rows={2} placeholder="e.g. dullness right base, reduced air entry…"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Relevant history</label>
          <textarea value={history} onChange={(e) => setHistory(e.target.value)} rows={2} placeholder="e.g. 3 days, diabetic, recent hospital admission…"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>

        <Button onClick={() => generate.mutate()} loading={generate.isPending} disabled={!symptoms.trim()} className="w-full">
          <Sparkles className="w-3.5 h-3.5" />
          {generate.isPending ? 'Generating differentials…' : 'Generate differentials'}
        </Button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* Red flags */}
          {result.redFlags.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Red flags — act immediately</span>
              </div>
              <ul className="space-y-1">
                {result.redFlags.map((f, i) => <li key={i} className="text-sm text-red-700 flex gap-2"><span>•</span>{f}</li>)}
              </ul>
            </div>
          )}

          {/* Differentials */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Differential diagnoses</p>
            </div>
            {result.differentials.map((d, i) => (
              <div key={i} className="border-b border-gray-100 last:border-0">
                <button
                  onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <Badge variant={likelihoodVariant[d.likelihood] ?? 'gray'}>{d.likelihood}</Badge>
                  <span className="flex-1 text-sm font-medium text-gray-900">{d.diagnosis}</span>
                  {expandedIdx === i ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                </button>
                {expandedIdx === i && (
                  <div className="px-4 pb-4 space-y-3">
                    <p className="text-sm text-gray-700 italic">{d.rationale}</p>
                    {d.supportingFindings.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-brand-600 mb-1">Supporting</p>
                        <ul className="space-y-0.5">{d.supportingFindings.map((f, j) => <li key={j} className="text-xs text-gray-600 flex gap-1.5"><span className="text-brand-500">✓</span>{f}</li>)}</ul>
                      </div>
                    )}
                    {d.againstFindings.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-red-600 mb-1">Against</p>
                        <ul className="space-y-0.5">{d.againstFindings.map((f, j) => <li key={j} className="text-xs text-gray-600 flex gap-1.5"><span className="text-red-400">✗</span>{f}</li>)}</ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Management plan */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Management plan</p>
            </div>
            <div className="divide-y divide-gray-100">
              {result.managementPlan.map((step, i) => (
                <div key={i} className="px-4 py-3 flex items-start gap-3">
                  <Badge variant={urgencyVariant[step.urgency] ?? 'gray'}>{step.urgency}</Badge>
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-0.5">{step.category}</p>
                    <p className="text-sm text-gray-800">{step.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Feedback */}
          <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500">Was this helpful? (helps improve AI)</p>
            {feedbackGiven ? (
              <span className="text-xs text-brand-600 font-medium">Thanks for the feedback</span>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => feedback.mutate({ rating: 'up' })} className="p-1.5 rounded-lg hover:bg-brand-50 text-gray-400 hover:text-brand-600 transition-colors">
                  <ThumbsUp className="w-4 h-4" />
                </button>
                <button onClick={() => feedback.mutate({ rating: 'down' })} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                  <ThumbsDown className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400 text-center">Model: {result.modelVersion}</p>
        </div>
      )}
    </div>
  )
}
