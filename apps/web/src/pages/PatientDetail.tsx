import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft, FileText, ClipboardList, FlaskConical,
  Pill, ImageIcon, Clock, ArrowRightLeft, Plus, AlertTriangle, Sparkles, Bell,
} from 'lucide-react'
import { api } from '../lib/api'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Tabs } from '../components/ui/Tabs'
import { Modal } from '../components/ui/Modal'
import { SoapEditor } from '../components/notes/SoapEditor'
import { HandoverModal } from '../components/notes/HandoverModal'
import { PatientTimeline } from '../components/patients/PatientTimeline'
import { LabTrendChart } from '../components/labs/LabTrendChart'
import { MedicationLog } from '../components/labs/MedicationLog'
import { RadiologyPanel } from '../components/radiology/RadiologyPanel'
import { DdxPanel } from '../components/ai/DdxPanel'
import type { ApiResponse, Patient, ClinicalNote, Task, LabReport } from '@medlog/types'

interface RecallRule {
  id: string
  patientId: string
  intervalDays: number
  nextDueAt: string
  diagnosisNote?: string
  active: boolean
  createdAt: string
}

type Tab = 'timeline' | 'notes' | 'tasks' | 'labs' | 'meds' | 'radiology' | 'ai' | 'recall'

const TABS = [
  { key: 'timeline', label: 'Timeline', icon: Clock },
  { key: 'notes', label: 'Notes', icon: FileText },
  { key: 'tasks', label: 'Tasks', icon: ClipboardList },
  { key: 'labs', label: 'Labs', icon: FlaskConical },
  { key: 'meds', label: 'Meds', icon: Pill },
  { key: 'radiology', label: 'Imaging', icon: ImageIcon },
  { key: 'ai', label: 'AI DDx', icon: Sparkles },
  { key: 'recall', label: 'Recall', icon: Bell },
] as const

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<Tab>('timeline')
  const [showHandover, setShowHandover] = useState(false)
  const [showAddNote, setShowAddNote] = useState(false)
  const [showAddTask, setShowAddTask] = useState(false)
  const [showAddLab, setShowAddLab] = useState(false)
  const [trendTest, setTrendTest] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data: patientData, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => api.get<ApiResponse<Patient>>(`/patients/${id}`).then((r) => r.data),
  })

  const { data: labsData } = useQuery({
    queryKey: ['labs', id],
    queryFn: () => api.get<ApiResponse<LabReport[]>>(`/labs/patient/${id}`).then((r) => r.data),
    enabled: tab === 'labs',
  })

  const patient = patientData?.data
  if (isLoading) return <div className="p-6 text-sm text-gray-400">Loading…</div>
  if (!patient) return <div className="p-6 text-sm text-red-500">Patient not found</div>

  const statusVariant = patient.status === 'ADMITTED' ? 'green' : 'gray'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-200 bg-white">
        <Link to="/patients" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-3">
          <ChevronLeft className="w-3.5 h-3.5" /> Patients
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-semibold text-gray-900">MR# {patient.mrNumber}</h1>
              <Badge variant={statusVariant}>{patient.status}</Badge>
              {patient.bedNumber && <Badge variant="blue">Bed {patient.bedNumber}</Badge>}
            </div>
            <p className="text-sm text-gray-500">{patient.admissionDiagnosis ?? 'No diagnosis recorded'}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowHandover(true)}>
              <ArrowRightLeft className="w-3.5 h-3.5" /> Handover
            </Button>
            {tab === 'notes' && <Button size="sm" onClick={() => setShowAddNote(true)}><Plus className="w-3.5 h-3.5" /> Note</Button>}
            {tab === 'tasks' && <Button size="sm" onClick={() => setShowAddTask(true)}><Plus className="w-3.5 h-3.5" /> Task</Button>}
            {tab === 'labs' && <Button size="sm" onClick={() => setShowAddLab(true)}><Plus className="w-3.5 h-3.5" /> Lab</Button>}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <Tabs tabs={TABS as unknown as { key: string; label: string; icon: React.ElementType }[]} active={tab} onChange={(k) => setTab(k as Tab)} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'timeline' && <PatientTimeline patientId={id!} />}
        {tab === 'notes' && <NotesTab patientId={id!} showAdd={showAddNote} onCloseAdd={() => setShowAddNote(false)} />}
        {tab === 'tasks' && <TasksTab patientId={id!} showAdd={showAddTask} onCloseAdd={() => setShowAddTask(false)} />}
        {tab === 'labs' && (
          <LabsTab
            patientId={id!}
            labs={labsData?.data ?? []}
            showAdd={showAddLab}
            onCloseAdd={() => setShowAddLab(false)}
            trendTest={trendTest}
            onViewTrend={setTrendTest}
          />
        )}
        {tab === 'meds' && <MedicationLog patientId={id!} />}
        {tab === 'radiology' && <RadiologyPanel patientId={id!} />}
        {tab === 'ai' && <DdxPanel patientId={id!} />}
        {tab === 'recall' && <RecallTab patientId={id!} patient={patient} />}
      </div>

      {showHandover && (
        <HandoverModal
          patientId={id!}
          onClose={() => setShowHandover(false)}
          onCommitted={() => { setShowHandover(false); qc.invalidateQueries({ queryKey: ['notes', id] }) }}
        />
      )}
    </div>
  )
}

