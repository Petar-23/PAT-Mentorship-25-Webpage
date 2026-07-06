'use client'

import { useEffect, useState } from 'react'
import { AreaChart, Area, ReferenceLine, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartLine as LineChart } from '@phosphor-icons/react/ChartLine'
import { CardWithMatrix } from '@/components/ui/card-with-matrix'
import { processedTradingData } from '@/components/tradingData/trading-performance-data'

export function TradingPerformanceCard() {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsMounted(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  if (!isMounted) {
    return null
  }

  const roiPerMonth = '36,8'
  const totalReturn = '73,6'

  return (
    <CardWithMatrix
      icon={<LineChart className="h-full w-full" />}
      title="Live Trading Performance"
      iconColor="text-emerald-400"
      rainColor="#10B981"
      gradientColor="rgba(16, 185, 129, 0.2)"
    >
      <div className="p-3 sm:p-6">
        <div className="flex justify-between items-start mb-4 sm:mb-6">
          <div>
            <p className="text-gray-400 text-xs sm:text-sm">Meine aktuelle Statistik</p>
            <p className="text-gray-500 text-[10px] sm:text-xs mt-0.5 sm:mt-1">
              FK-Konto mit 2000 USD Max Drawdown
            </p>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-green-400 text-xl sm:text-2xl font-semibold">+{roiPerMonth}%</span>
            <span className="text-gray-400 text-[10px] sm:text-xs">Ø ROI / Monat</span>
          </div>
        </div>

        <div className="w-full h-[180px] sm:h-[200px] relative">
          <ResponsiveContainer width="100%" height="100%" minHeight={100}>
            <AreaChart
              data={processedTradingData}
              margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                stroke="#475569"
                tickFormatter={(dateStr: string) => {
                  if (!dateStr) return ''
                  const [year, month, day] = dateStr.split('-').map((num) => parseInt(num, 10))
                  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return ''
                  return `${day}.${month}.`
                }}
                tick={{ fontSize: 10 }}
                tickLine={{ stroke: '#1E293B' }}
                axisLine={{ stroke: '#1E293B' }}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#475569"
                domain={[0, 'dataMax']}
                tickFormatter={(value) => {
                  const abs = Math.abs(value)
                  if (abs >= 1000) return `$${(value / 1000).toFixed(1)}k`
                  return `$${Math.round(value)}`
                }}
                tick={{ fontSize: 12 }}
                tickLine={{ stroke: '#1E293B' }}
                axisLine={{ stroke: '#1E293B' }}
                width={45}
                tickCount={5}
              />
              <ReferenceLine
                y={2000}
                stroke="#94A3B8"
                strokeDasharray="6 6"
                label={{
                  value: 'Reales Startkapital',
                  position: 'insideTopLeft',
                  fill: '#94A3B8',
                  fontSize: 11,
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  border: '1px solid #1E293B',
                  borderRadius: '0.5rem',
                  color: '#F8FAFC',
                }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Balance']}
                labelFormatter={(label: string) => {
                  const date = new Date(label)
                  return date.toLocaleDateString('de-DE', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                }}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke="#10B981"
                fill="url(#colorEquity)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-4 mt-3 sm:mt-4 px-1 sm:px-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
            <span className="text-gray-400 text-[10px] sm:text-xs md:text-sm">Total Return:</span>
            <span className="text-white text-sm sm:text-base font-medium">+{totalReturn}%</span>
          </div>
          <div className="flex items-center justify-start sm:justify-end">
            <span className="text-gray-400 text-[10px] sm:text-xs md:text-sm">
              Live auf YouTube eingeloggt & alle Trades veröffentlicht
            </span>
          </div>
        </div>
      </div>
    </CardWithMatrix>
  )
}
