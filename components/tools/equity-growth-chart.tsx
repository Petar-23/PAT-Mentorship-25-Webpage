'use client'

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type EquityChartPoint = {
  month: number
  capital: number
  contracts: number
  riskPercent: string
  monthlyReturn: string
  pnl: number
}

type EquityChartLabels = {
  month: string
  capital: string
  contracts: string
  risk: string
  monthlyReturn: string
  monthlyPnL: string
}

type EquityGrowthChartProps = {
  data: EquityChartPoint[]
  labels: EquityChartLabels
}

export function EquityGrowthChart({ data, labels }: EquityGrowthChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={data}
        margin={{ top: 20, right: 30, left: 60, bottom: 20 }}
      >
        <defs>
          <linearGradient id="colorCapital" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          label={{
            value: labels.month,
            position: 'insideBottom',
            offset: -10,
          }}
          padding={{ left: 0, right: 0 }}
        />
        <YAxis
          label={{
            value: labels.capital,
            angle: -90,
            position: 'insideLeft',
            offset: -40,
            style: { textAnchor: 'middle' },
          }}
          tickFormatter={(value) => `$${value.toLocaleString()}`}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const point = payload[0].payload as EquityChartPoint
              return (
                <div className="bg-white p-4 border rounded shadow-lg">
                  <p className="font-bold">{labels.month} {point.month}</p>
                  <p>{labels.capital}: ${point.capital.toLocaleString()}</p>
                  <p>{labels.contracts}: {point.contracts}</p>
                  <p>{labels.risk}: {point.riskPercent}%</p>
                  <p>{labels.monthlyReturn}: {point.monthlyReturn}%</p>
                  <p>{labels.monthlyPnL}: ${point.pnl.toLocaleString()}</p>
                </div>
              )
            }
            return null
          }}
        />
        <Area
          type="monotone"
          dataKey="capital"
          fill="url(#colorCapital)"
        />
        <Line
          type="monotone"
          dataKey="capital"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          name={labels.capital}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
