import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Pencil, Trash2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { api } from '../../lib/api'

interface OcrField {
  key: string
  value: string
  unit?: string
  confidence: number
  mappedName: string | null
}

interface Props {
  patientId: string
  imageId: string
  fields: OcrField[]
  overallConfidence: number
  needsReview: boolean
  rawText: string
  onClose: () => void
  onCommitted: () => void
}

interface EditableField {
  testName: string
  value: string
  unit: string
  referenceRangeLow: string
  referenceRangeHigh: string
  include: boolean
}

export function OcrReviewModal({ patientId, imageId, fields, overallConfidence, needsReview, rawText, onClose, onCommitted }: Props) {
  const qc = useQueryClient()
  const [showRaw, setShowRaw] = useState(false)
  const [editables, setEditables] = useState<EditableField[]>(
    fields.map((f) => ({
      testName: f.mappedName ?? f.key,
      value: f.value,
      unit: '',
      referenceRangeLow: '',
      referenceRangeHigh: '',
      include: f.mappedName !== null, // auto-include only mapped fields
    }))
  )

  const commit = useMutation({
    mutationFn: () =>
      api.post('/ocr/commit', {
        patientId,
        confirmedFields: editables
          .filter((e) => e.include && e.testName && e.value)
          .map((e) => ({
            testName: e.testName,
            value: e.value,
            unit: e.unit || '—',
            referenceRangeLow: e.referenceRangeLow ? parseFloat(e.referenceRangeLow) : undefined,
            referenceRangeHigh: e.referenceRangeHigh ? parseFloat(e.referenceRangeHigh) : undefined,
          })),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['labs', patientId] }); onCommitted() },
  })

  function update(i: number, patch: Partial<EditableField>) {
    setEditables((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)))
  }

  const included = editables.filter((e) => e.include).length

  return (
    <Modal title="Review OCR results" onClose={onClose} size="xl">
      <div className="space-y-4">
        {/* Confidence banner */}
        <div className={`flex items-start gap-3 rounded-lg px-4 py-3 ${needsReview ? 'bg-amber-50 border border-amber-200' : 'bg-brand-50 border border-brand-200'}`}>
          {needsReview
            ? <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            : <CheckCircle2 className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />}
          <div>
            <p className={`text-sm font-medium ${needsReview ? 'text-amber-800' : 'text-brand-800'}`}>
              {needsReview ? 'Low-confidence fields detected — please review carefully' : 'High confidence extraction'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Overall confidence: {overallConfidence}% · {fields.length} fields extracted</p>
          </div>
        </div>

        {/* Field table */}
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {editables.map((e, i) => {
            const raw = fields[i]
            return (
              <div key={i} className={`border rounded-xl p-3 transition-colors ${e.include ? 'border-gray-200' : 'border-dashed border-gray-200 opacity-50'}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={e.include} onChange={(ev) => update(i, { include: ev.target.checked })} className="mt-1 rounded" />
                  <div className="flex-1 grid grid-cols-4 gap-2">
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-400 mb-0.5">Test name</label>
                      <input
                        value={e.testName}
                        onChange={(ev) => update(i, { testName: ev.target.value })}
                        disabled={!e.include}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-0.5">Value</label>
                      <input
                        value={e.value}
                        onChange={(ev) => update(i, { value: ev.target.value })}
                        disabled={!e.include}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-0.5">Unit</label>
                      <input
                        value={e.unit}
                        onChange={(ev) => update(i, { unit: ev.target.value })}
                        disabled={!e.include}
                        placeholder="e.g. g/dL"
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-0.5">Ref low</label>
                      <input type="number" value={e.referenceRangeLow} onChange={(ev) => update(i, { referenceRangeLow: ev.target.value })} disabled={!e.include}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-0.5">Ref high</label>
                      <input type="number" value={e.referenceRangeHigh} onChange={(ev) => update(i, { referenceRangeHigh: ev.target.value })} disabled={!e.include}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50" />
                    </div>
                  </div>
                  <Badge variant={raw.confidence >= 80 ? 'green' : raw.confidence >= 60 ? 'amber' : 'red'}>
                    {Math.round(raw.confidence)}%
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>

        {/* Raw text toggle */}
        <button onClick={() => setShowRaw((s) => !s)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
          <Pencil className="w-3 h-3" /> {showRaw ? 'Hide' : 'Show'} raw extracted text
        </button>
        {showRaw && (
          <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 whitespace-pre-wrap max-h-40 overflow-y-auto border border-gray-200">
            {rawText || 'No raw text extracted'}
          </pre>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1"
            loading={commit.isPending}
            disabled={included === 0}
            onClick={() => commit.mutate()}
          >
            Save {included} lab result{included !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