// ── Notes Tab ─────────────────────────────────────────────────────────────────

function NotesTab({ patientId, showAdd, onCloseAdd }: { patientId: string; showAdd: boolean; onCloseAdd: () => void }) {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['notes', patientId],
    queryFn: () => api.get<ApiResponse<ClinicalNote[]>>(`/notes/patient/${patientId}`).then((r) => r.data),
  })
  const notes = data?.data ?? []

  return (
    <div className="space-y-3">
      {showAdd && (
        <div className="bg-white rounded-xl border border-brand-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">New SOAP note</p>
          <SoapEditor patientId={patientId} onSaved={() => { onCloseAdd(); qc.invalidateQueries({ queryKey: ['notes', patientId] }) }} />
        </div>
      )}
      {notes.length === 0 && !showAdd ? (
        <div className="py-10 text-center text-sm text-gray-400">No notes yet</div>
      ) : (
        notes.map((n) => <NoteCard key={n.id} note={n} />)
      )}
    </div>
  )
}

function NoteCard({ note }: { note: ClinicalNote }) {
  const c = note.content as Record<string, string>
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2 cursor-pointer" onClick={() => setExpanded((e) => !e)}>
        <div className="flex items-center gap-2">
          <Badge variant={note.type === 'SOAP' ? 'blue' : note.type === 'HANDOVER' ? 'purple' : 'gray'}>{note.type}</Badge>
          {note.isDraft && <Badge variant="amber">DRAFT</Badge>}
        </div>
        <span className="text-xs text-gray-400">{new Date(note.createdAt).toLocaleString()}</span>
      </div>
      {note.type === 'SOAP' ? (
        <div className="space-y-2">
          {c.assessment && <p className="text-sm text-gray-800"><span className="text-xs font-semibold text-gray-500 mr-1">A:</span>{c.assessment}</p>}
          {expanded && (
            <>
              {c.subjective && <p className="text-sm text-gray-700"><span className="text-xs font-semibold text-gray-500 mr-1">S:</span>{c.subjective}</p>}
              {c.objective && <p className="text-sm text-gray-700"><span className="text-xs font-semibold text-gray-500 mr-1">O:</span>{c.objective}</p>}
              {c.plan && <p className="text-sm text-gray-700"><span className="text-xs font-semibold text-gray-500 mr-1">P:</span>{c.plan}</p>}
            </>
          )}
          <button onClick={() => setExpanded((e) => !e)} className="text-xs text-brand-600 hover:underline">
            {expanded ? 'Show less' : 'Show all fields'}
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.freeText ?? 'Handover note'}</p>
      )}
    </div>
  )
}

// ── Tasks Tab ─────────────────────────────────────────────────────────────────

