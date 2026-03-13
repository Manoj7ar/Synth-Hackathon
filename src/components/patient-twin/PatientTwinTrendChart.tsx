'use client'

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'

type PatientTwinTrendChartProps = {
  data: Array<{
    label: string
    visitDate: string
    systolic: number
    diastolic: number
  }>
}

export function PatientTwinTrendChart({ data }: PatientTwinTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-[#e4d6c2] bg-white/70 text-sm text-slate-500">
        No blood pressure trend available yet.
      </div>
    )
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e6dccb" />
          <XAxis dataKey="label" stroke="#7a6a53" tick={{ fontSize: 11 }} />
          <YAxis domain={['dataMin - 8', 'dataMax + 8']} stroke="#7a6a53" tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value: ValueType | undefined, name: NameType | undefined) => [
              `${typeof value === 'number' ? value : value ?? '-'} mmHg`,
              name === 'systolic' ? 'Systolic' : 'Diastolic',
            ]}
            labelFormatter={(label) => `Visit: ${label}`}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="systolic"
            stroke="#b45309"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            name="Systolic"
          />
          <Line
            type="monotone"
            dataKey="diastolic"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            name="Diastolic"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

