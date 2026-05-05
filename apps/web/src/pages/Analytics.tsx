import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts'
import { Users, FileText, ClipboardList, Sparkles, ArrowUpRight } from 'lucide-react'
import { useAuthStore } from '../stores/auth'
import { api } from '../lib/api'
import { Badge } from '../components/ui/Badge'

type Period = 30 | 90

interface PersonalStats {
  period: { days: number }
  summary: {
    patientsManaged: number; notesWritten: number; tasksCreated: number
    tasksDone: number; taskCompletionRate: number | null; ddxSessions: number; handoversCommitted: number
  }
  activityByDay: { date: string; count: number }[]
}

interface MemberStat {
  userId: string; name: string; role: string
  patientsManaged: number; notesWritten: number; taskCompletionRate: number | null; handoversCommitted: number
}

interface TeamStats {
  period: { days: number }
  teamSummary: { admittedPatients: number; pendingTasks: number; criticalLabsThisPeriod: number }
  memberStats: MemberStat[]
}

export default function AnalyticsPage() {
  const user = useAuthStore((s) => s.user)
  const isLead = user?.role === 'CONSULTANT' || user?.role === 'ADMIN'
  const [period, setPeriod] = useState<Period>(30)
  const [view, setView] = useState<'personal' | 'team'>('personal')

  const { data: personal } = useQuery({
    queryKey: ['analytics', 'me', period],
    queryFn: () => api.get<{ data: PersonalStats }>(`/analytics/me?days=${period}`).then((r) => r.data.data),
  })

  const { data: team } = useQuery({
    queryKey: ['analytics', 'team', period],
    queryFn: () => api.get<{ data: TeamStats }>(`/analytics/team?days=${period}`).then((r) => r.data.data),
    enabled: isLead && view === 'team',
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your activity and team performance</p>
        </div>
        <div className="flex items-center gap-2">
          {isLead && (
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(['personal', 'team'] as const).map((v) => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  {v === 'personal' ? 'My stats' : 'Team'}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {([30, 90] as Period[]).map((d) => (
              <button key={d} onClick={() => setPeriod(d)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${period === d ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'personal' && personal && <PersonalView stats={personal} />}
      {view === 'team' && team && <TeamView stats={team} />}
    </div>
  )
}

function PersonalView({ stats }: { stats: PersonalStats }) {
  const s = stats.summary
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Patients managed" value={s.patientsManaged} icon={Users} color="brand" />
        <StatCard label="Notes written" value={s.notesWritten} icon={FileText} color="blue" />
        <StatCard label="Task completion" value={s.taskCompletionRate != null ? `${s.taskCompletionRate}%` : '—'} icon={ClipboardList} color="amber" />
        <StatCard label="AI DDx sessions" value={s.ddxSessions} icon={Sparkles} color="purple" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-4">Daily note activity (last 14 days)</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={stats.activityByDay} barSize={10}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} stroke="#E5E7EB" />
            <YAxis tick={{ fontSize: 10 }} stroke="#E5E7EB" allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }} labelFormatter={(v) => `Date: ${v}`} />
            <Bar dataKey="count" fill="#1D9E75" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <MiniStat label="Handovers" value={s.handoversCommitted} />
        <MiniStat label="Tasks created" value={s.tasksCreated} />
        <MiniStat label="Tasks done" value={s.tasksDone} />
      </div>
    </div>
  )
}

function TeamView({ stats }: { stats: TeamStats }) {
  const ts = stats.teamSummary
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Admitted patients" value={ts.admittedPatients} icon={Users} color="brand" />
        <StatCard label="Pending tasks" value={ts.pendingTasks} icon={ClipboardList} color="amber" />
        <StatCard label="Critical labs (period)" value={ts.criticalLabsThisPeriod} icon={ArrowUpRight} color="red" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-900">Member performance</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {stats.memberStats.map((m) => (
            <div key={m.userId} className="px-4 py-3 flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-gray-600">{m.name.slice(0, 2).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                <Badge variant={m.role === 'CONSULTANT' ? 'purple' : m.role === 'RESIDENT' ? 'blue' : 'gray'}>{m.role}</Badge>
              </div>
              <div className="hidden md:flex gap-6 text-center">
                <div><p className="text-sm font-semibold text-gray-900">{m.patientsManaged}</p><p className="text-xs text-gray-400">Patients</p></div>
                <div><p className="text-sm font-semibold text-gray-900">{m.notesWritten}</p><p className="text-xs text-gray-400">Notes</p></div>
                <div><p className="text-sm font-semibold text-gray-900">{m.taskCompletionRate != null ? `${m.taskCompletionRate}%` : '—'}</p><p className="text-xs text-gray-400">Tasks</p></div>
                <div><p className="text-sm font-semibold text-gray-900">{m.handoversCommitted}</p><p className="text-xs text-gray-400">Handovers</p></div>
              </div>
            </div>
          ))}
          {stats.memberStats.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">No activity this period</div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.ElementType; color: 'brand' | 'blue' | 'amber' | 'purple' | 'red' }) {
  const colors = { brand: 'bg-brand-50 text-brand-600', blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-600', purple: 'bg-purple-50 text-purple-600', red: 'bg-red-50 text-red-600' }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
      <p className="text-xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}
