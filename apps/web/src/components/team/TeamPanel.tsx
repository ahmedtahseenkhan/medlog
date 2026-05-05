import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Users, Mail, Trash2, Crown, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/auth'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Modal } from '../ui/Modal'

interface TeamMember { id: string; name: string; email: string; role: string; lastLoginAt?: string }
interface TeamData { id: string; name: string; members: TeamMember[] }
interface PendingInvite { id: string; email: string; role: string; expiresAt: string }

const roleVariant: Record<string, 'purple' | 'blue' | 'gray'> = {
  CONSULTANT: 'purple', RESIDENT: 'blue', INTERN: 'gray', ADMIN: 'red' as 'gray',
}

export function TeamPanel() {
  const user = useAuthStore((s) => s.user)
  const isLead = user?.role === 'CONSULTANT' || user?.role === 'ADMIN'
  const [showInvite, setShowInvite] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const qc = useQueryClient()

  const { data: teamData, isLoading } = useQuery({
    queryKey: ['team'],
    queryFn: () => api.get<{ data: TeamData }>('/teams/me').then((r) => r.data.data),
    retry: false,
  })

  const { data: invitesData } = useQuery({
    queryKey: ['team-invites'],
    queryFn: () => api.get<{ data: PendingInvite[] }>('/teams/invites').then((r) => r.data.data),
    enabled: isLead && !!teamData,
  })

  const removeMember = useMutation({
    mutationFn: (userId: string) => api.delete(`/teams/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  })

  if (isLoading) return <div className="text-sm text-gray-400 p-4">Loading team…</div>

  if (!teamData) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <Users className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700 mb-1">You're not in a team yet</p>
          <p className="text-xs text-gray-400 mb-4">Ask your consultant to invite you, or create a team if you're a consultant.</p>
          {isLead && (
            <Button onClick={() => setShowCreate(true)}>
              <Users className="w-3.5 h-3.5" /> Create team
            </Button>
          )}
        </div>
        {showCreate && <CreateTeamModal onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['team'] }) }} />}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Team header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{teamData.name}</h2>
            <p className="text-xs text-gray-400">{teamData.members.length} member{teamData.members.length !== 1 ? 's' : ''}</p>
          </div>
          {isLead && (
            <Button size="sm" onClick={() => setShowInvite(true)}>
              <UserPlus className="w-3.5 h-3.5" /> Invite
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {teamData.members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
              <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-brand-700">{m.name.slice(0, 2).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                  {m.id === user?.id && <span className="text-xs text-gray-400">(you)</span>}
                </div>
                <p className="text-xs text-gray-400 truncate">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={roleVariant[m.role] ?? 'gray'}>{m.role}</Badge>
                {m.lastLoginAt && (
                  <span className="text-xs text-gray-300" title={`Last login: ${new Date(m.lastLoginAt).toLocaleString()}`}>
                    <Clock className="w-3 h-3" />
                  </span>
                )}
                {isLead && m.id !== user?.id && (
                  <button onClick={() => removeMember.mutate(m.id)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending invites */}
      {isLead && invitesData && invitesData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Pending invites</p>
          <div className="space-y-2">
            {invitesData.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-gray-300 flex-shrink-0" />
                <span className="flex-1 text-gray-700">{inv.email}</span>
                <Badge variant={roleVariant[inv.role] ?? 'gray'}>{inv.role}</Badge>
                <span className="text-xs text-gray-400">Expires {format(new Date(inv.expiresAt), 'dd MMM HH:mm')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSuccess={() => { setShowInvite(false); qc.invalidateQueries({ queryKey: ['team-invites'] }) }}
        />
      )}
    </div>
  )
}

function CreateTeamModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('')
  const mutation = useMutation({
    mutationFn: () => api.post('/teams', { name }),
    onSuccess,
  })
  return (
    <Modal title="Create team" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Team name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. General Medicine Team A" autoFocus />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" disabled={!name.trim()} loading={mutation.isPending} onClick={() => mutation.mutate()}>Create</Button>
        </div>
      </div>
    </Modal>
  )
}

function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'RESIDENT' | 'INTERN'>('RESIDENT')
  const [result, setResult] = useState<{ acceptUrl: string } | null>(null)

  const mutation = useMutation({
    mutationFn: () => api.post<{ data: { acceptUrl: string } }>('/teams/invite', { email, role }),
    onSuccess: (res) => setResult(res.data.data),
  })

  return (
    <Modal title="Invite team member" onClose={onClose}>
      {result ? (
        <div className="space-y-3">
          <div className="bg-brand-50 rounded-lg p-3">
            <p className="text-xs font-medium text-brand-700 mb-1">Invite link (valid 48 hours)</p>
            <p className="text-xs text-brand-600 break-all font-mono">{result.acceptUrl}</p>
          </div>
          <p className="text-xs text-gray-500">Share this link with {email}. In production this would be emailed automatically.</p>
          <Button className="w-full" onClick={onSuccess}>Done</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email address</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={inputCls} placeholder="colleague@hospital.org" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as 'RESIDENT' | 'INTERN')} className={inputCls}>
              <option value="RESIDENT">Resident</option>
              <option value="INTERN">Intern</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" disabled={!email.trim()} loading={mutation.isPending} onClick={() => mutation.mutate()}>Send invite</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
