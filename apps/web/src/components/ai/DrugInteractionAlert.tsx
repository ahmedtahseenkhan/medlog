import { AlertTriangle, AlertOctagon, Info } from 'lucide-react'

export type InteractionSeverity = 'contraindicated' | 'major' | 'moderate' | 'minor'

export interface InteractionAlert {
  drug1: string
  drug2: string
  severity: InteractionSeverity
  description: string
}

const config: Record<InteractionSeverity, { icon: React.ElementType; bg: string; border: string; label: string; textColor: string }> = {
  contraindicated: { icon: AlertOctagon, bg: 'bg-red-50', border: 'border-red-300', label: 'Contraindicated', textColor: 'text-red-700' },
  major:           { icon: AlertTriangle, bg: 'bg-red-50', border: 'border-red-200', label: 'Major', textColor: 'text-red-600' },
  moderate:        { icon: AlertTriangle, bg: 'bg-amber-50', border: 'border-amber-200', label: 'Moderate', textColor: 'text-amber-700' },
  minor:           { icon: Info, bg: 'bg-blue-50', border: 'border-blue-200', label: 'Minor', textColor: 'text-blue-700' },
}

export function DrugInteractionAlert({ alerts }: { alerts: InteractionAlert[] }) {
  if (!alerts.length) return null
  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => {
        const { icon: Icon, bg, border, label, textColor } = config[alert.severity]
        return (
          <div key={i} className={`flex gap-3 rounded-xl border px-4 py-3 ${bg} ${border}`}>
            <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${textColor}`} />
            <div>
              <p className={`text-sm font-semibold ${textColor}`}>
                {label}: {alert.drug1} + {alert.drug2}
              </p>
              <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{alert.description}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
