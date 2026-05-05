import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Search, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { api } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'

const ACTION_COLORS: Record<string, 'red' | 'amber' | 'blue' | 'green' | 'gray' | 'purple'> = {
  LOGIN_SUCCESS: 'green', LOGIN_FAIL: 'red', LOGIN_AUTH0: 'green',
  MFA_ENABLED: 'blue', MFA_DISABLED: 'amber', MFA_FAIL: 'red',
  PATIENT_CREATE: 'blue', PATIENT_UPDATE: 'gray', PATIENT_DISCHARGE: 'amber', PATIENT_VIEW: 'gray',
  NOTE_CREATE: 'blue', LAB_CREATE: 'blue', MED_CREATE: 'blue',
  RADIOLOGY_AI_INTERPRET: 'purple', DDX_GENERATE: 'purple',
  DATA_EXPORT: 'amber', GDPR_ERASURE: 'red',
  HANDOVER_COMMIT: 'green',
}

interface LogEntry {
  id: string; createdAt: string; action: string; resourceType: string; resourceId: string
  ipAddress?: string; user: { name: string; email: string; role: string }
}

export default function AuditLogPage() {
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [resourceFilter, setResourceFilter] = useState('')
  const [page, setPage] = useState(1)

  const params = new URLSearchParams({
    page: String(page), pageSize: '50',
    ...(actionFilter ? { action: actionFilter } : {}),
    ...(resourceFilter ? { resourceType: resourceFilter } : {}),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, actionFilter, resourceFilter],
    queryFn: () => api.get<{ data: LogEntry[]; meta: { total: number; page: number; pageSize: number } }>(`/audit-logs?${params}`).then((r) => r.data),
    staleTime: 10_000,
  })

  const logs = (data?.data ?? []).filter((l) =>
    search ? [l.action, l.user.name, l.user.email, l.resourceId].join(' ').toLowerCase().includes(search.toLowerCase()) : true
  )

  async function downloadCsv() {
    const res = await api.get('/audit-logs/export', { responseType: 'blob' })
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a'); a.href = url; a.download = `audit-log-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Audit log</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.meta?.total?.toLocaleString() ?? '—'} entries · 7-year retention</p>
        </div>
        <Button variant="secondary" size="sm" onClick={downloadCsv}>
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by user, action, resource…"
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">All actions</option>
          {['LOGIN_SUCCESS', 'LOGIN_FAIL', 'PATIENT_CREATE', 'PATIENT_VIEW', 'NOTE_CREATE', 'DATA_EXPORT', 'GDPR_ERASURE', 'DDX_GENERATE'].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select value={resourceFilter} onChange={(e) => { setResourceFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">All resources</option>
          {['USER', 'PATIENT', 'NOTE', 'LAB', 'MEDICATION', 'RADIOLOGY', 'TEAM'].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Timestamp</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Resource</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No log entries found</td></tr>
              ) : logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap font-mono">
                    {format(new Date(log.createdAt), 'dd MMM yy HH:mm:ss')}
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-900">{log.user.name}</p>
                    <p className="text-xs text-gray-400">{log.user.email}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={ACTION_COLORS[log.action] ?? 'gray'}>{log.action}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="text-gray-700">{log.resourceType}</p>
                    <p className="text-xs text-gray-400 font-mono truncate max-w-32">{log.resourceId}</p>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">{log.ipAddress ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.meta.total > data.meta.pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {((page - 1) * data.meta.pageSize) + 1}–{Math.min(page * data.meta.pageSize, data.meta.total)} of {data.meta.total.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page * data.meta.pageSize >= data.meta.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
