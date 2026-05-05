import { useState, useEffect, useRef, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Clock } from 'lucide-react'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'

interface SoapContent {
  subjective: string
  objective: string
  assessment: string
  plan: string
}

const FIELDS: { key: keyof SoapContent; label: string; placeholder: string }[] = [
  { key: 'subjective', label: 'S — Subjective', placeholder: "Patient's complaints, symptoms, history…" },
  { key: 'objective', label: 'O — Objective', placeholder: 'Vitals, examination findings, investigations…' },
  { key: 'assessment', label: 'A — Assessment', placeholder: 'Diagnosis / differential…' },
  { key: 'plan', label: 'P — Plan', placeholder: 'Investigations, treatments, follow-up…' },
]

const DRAFT_AUTOSAVE_MS = 30_000

export function SoapEditor({ patientId, onSaved }: { patientId: string; onSaved: () => void }) {
  const [content, setContent] = useState<SoapContent>({ subjective: '', objective: '', assessment: '', plan: '' })
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [savingDraft, setSavingDraft] = useState(false)
  const draftIdRef = useRef<string | null>(null)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const qc = useQueryClient()

  const saveDraft = useCallback(async (c: SoapContent) => {
    const isEmpty = Object.values(c).every((v) => !v.trim())
    if (isEmpty) return
    setSavingDraft(true)
    try {
      if (draftIdRef.current) {
        await api.patch(`/notes/${draftIdRef.current}`, { content: c, isDraft: true })
      } else {
        const { data } = await api.post<{ data: { id: string } }>('/notes', {
          patientId,
          type: 'SOAP',
          content: c,
          isDraft: true,
        })
        draftIdRef.current = data.data.id
      }
      setLastSaved(new Date())
    } finally {
      setSavingDraft(false)
    }
  }, [patientId])

  // Reset autosave timer on every keystroke
  useEffect(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => saveDraft(content), DRAFT_AUTOSAVE_MS)
    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current) }
  }, [content, saveDraft])

  const publish = useMutation({
    mutationFn: async () => {
      if (draftIdRef.current) {
        return api.patch(`/notes/${draftIdRef.current}`, { content, isDraft: false })
      }
      return api.post('/notes', { patientId, type: 'SOAP', content, isDraft: false })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes', patientId] })
      setContent({ subjective: '', objective: '', assessment: '', plan: '' })
      draftIdRef.current = null
      setLastSaved(null)
      onSaved()
    },
  })

  function updateField(key: keyof SoapContent, value: string) {
    setContent((prev) => ({ ...prev, [key]: value }))
  }

  const isEmpty = Object.values(content).every((v) => !v.trim())

  return (
    <div className="space-y-3">
      {FIELDS.map(({ key, label, placeholder }) => (
        <div key={key}>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
          <textarea
            value={content[key]}
            onChange={(e) => updateField(key, e.target.value)}
            placeholder={placeholder}
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-gray-300"
          />
        </div>
      ))}

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          {savingDraft ? (
            <><span className="w-2.5 h-2.5 border border-gray-400 border-t-transparent rounded-full animate-spin" /> Saving draft…</>
          ) : lastSaved ? (
            <><Clock className="w-3 h-3" /> Draft saved {lastSaved.toLocaleTimeString()}</>
          ) : (
            <span>Draft autosaves every 30s</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => saveDraft(content)} disabled={isEmpty || savingDraft}>
            <Save className="w-3.5 h-3.5" /> Save draft
          </Button>
          <Button size="sm" onClick={() => publish.mutate()} loading={publish.isPending} disabled={isEmpty}>
            Publish note
          </Button>
        </div>
      </div>
    </div>
  )
}
