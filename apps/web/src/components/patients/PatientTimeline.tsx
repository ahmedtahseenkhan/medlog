import { useQuery } from '@tanstack/react-query'
import { FileText, FlaskConical, ClipboardList, Pill, ImageIcon } from 'lucide-react'
import { format } from 'date-fns'
import { api } from '../../lib/api'
import type { ApiResponse, ClinicalNote, Task, LabReport } from '@medlog/types'

type TimelineEntry =
  | { kind: 'note'; date: string; data: ClinicalNote }
  | { kind: 'task'; date: string; data: Task }
  | { kind: 'lab'; date: string; data: LabReport }

const icons = {
  note: { Icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50' },
  task: { Icon: ClipboardList, color: 'text-amber-500', bg: 'bg-amber-50' },
  lab: { Icon: FlaskConical, color: 'text-purple-500', bg: 'bg-purple-50' },
  medication: { Icon: Pill, color: 'text-green-500', bg: 'bg-green-50' },
  radiology: { Icon: ImageIcon, color: 'text-gray-500', bg: 'bg-gray-100' },
}

export function PatientTimeline({ patientId }: { patientId: string }) {
  const { data: notesData } = useQuery({
    queryKey: ['notes', patientId],
    queryFn: () => api.get<ApiResponse<ClinicalNote[]>>(`/notes/patient/${patientId}`).then((r) => r.data),
  })
  const { data: tasksData } = useQuery({
    queryKey: ['tasks', patientId],
    queryFn: () => api.get<ApiResponse<Task[]>>(`/tasks/patient/${patientId}`).then((r) => r.data),
  })
  const { data: labsData } = useQuery({
    queryKey: ['labs', patientId],
    queryFn: () => api.get<ApiResponse<LabReport[]>>(`/labs/patient/${patientId}`).then((r) => r.data),
  })

  const entries: TimelineEntry[] = [
    ...(notesData?.data ?? []).map((d) => ({ kind: 'note' as const, date: d.createdAt, data: d })),
    ...(tasksData?.data ?? []).map((d) => ({ kind: 'task' as const, date: d.createdAt, data: d })),
    ...(labsData?.data ?? []).map((d) => ({ kind: 'lab' as const, date: d.createdAt, data: d })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (!entries.length) {
    return <div className="py-10 text-center text-sm text-gray-400">No activity recorded yet</div>
  }

  return (
    <div className="relative space-y-0">
      {entries.map((entry, i) => {
        const { Icon, color, bg } = icons[entry.kind]
        return (
          <div key={`${entry.kind}-${i}`} className="flex gap-3 group">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full ${bg} flex items-center justify-center flex-shrink-0 z-10`}>
                <Icon className={`w-3.5 h-3.5 ${color}`} />
              </div>
              {i < entries.length - 1 && <div className="w-px flex-1 bg-gray-200 my-1" />}
            </div>
            <div className="pb-4 flex-1 min-w-0">
              <TimelineCard entry={entry} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TimelineCard({ entry }: { entry: TimelineEntry }) {
  const dateStr = format(new Date(entry.date), 'dd MMM yyyy, HH:mm')

  if (entry.kind === 'note') {
    const note = entry.data
    const c = note.content as Record<string, string>
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-3 hover:border-gray-300 transition-colors">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">{note.type} Note</span>
          <span className="text-xs text-gray-400">{dateStr}</span>
        </div>
        {note.type === 'SOAP' ? (
          <div className="space-y-1">
            {c.assessment && <p className="text-sm text-gray-800"><span className="font-medium text-gray-500">A:</span> {c.assessment}</p>}
            {c.plan && <p className="text-sm text-gray-800"><span className="font-medium text-gray-500">P:</span> {c.plan}</p>}
          </div>
        ) : (
          <p className="text-sm text-gray-700 line-clamp-2">{c.freeText ?? c.handoverSummary ? 'Handover summary' : ''}</p>
        )}
      </div>
    )
  }

  if (entry.kind === 'task') {
    const task = entry.data
    const priorityColor = { LOW: 'text-gray-500', MEDIUM: 'text-blue-600', HIGH: 'text-amber-600', URGENT: 'text-red-600' }
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${task.status === 'DONE' ? 'bg-brand-500' : task.status === 'IN_PROGRESS' ? 'bg-amber-400' : 'bg-gray-300'}`} />
            <span className={`text-sm font-medium ${task.status === 'DONE' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{task.title}</span>
          </div>
          <span className={`text-xs font-medium ${priorityColor[task.priority]}`}>{task.priority}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1 ml-4">{dateStr}</p>
      </div>
    )
  }

  if (entry.kind === 'lab') {
    const lab = entry.data
    return (
      <div className={`bg-white border rounded-xl p-3 ${lab.isCritical ? 'border-red-300' : lab.isAbnormal ? 'border-amber-300' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-gray-900">{lab.testName}</span>
            <span className={`ml-2 text-sm ${lab.isAbnormal ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
              {lab.value} {lab.unit}
            </span>
            {lab.isCritical && <span className="ml-2 text-xs font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">CRITICAL</span>}
          </div>
          <span className="text-xs text-gray-400">{dateStr}</span>
        </div>
      </div>
    )
  }

  return null
}
