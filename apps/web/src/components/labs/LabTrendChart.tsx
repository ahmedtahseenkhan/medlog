import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'
import { format } from 'date-fns'
import type { LabReport } from '@medlog/types'

interface Props {
  labs: LabReport[]
  testName: string
}

export function LabTrendChart({ labs, testName }: Props) {
  const filtered = useMemo(
    () =>
      labs
        .filter((l) => l.testName.toLowerCase() === testName.toLowerCase())
        .sort((a, b) => new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime()),
    [labs, testName]
  )

  if (filtered.length < 2) {
    return <div className="py-6 text-center text-xs text-gray-400">Not enough data points for trend (need ≥ 2)</div>
  }

  const refLow = filtered[0].referenceRangeLow
  const refHigh = filtered[0].referenceRangeHigh
  const unit = filtered[0].unit

  const chartData = filtered.map((l) => ({
    date: format(new Date(l.reportedAt), 'dd/MM HH:mm'),
    value: parseFloat(l.value),
    isAbnormal: l.isAbnormal,
    isCritical: l.isCritical,
  }))

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">{testName}</h3>
        <span className="text-xs text-gray-400">{unit}</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#D1D5DB" />
          <YAxis tick={{ fontSize: 10 }} stroke="#D1D5DB" domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
            formatter={(v: number) => [`${v} ${unit}`, testName]}
          />
          {refLow != null && (
            <ReferenceLine y={refLow} stroke="#FCA5A5" strokeDasharray="4 2" label={{ value: `Low ${refLow}`, fontSize: 9, fill: '#EF4444', position: 'insideTopLeft' }} />
          )}
          {refHigh != null && (
            <ReferenceLine y={refHigh} stroke="#FCA5A5" strokeDasharray="4 2" label={{ value: `High ${refHigh}`, fontSize: 9, fill: '#EF4444', position: 'insideBottomLeft' }} />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="#1D9E75"
            strokeWidth={2}
            dot={(props) => {
              const d = chartData[props.index]
              return (
                <circle
                  key={props.index}
                  cx={props.cx}
                  cy={props.cy}
                  r={4}
                  fill={d.isCritical ? '#EF4444' : d.isAbnormal ? '#F59E0B' : '#1D9E75'}
                  stroke="#fff"
                  strokeWidth={1.5}
                />
              )
            }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-brand-500 inline-block" /><span className="text-xs text-gray-500">Normal</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /><span className="text-xs text-gray-500">Abnormal</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /><span className="text-xs text-gray-500">Critical</span></div>
      </div>
    </div>
  )
}