function TasksTab({ patientId, showAdd, onCloseAdd }: { patientId: string; showAdd: boolean; onCloseAdd: () => void }) {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['tasks', patientId],
    queryFn: () => api.get<ApiResponse<Task[]>>(`/tasks/patient/${patientId}`).then((r) => r.data),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/tasks/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', patientId] }),
  })

  const tasks = data?.data ?? []
  const pending = tasks.filter((t) => t.status !== 'DONE')
  const done = tasks.filter((t) => t.status === 'DONE')

  return (
    <div className="space-y-3">
      {showAdd && <AddTaskInline patientId={patientId} onDone={() => { onCloseAdd(); qc.invalidateQueries({ queryKey: ['tasks', patientId] }) }} />}
      {pending.map((t) => <TaskRow key={t.id} task={t} onStatusChange={(s) => updateStatus.mutate({ id: t.id, status: s })} />)}
      {done.length > 0 && (
        <details>
          <summary className="text-xs text-gray-400 cursor-pointer py-1 select-none">Completed ({done.length})</summary>
          <div className="space-y-2 mt-2">{done.map((t) => <TaskRow key={t.id} task={t} />)}</div>
        </details>
      )}
      {tasks.length === 0 && !showAdd && <div className="py-10 text-center text-sm text-gray-400">No tasks yet</div>}
    </div>
  )
}

const priorityBadge: Record<string, 'red' | 'amber' | 'blue' | 'gray'> = { URGENT: 'red', HIGH: 'amber', MEDIUM: 'blue', LOW: 'gray' }

function TaskRow({ task, onStatusChange }: { task: Task; onStatusChange?: (s: string) => void }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
      <button
        onClick={() => onStatusChange?.(task.status === 'DONE' ? 'PENDING' : task.status === 'PENDING' ? 'IN_PROGRESS' : 'DONE')}
        className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${task.status === 'DONE' ? 'bg-brand-500 border-brand-500' : task.status === 'IN_PROGRESS' ? 'bg-amber-400 border-amber-400' : 'border-gray-300 hover:border-brand-500'}`}
      >
        {task.status !== 'PENDING' && <span className="text-white text-[10px]">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.status === 'DONE' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{task.title}</p>
        {task.dueAt && <p className="text-xs text-gray-400">Due {new Date(task.dueAt).toLocaleString()}</p>}
      </div>
      <Badge variant={priorityBadge[task.priority] ?? 'gray'}>{task.priority}</Badge>
    </div>
  )
}

function AddTaskInline({ patientId, onDone }: { patientId: string; onDone: () => void }) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('MEDIUM')

  const mutation = useMutation({
    mutationFn: () => api.post('/tasks', { patientId, title, priority }),
    onSuccess: onDone,
  })

  return (
    <div className="bg-white rounded-xl border border-brand-200 p-4 flex gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task description…"
        className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        autoFocus
        onKeyDown={(e) => { if (e.key === 'Enter' && title.trim()) mutation.mutate() }}
      />
      <select value={priority} onChange={(e) => setPriority(e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700">
        {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p}>{p}</option>)}
      </select>
      <Button size="sm" disabled={!title.trim()} loading={mutation.isPending} onClick={() => mutation.mutate()}>Add</Button>
    </div>
  )
}

// ── Labs Tab ──────────────────────────────────────────────────────────────────

function LabsTab({ patientId, labs, showAdd, onCloseAdd, trendTest, onViewTrend }: {
  patientId: string; labs: LabReport[]; showAdd: boolean; onCloseAdd: () => void
  trendTest: string | null; onViewTrend: (t: string | null) => void
}) {
  const qc = useQueryClient()
  const uniqueTests = [...new Set(labs.map((l) => l.testName))]

  return (
    <div className="space-y-3">
      {showAdd && <AddLabInline patientId={patientId} onDone={() => { onCloseAdd(); qc.invalidateQueries({ queryKey: ['labs', patientId] }) }} />}

      {trendTest && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Trend — {trendTest}</p>
            <button onClick={() => onViewTrend(null)} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
          </div>
          <LabTrendChart labs={labs} testName={trendTest} />
        </div>
      )}

      {uniqueTests.length > 1 && !trendTest && (
        <div className="flex flex-wrap gap-1.5">
          {uniqueTests.map((t) => (
            <button key={t} onClick={() => onViewTrend(t)} className="text-xs px-2.5 py-1 rounded-full border border-gray-200 hover:border-brand-400 hover:text-brand-600 transition-colors">
              📈 {t}
            </button>
          ))}
        </div>
      )}

      {labs.length === 0 && !showAdd ? (
        <div className="py-10 text-center text-sm text-gray-400">No lab results yet</div>
      ) : (
        labs.map((l) => <LabRow key={l.id} lab={l} />)
      )}
    </div>
  )
}

function LabRow({ lab }: { lab: LabReport }) {
  return (
    <div className={`bg-white rounded-xl border px-4 py-3 flex items-center justify-between ${lab.isCritical ? 'border-red-300 bg-red-50/30' : lab.isAbnormal ? 'border-amber-300' : 'border-gray-200'}`}>
      <div>
        <p className="text-sm font-medium text-gray-900">{lab.testName}</p>
        <p className="text-xs text-gray-400 mt-0.5">{new Date(lab.reportedAt).toLocaleString()}</p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-semibold ${lab.isCritical ? 'text-red-600' : lab.isAbnormal ? 'text-amber-600' : 'text-gray-900'}`}>
          {lab.value} <span className="font-normal text-gray-400">{lab.unit}</span>
        </p>
        {(lab.referenceRangeLow != null || lab.referenceRangeHigh != null) && (
          <p className="text-xs text-gray-400">ref: {lab.referenceRangeLow ?? '?'}–{lab.referenceRangeHigh ?? '?'}</p>
        )}
        {lab.isCritical && (
          <div className="flex items-center justify-end gap-0.5 text-red-600 text-xs mt-0.5">
            <AlertTriangle className="w-3 h-3" /> CRITICAL
          </div>
        )}
      </div>
    </div>
  )
}

