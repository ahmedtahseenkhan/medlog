import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import { Users, ClipboardList, AlertTriangle, Activity } from 'lucide-react'
import type { ApiResponse, Patient } from '@medlog/types'

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)

  const { data: patientsData } = useQuery({
    queryKey: ['patients', 'summary'],
    queryFn: () => api.get<ApiResponse<Patient[]>>('/patients?pageSize=5').then((r) => r.data),
  })

  const patients = patientsData?.data ?? []
  const total = patientsData?.meta?.total ?? 0

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Good morning, {user?.name?.split(' ')[0]}</h1>
        <p className="text-sm text-gray-500 mt-0.5">Here's your ward overview</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard icon={Users} label="Active Patients" value={String(total)} color="brand" />
        <StatCard icon={ClipboardList} label="Pending Tasks" value="—" color="warning" />
        <StatCard icon={AlertTriangle} label="Critical Labs" value="—" color="danger" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-900">Recent patients</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {patients.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">No patients yet</div>
          ) : (
            patients.map((p) => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">MR# {p.mrNumber}</p>
                  <p className="text-xs text-gray-500">{p.admissionDiagnosis ?? 'No diagnosis recorded'}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  p.status === 'ADMITTED' ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {p.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: 'brand' | 'warning' | 'danger' }) {
  const colors = {
    brand: 'bg-brand-50 text-brand-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}
