import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, Plus, ChevronRight, X } from 'lucide-react'
import { api } from '../lib/api'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'

type Urgency = 'ROUTINE' | 'URGENT' | 'EMERGENCY'
type ConsultStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'COMPLETED'

interface ConsultMessage {
  id: string
  authorId: string
  authorName: string
  body: string
  createdAt: string
}

interface Consult {
  id: string
  patientMrNumber: string
  fromUserName: string
  toUserName: string
  urgency: Urgency
  status: ConsultStatus
  notes?: string
  createdAt: string
  messages?: ConsultMessage[]
}

const URGENCY_BADGE: Record<Urgency, 'red' | 'amber' | 'gray'> = {
  EMERGENCY: 'red',
  URGENT: 'amber',
  ROUTINE: 'gray',
}

const STATUS_BADGE: Record<ConsultStatus, 'green' | 'red' | 'blue' | 'gray'> = {
  ACCEPTED: 'green',
  DECLINED: 'red',
  COMPLETED: 'blue',
  PENDING: 'gray',
}

function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  return <Badge variant={URGENCY_BADGE[urgency]}>{urgency}</Badge>
}

function StatusBadge({ status }: { status: ConsultStatus }) {
  return <Badge variant={STATUS_BADGE[status]}>{status}</Badge>
}

interface NewReferralForm {
  patientId: string
  toUserId: string
  urgency: Urgency
  notes: string
}

function NewReferralModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<NewReferralForm>({ patientId: '', toUserId: '', urgency: 'ROUTINE', notes: '' })

  const mutation = useMutation({
    mutationFn: (data: NewReferralForm) => api.post('/consults', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consults'] })
      onClose()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(form)
  }

  return (
    <Modal title="New Referral" onClose={onClose}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Patient MR#</label>
            <input
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g. MR-00123"
              value={form.patientId}
              onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Refer to (Doctor User ID)</label>
            <input
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Doctor user ID"
              value={form.toUserId}
              onChange={(e) => setForm((f) => ({ ...f, toUserId: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Urgency</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              value={form.urgency}
              onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.value as Urgency }))}
            >
              <option value="ROUTINE">Routine</option>
              <option value="URGENT">Urgent</option>
              <option value="EMERGENCY">Emergency</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Clinical notes</label>
            <textarea
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              placeholder="Reason for referral, relevant history…"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          {mutation.error && (
            <p className="text-xs text-red-600">Failed to submit referral. Please try again.</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending}>Send Referral</Button>
          </div>
        </form>
    </Modal>
  )
}

function ConsultThread({ consult, onClose, isIncoming }: { consult: Consult; onClose: () => void; isIncoming: boolean }) {
  const qc = useQueryClient()
  const [reply, setReply] = useState('')

  const messageMutation = useMutation({
    mutationFn: (body: string) => api.post(`/consults/${consult.id}/messages`, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consults'] })
      setReply('')
    },
  })

  const statusMutation = useMutation({
    mutationFn: (status: ConsultStatus) => api.patch(`/consults/${consult.id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['consults'] }),
  })

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl border-l border-gray-200 flex flex-col z-40">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div>
          <p className="text-sm font-semibold text-gray-900">MR# {consult.patientMrNumber}</p>
          <p className="text-xs text-gray-500">{consult.fromUserName} → {consult.toUserName}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
      </div>

      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        <UrgencyBadge urgency={consult.urgency} />
        <StatusBadge status={consult.status} />
        {isIncoming && consult.status === 'PENDING' && (
          <>
            <Button size="sm" onClick={() => statusMutation.mutate('ACCEPTED')} disabled={statusMutation.isPending}>Accept</Button>
            <Button size="sm" variant="danger" onClick={() => statusMutation.mutate('DECLINED')} disabled={statusMutation.isPending}>Decline</Button>
          </>
        )}
        {consult.status === 'ACCEPTED' && (
          <Button size="sm" variant="secondary" onClick={() => statusMutation.mutate('COMPLETED')} disabled={statusMutation.isPending}>Mark Complete</Button>
        )}
      </div>

      {consult.notes && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-xs text-gray-500 mb-1 font-medium">Notes</p>
          <p className="text-sm text-gray-700">{consult.notes}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {(consult.messages ?? []).length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-8">No messages yet</p>
        )}
        {(consult.messages ?? []).map((msg) => (
          <div key={msg.id} className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-700 mb-1">{msg.authorName}</p>
            <p className="text-sm text-gray-800">{msg.body}</p>
            <p className="text-xs text-gray-400 mt-1">{new Date(msg.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-gray-200 flex gap-2">
        <input
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Reply…"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && reply.trim()) { e.preventDefault(); messageMutation.mutate(reply.trim()) } }}
        />
        <button
          className="p-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
          disabled={!reply.trim() || messageMutation.isPending}
          onClick={() => messageMutation.mutate(reply.trim())}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function ConsultCard({ consult, onClick }: { consult: Consult; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-brand-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-semibold text-gray-900">MR# {consult.patientMrNumber}</p>
            <UrgencyBadge urgency={consult.urgency} />
            <StatusBadge status={consult.status} />
          </div>
          <p className="text-xs text-gray-500">{consult.fromUserName} → {consult.toUserName}</p>
          {consult.notes && <p className="text-xs text-gray-400 mt-1 truncate">{consult.notes}</p>}
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <p className="text-xs text-gray-400">{new Date(consult.createdAt).toLocaleDateString()}</p>
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
        </div>
      </div>
    </button>
  )
}

type Tab = 'incoming' | 'outgoing'

export default function ConsultsPage() {
  const [tab, setTab] = useState<Tab>('incoming')
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState<Consult | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['consults'],
    queryFn: () => api.get<{ data: Consult[] }>('/consults').then((r) => r.data.data),
    // API returns 501 until Consult model is added — gracefully fall back to empty
    retry: false,
  })

  const consults = data ?? []

  // Split by direction — the API will provide direction context once implemented
  // For now we show all under each tab as a passthrough (stub API returns 501 → empty list)
  const incoming = consults.filter((c) => c.status !== undefined)
  const outgoing = consults.filter((c) => c.status !== undefined)

  return (
    <div className="p-6 relative">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Consults & Referrals</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your incoming and outgoing referrals</p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-1.5" />New Referral
        </Button>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-5">
        {(['incoming', 'outgoing'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner className="w-6 h-6 text-brand-500" /></div>
      ) : (
        <div className="space-y-3 max-w-2xl">
          {(tab === 'incoming' ? incoming : outgoing).length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 px-6 py-12 text-center">
              <p className="text-sm text-gray-400">No {tab} consults</p>
              <p className="text-xs text-gray-300 mt-1">Consult model pending schema migration</p>
            </div>
          ) : (
            (tab === 'incoming' ? incoming : outgoing).map((c) => (
              <ConsultCard key={c.id} consult={c} onClick={() => setSelected(c)} />
            ))
          )}
        </div>
      )}

      {showNew && <NewReferralModal onClose={() => setShowNew(false)} />}

      {selected && (
        <ConsultThread
          consult={selected}
          isIncoming={tab === 'incoming'}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
