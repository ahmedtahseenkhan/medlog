import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Plus, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AppointmentDoctor { id: string; name: string; role: string }
interface AppointmentPatient { id: string; mrNumber: string }

interface Appointment {
  id: string
  patientId: string
  patient: AppointmentPatient
  doctorId: string
  doctor: AppointmentDoctor
  type: string
  status: string
  scheduledAt: string
  durationMins: number
  notes?: string
  createdAt: string
}

interface TeamMember { id: string; name: string; role: string }
interface Patient { id: string; mrNumber: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  FOLLOW_UP: 'Follow-up',
  REVIEW: 'Review',
  PROCEDURE: 'Procedure',
  CONSULTATION: 'Consultation',
  DISCHARGE_REVIEW: 'Discharge Review',
}

const TYPE_BADGE: Record<string, 'blue' | 'purple' | 'amber' | 'green' | 'gray'> = {
  FOLLOW_UP: 'blue',
  REVIEW: 'purple',
  PROCEDURE: 'amber',
  CONSULTATION: 'green',
  DISCHARGE_REVIEW: 'gray',
}

const STATUS_BADGE: Record<string, 'green' | 'gray' | 'red' | 'amber'> = {
  SCHEDULED: 'blue' as any,
  COMPLETED: 'green',
  CANCELLED: 'red',
  NO_SHOW: 'amber',
}

function fmtTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function isToday(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function groupByDate(appointments: Appointment[]) {
  const groups: Record<string, Appointment[]> = {}
  for (const appt of appointments) {
    const key = new Date(appt.scheduledAt).toDateString()
    if (!groups[key]) groups[key] = []
    groups[key].push(appt)
  }
  return groups
}

function getDateRange(range: string): { from: string; to: string } {
  const now = new Date()
  const start = new Date(now)
  const end = new Date(now)

  if (range === 'today') {
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
  } else if (range === 'week') {
    start.setHours(0, 0, 0, 0)
    end.setDate(end.getDate() + 7)
    end.setHours(23, 59, 59, 999)
  } else {
    start.setHours(0, 0, 0, 0)
    end.setDate(end.getDate() + 30)
    end.setHours(23, 59, 59, 999)
  }

  return { from: start.toISOString(), to: end.toISOString() }
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const qc = useQueryClient()
  const [range, setRange] = useState<'today' | 'week' | 'month'>('week')
  const [statusFilter, setStatusFilter] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null)

  const { from, to } = getDateRange(range)

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', range, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ from, to })
      if (statusFilter) params.set('status', statusFilter)
      return api.get(`/appointments?${params}`).then((r) => r.data.data as Appointment[])
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, any> }) =>
      api.patch(`/appointments/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
  })

  const appointments = data ?? []
  const todayAppts = appointments.filter((a) => isToday(a.scheduledAt))
  const laterAppts = appointments.filter((a) => !isToday(a.scheduledAt))
  const laterGroups = groupByDate(laterAppts)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-500" />
            <h1 className="text-lg font-semibold text-gray-900">Appointments</h1>
          </div>
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="w-3.5 h-3.5" /> New Appointment
          </Button>
        </div>

        {/* Filters */}
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          {/* Date range */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {(['today', 'week', 'month'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 font-medium transition-colors ${range === r ? 'bg-brand-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {r === 'today' ? 'Today' : r === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="NO_SHOW">No Show</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading appointments…</div>
        ) : (
          <>
            {/* Today section */}
            {todayAppts.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-brand-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Today — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h2>
                <div className="space-y-2 rounded-xl border border-brand-200 bg-brand-50/30 p-3">
                  {todayAppts.map((a) => (
                    <AppointmentCard
                      key={a.id}
                      appt={a}
                      onComplete={() => updateMutation.mutate({ id: a.id, data: { status: 'COMPLETED' } })}
                      onCancel={() => updateMutation.mutate({ id: a.id, data: { status: 'CANCELLED' } })}
                      onReschedule={() => setRescheduleAppt(a)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming grouped by date */}
            {Object.entries(laterGroups).map(([dateKey, appts]) => (
              <section key={dateKey}>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {fmtDate(appts[0].scheduledAt)}
                </h2>
                <div className="space-y-2">
                  {appts.map((a) => (
                    <AppointmentCard
                      key={a.id}
                      appt={a}
                      onComplete={() => updateMutation.mutate({ id: a.id, data: { status: 'COMPLETED' } })}
                      onCancel={() => updateMutation.mutate({ id: a.id, data: { status: 'CANCELLED' } })}
                      onReschedule={() => setRescheduleAppt(a)}
                    />
                  ))}
                </div>
              </section>
            ))}

            {appointments.length === 0 && (
              <div className="py-16 text-center">
                <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No appointments found</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* New Appointment Modal */}
      {showNew && (
        <NewAppointmentModal
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ['appointments'] }) }}
        />
      )}

      {/* Reschedule Modal */}
      {rescheduleAppt && (
        <RescheduleModal
          appt={rescheduleAppt}
          onClose={() => setRescheduleAppt(null)}
          onSaved={() => { setRescheduleAppt(null); qc.invalidateQueries({ queryKey: ['appointments'] }) }}
        />
      )}
    </div>
  )
}

// ── Appointment Card ──────────────────────────────────────────────────────────

function AppointmentCard({ appt, onComplete, onCancel, onReschedule }: {
  appt: Appointment
  onComplete: () => void
  onCancel: () => void
  onReschedule: () => void
}) {
  const isActive = appt.status === 'SCHEDULED'

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-4">
      <div className="text-center min-w-[56px]">
        <p className="text-base font-bold text-gray-900 tabular-nums">{fmtTime(appt.scheduledAt)}</p>
        <p className="text-xs text-gray-400">{appt.durationMins}min</p>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-semibold text-gray-900">MR# {appt.patient.mrNumber}</span>
          <Badge variant={TYPE_BADGE[appt.type] ?? 'gray'}>{TYPE_LABELS[appt.type] ?? appt.type}</Badge>
          <Badge variant={STATUS_BADGE[appt.status] ?? 'gray'}>{appt.status}</Badge>
        </div>
        <p className="text-xs text-gray-500">Dr. {appt.doctor.name}</p>
        {appt.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{appt.notes}</p>}
      </div>

      {isActive && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onComplete}
            title="Mark complete"
            className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
          </button>
          <button
            onClick={onReschedule}
            title="Reschedule"
            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onCancel}
            title="Cancel"
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── New Appointment Modal ─────────────────────────────────────────────────────

function NewAppointmentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    patientMR: '',
    doctorId: '',
    type: 'FOLLOW_UP',
    scheduledAt: '',
    durationMins: '15',
    notes: '',
  })
  const [patientId, setPatientId] = useState('')
  const [patientError, setPatientError] = useState('')

  const { data: teamData } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => api.get('/teams/members').then((r) => r.data.data as TeamMember[]),
  })

  const lookupMutation = useMutation({
    mutationFn: (mr: string) =>
      api.get(`/patients?mrNumber=${mr}`).then((r) => {
        const list = r.data.data as Patient[]
        return list.find((p) => p.mrNumber === mr)
      }),
    onSuccess: (patient) => {
      if (patient) {
        setPatientId(patient.id)
        setPatientError('')
      } else {
        setPatientId('')
        setPatientError('Patient not found')
      }
    },
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/appointments', {
      patientId,
      doctorId: form.doctorId,
      type: form.type,
      scheduledAt: new Date(form.scheduledAt).toISOString(),
      durationMins: parseInt(form.durationMins),
      notes: form.notes || undefined,
    }),
    onSuccess: onCreated,
  })

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }))

  const cls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
  const canSubmit = patientId && form.doctorId && form.scheduledAt

  return (
    <Modal title="New Appointment" onClose={onClose}>
      <div className="space-y-4 min-w-[400px]">
        {/* Patient MR# lookup */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Patient MR#</label>
          <div className="flex gap-2">
            <input
              value={form.patientMR}
              onChange={f('patientMR')}
              placeholder="Enter MR number"
              className={`${cls} flex-1`}
              onKeyDown={(e) => { if (e.key === 'Enter' && form.patientMR) lookupMutation.mutate(form.patientMR) }}
            />
            <Button size="sm" variant="secondary" onClick={() => lookupMutation.mutate(form.patientMR)} loading={lookupMutation.isPending}>
              Lookup
            </Button>
          </div>
          {patientError && <p className="text-xs text-red-500 mt-1">{patientError}</p>}
          {patientId && !patientError && <p className="text-xs text-green-600 mt-1">Patient found</p>}
        </div>

        {/* Doctor */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Doctor</label>
          <select value={form.doctorId} onChange={f('doctorId')} className={cls}>
            <option value="">Select doctor…</option>
            {(teamData ?? []).map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
            ))}
          </select>
        </div>

        {/* Type */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Appointment Type</label>
          <select value={form.type} onChange={f('type')} className={cls}>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {/* Date & Time */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Date & Time</label>
          <input type="datetime-local" value={form.scheduledAt} onChange={f('scheduledAt')} className={cls} />
        </div>

        {/* Duration */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Duration</label>
          <select value={form.durationMins} onChange={f('durationMins')} className={cls}>
            {['15', '30', '45', '60'].map((d) => <option key={d} value={d}>{d} minutes</option>)}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes (optional)</label>
          <textarea value={form.notes} onChange={f('notes')} placeholder="Additional notes…" rows={2} className={`${cls} resize-none`} />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            disabled={!canSubmit}
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Schedule Appointment
          </Button>
        </div>

        {createMutation.isError && (
          <p className="text-xs text-red-500">Failed to create appointment. Please try again.</p>
        )}
      </div>
    </Modal>
  )
}

// ── Reschedule Modal ──────────────────────────────────────────────────────────

function RescheduleModal({ appt, onClose, onSaved }: { appt: Appointment; onClose: () => void; onSaved: () => void }) {
  const [scheduledAt, setScheduledAt] = useState(
    new Date(appt.scheduledAt).toISOString().slice(0, 16)
  )

  const mutation = useMutation({
    mutationFn: () => api.patch(`/appointments/${appt.id}`, { scheduledAt: new Date(scheduledAt).toISOString() }),
    onSuccess: onSaved,
  })

  return (
    <Modal title="Reschedule Appointment" onClose={onClose}>
      <div className="space-y-4 min-w-[320px]">
        <p className="text-sm text-gray-600">Patient MR# {appt.patient.mrNumber}</p>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">New Date & Time</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={mutation.isPending} onClick={() => mutation.mutate()}>Save</Button>
        </div>
      </div>
    </Modal>
  )
}