// ── Recall + Contact Prefs Tab ────────────────────────────────────────────────

function RecallTab({ patientId, patient }: { patientId: string; patient: Patient }) {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [newInterval, setNewInterval] = useState('')
  const [newNote, setNewNote] = useState('')
  const [editingContact, setEditingContact] = useState(false)
  const [contactChannel, setContactChannel] = useState(
    (patient.contactPrefs as any)?.channel ?? 'email'
  )
  const [contactNotes, setContactNotes] = useState(
    (patient.contactPrefs as any)?.notes ?? ''
  )

  const { data, isLoading } = useQuery({
    queryKey: ['recall', patientId],
    queryFn: () => api.get<ApiResponse<RecallRule[]>>(`/recall/patient/${patientId}`).then((r) => r.data),
  })

  const addMutation = useMutation({
    mutationFn: () => api.post(`/recall/patient/${patientId}`, {
      intervalDays: parseInt(newInterval),
      diagnosisNote: newNote || undefined,
    }),
    onSuccess: () => {
      setShowAdd(false)
      setNewInterval('')
      setNewNote('')
      qc.invalidateQueries({ queryKey: ['recall', patientId] })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/recall/${id}`, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recall', patientId] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/recall/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recall', patientId] }),
  })

  const saveContactMutation = useMutation({
    mutationFn: () => api.patch(`/patients/${patientId}`, {
      contactPrefs: { channel: contactChannel, notes: contactNotes || undefined },
    }),
    onSuccess: () => {
      setEditingContact(false)
      qc.invalidateQueries({ queryKey: ['patient', patientId] })
    },
  })

  const rules = data?.data ?? []
  const cls = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  const CHANNEL_LABELS: Record<string, string> = { sms: 'SMS', push: 'Push', email: 'Email', whatsapp: 'WhatsApp' }
  const CHANNEL_VARIANT: Record<string, 'blue' | 'green' | 'purple' | 'amber'> = {
    sms: 'blue', push: 'purple', email: 'green', whatsapp: 'amber',
  }

  return (
    <div className="space-y-6">
      {/* Contact Preferences */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Contact Preferences</h2>
          {!editingContact && (
            <Button variant="secondary" size="sm" onClick={() => setEditingContact(true)}>Edit</Button>
          )}
        </div>

        {editingContact ? (
          <div className="bg-white rounded-xl border border-brand-200 p-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Channel</label>
              <select value={contactChannel} onChange={(e) => setContactChannel(e.target.value)} className={cls}>
                {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</label>
              <textarea
                value={contactNotes}
                onChange={(e) => setContactNotes(e.target.value)}
                placeholder="Any special contact instructions…"
                rows={2}
                className={`w-full ${cls} resize-none`}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" size="sm" onClick={() => setEditingContact(false)}>Cancel</Button>
              <Button size="sm" loading={saveContactMutation.isPending} onClick={() => saveContactMutation.mutate()}>Save</Button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            {(patient.contactPrefs as any)?.channel ? (
              <>
                <Badge variant={CHANNEL_VARIANT[(patient.contactPrefs as any).channel] ?? 'gray'}>
                  {CHANNEL_LABELS[(patient.contactPrefs as any).channel] ?? (patient.contactPrefs as any).channel}
                </Badge>
                {(patient.contactPrefs as any)?.notes && (
                  <p className="text-sm text-gray-600">{(patient.contactPrefs as any).notes}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400">No contact preference set</p>
            )}
          </div>
        )}
      </section>

      {/* Recall Rules */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Recall Rules</h2>
          {!showAdd && (
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="w-3.5 h-3.5" /> Set Recall
            </Button>
          )}
        </div>

        {showAdd && (
          <div className="bg-white rounded-xl border border-brand-200 p-4 space-y-3 mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">New Recall Rule</p>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={newInterval}
                onChange={(e) => setNewInterval(e.target.value)}
                placeholder="Interval (days)"
                min={1}
                className={`${cls} w-36`}
                autoFocus
              />
              <span className="text-sm text-gray-500">days</span>
            </div>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Diagnosis note (optional)…"
              rows={2}
              className={`w-full ${cls} resize-none`}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button
                size="sm"
                disabled={!newInterval || parseInt(newInterval) < 1}
                loading={addMutation.isPending}
                onClick={() => addMutation.mutate()}
              >
                Save Rule
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="py-6 text-center text-sm text-gray-400">Loading…</div>
        ) : rules.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">No recall rules set</div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div key={rule.id} className={`bg-white rounded-xl border px-4 py-3 flex items-center gap-3 ${rule.active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant={rule.active ? 'green' : 'gray'}>{rule.active ? 'Active' : 'Inactive'}</Badge>
                    <span className="text-sm font-medium text-gray-900">Every {rule.intervalDays} days</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Next due: <span className="font-medium">{new Date(rule.nextDueAt).toLocaleDateString()}</span>
                  </p>
                  {rule.diagnosisNote && <p className="text-xs text-gray-400 mt-0.5 truncate">{rule.diagnosisNote}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => toggleMutation.mutate({ id: rule.id, active: !rule.active })}
                    className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 hover:border-brand-400 hover:text-brand-600 transition-colors text-gray-500"
                  >
                    {rule.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(rule.id)}
                    className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 hover:border-red-300 hover:text-red-600 transition-colors text-gray-400"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function AddLabInline({ patientId, onDone }: { patientId: string; onDone: () => void }) {
  const [form, setForm] = useState({ testName: '', value: '', unit: '', referenceRangeLow: '', referenceRangeHigh: '' })

  const mutation = useMutation({
    mutationFn: () => api.post('/labs', {
      patientId,
      testName: form.testName,
      value: form.value,
      unit: form.unit,
      referenceRangeLow: form.referenceRangeLow ? parseFloat(form.referenceRangeLow) : undefined,
      referenceRangeHigh: form.referenceRangeHigh ? parseFloat(form.referenceRangeHigh) : undefined,
      reportedAt: new Date().toISOString(),
    }),
    onSuccess: onDone,
  })

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [k]: e.target.value }))
  const cls = 'px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="bg-white rounded-xl border border-brand-200 p-4 space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add lab result</p>
      <div className="flex gap-2">
        <input value={form.testName} onChange={f('testName')} placeholder="Test name" className={`${cls} flex-1`} autoFocus />
        <input value={form.value} onChange={f('value')} placeholder="Value" className={`${cls} w-20`} />
        <input value={form.unit} onChange={f('unit')} placeholder="Unit" className={`${cls} w-20`} />
      </div>
      <div className="flex gap-2 items-center">
        <span className="text-xs text-gray-400">Ref range:</span>
        <input value={form.referenceRangeLow} onChange={f('referenceRangeLow')} placeholder="Low" type="number" className={`${cls} w-20`} />
        <span className="text-xs text-gray-400">—</span>
        <input value={form.referenceRangeHigh} onChange={f('referenceRangeHigh')} placeholder="High" type="number" className={`${cls} w-20`} />
        <Button size="sm" className="ml-auto" disabled={!form.testName || !form.value} loading={mutation.isPending} onClick={() => mutation.mutate()}>Save</Button>
      </div>
    </div>
  )
}
