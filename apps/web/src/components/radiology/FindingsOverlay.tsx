import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Sparkles, AlertTriangle, Info, Loader2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { api } from '../../lib/api'

interface Finding {
  label: string
  confidence: number
  severity: 'normal' | 'mild' | 'moderate' | 'severe'
  boundingBox?: { x: number; y: number; width: number; height: number }
}

interface Interpretation {
  modality: string
  bodyPart: string
  findings: Finding[]
  impression: string
  urgency: 'routine' | 'urgent' | 'emergent'
  provider: string
  disclaimer: string
}

const severityColor = {
  normal: '#1D9E75',
  mild: '#F59E0B',
  moderate: '#EF4444',
  severe: '#7C3AED',
}

const urgencyVariant: Record<string, 'green' | 'amber' | 'red'> = {
  routine: 'green', urgent: 'amber', emergent: 'red',
}

interface Props {
  imageId: string
  imageWidth: number
  imageHeight: number
  displayWidth: number
  displayHeight: number
}

export function FindingsOverlay({ imageId, imageWidth, imageHeight, displayWidth, displayHeight }: Props) {
  const [showOverlay, setShowOverlay] = useState(true)

  const { data: existingData } = useQuery({
    queryKey: ['radiology-ai', imageId],
    queryFn: () => api.get<{ data: Interpretation | null }>(`/radiology-ai/result/${imageId}`).then((r) => r.data),
    staleTime: Infinity,
  })

  const interpret = useMutation({
    mutationFn: () => api.post<{ data: Interpretation }>(`/radiology-ai/interpret/${imageId}`),
  })

  const interpretation = interpret.data?.data.data ?? existingData?.data

  if (!interpretation && !interpret.isPending) {
    return (
      <div className="mt-3">
        <Button size="sm" variant="secondary" onClick={() => interpret.mutate()} className="w-full">
          <Sparkles className="w-3.5 h-3.5 text-purple-500" /> Analyse with AI
        </Button>
      </div>
    )
  }

  if (interpret.isPending) {
    return (
      <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Analysing image…
      </div>
    )
  }

  if (!interpretation) return null

  const scaleX = displayWidth / (imageWidth || displayWidth)
  const scaleY = displayHeight / (imageHeight || displayHeight)

  return (
    <div className="mt-3 space-y-3">
      {/* Disclaimer */}
      <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <Info className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">{interpretation.disclaimer}</p>
      </div>

      {/* Urgency + impression */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant={urgencyVariant[interpretation.urgency] ?? 'gray'}>
            {interpretation.urgency.toUpperCase()}
          </Badge>
          <span className="text-xs text-gray-400">{interpretation.provider === 'claude' ? 'Claude Vision' : 'Infermedica'}</span>
          <button onClick={() => setShowOverlay((s) => !s)} className="ml-auto text-xs text-brand-600 hover:underline">
            {showOverlay ? 'Hide' : 'Show'} overlay
          </button>
        </div>
        <p className="text-sm text-gray-700">{interpretation.impression}</p>
      </div>

      {/* Findings list */}
      {interpretation.findings.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Findings ({interpretation.findings.length})
            </p>
          </div>
          {interpretation.findings.map((f, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 last:border-0">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: severityColor[f.severity] }}
              />
              <span className="flex-1 text-sm text-gray-800">{f.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{Math.round(f.confidence * 100)}%</span>
                <Badge variant={f.severity === 'severe' ? 'red' : f.severity === 'moderate' ? 'red' : f.severity === 'mild' ? 'amber' : 'green'}>
                  {f.severity}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SVG bounding box overlay — rendered on top of the image via absolute positioning */}
      {showOverlay && interpretation.findings.some((f) => f.boundingBox) && (
        <div className="relative" style={{ width: displayWidth, height: displayHeight }}>
          <svg
            className="absolute inset-0 pointer-events-none"
            width={displayWidth}
            height={displayHeight}
            style={{ position: 'absolute', top: 0, left: 0 }}
          >
            {interpretation.findings
              .filter((f) => f.boundingBox)
              .map((f, i) => {
                const bb = f.boundingBox!
                return (
                  <g key={i}>
                    <rect
                      x={bb.x * displayWidth}
                      y={bb.y * displayHeight}
                      width={bb.width * displayWidth}
                      height={bb.height * displayHeight}
                      fill="none"
                      stroke={severityColor[f.severity]}
                      strokeWidth={2}
                      strokeDasharray={f.severity === 'normal' ? '4 2' : undefined}
                      rx={3}
                    />
                    <rect
                      x={bb.x * displayWidth}
                      y={bb.y * displayHeight - 18}
                      width={f.label.length * 6.5 + 8}
                      height={16}
                      fill={severityColor[f.severity]}
                      rx={3}
                    />
                    <text
                      x={bb.x * displayWidth + 4}
                      y={bb.y * displayHeight - 6}
                      fill="white"
                      fontSize={10}
                      fontWeight="600"
                    >
                      {f.label} {Math.round(f.confidence * 100)}%
                    </text>
                  </g>
                )
              })}
          </svg>
        </div>
      )}

      {interpretation.urgency === 'emergent' && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-300 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <p className="text-sm font-semibold text-red-700">Emergent finding — escalate immediately</p>
        </div>
      )}
    </div>
  )
}
