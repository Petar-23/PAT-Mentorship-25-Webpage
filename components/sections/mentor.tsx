'use client'

import Image from 'next/image'
import { Play, Users, LineChart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CardWithMatrix } from "@/components/ui/card-with-matrix"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useState, useEffect } from 'react'
import { processedTradingData } from '@/components/tradingData/trading-performance-data'
import { calculateTradingStats } from '@/lib/trading-stats'

// Trading performance component
function TradingPerformance() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  const stats = calculateTradingStats(processedTradingData);

  const totalReturn = ((processedTradingData[processedTradingData.length - 1].equity - processedTradingData[0].equity) / processedTradingData[0].equity * 100).toFixed(1);
  return (
    <CardWithMatrix
      icon={<LineChart className="h-full w-full" />}
      title="Live Trading Performance"
      iconColor="text-emerald-400"
      rainColor="#10B981"
      gradientColor="rgba(16, 185, 129, 0.2)"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <p className="text-gray-400 text-sm">Meine aktuelle Statistik</p>
          <div className="flex flex-col items-end">
            <span className="text-green-400 text-2xl font-semibold">+{totalReturn}%</span>
            <span className="text-gray-400 text-xs">40 Tage Rendite</span>
          </div>
        </div>

        {/* Chart */}
        <div className="w-full h-[200px] sm:h-[200px] relative">
          <ResponsiveContainer>
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
                  if (!dateStr) return '';
                  // Parse date in YYYY-MM-DD format
                  const [month, day] = dateStr.split('-').map(num => parseInt(num));
                  // JavaScript months are 0-based, so we subtract 1 from the month
                  return `${day}/${month}`;
                }}
                tick={{ fontSize: 10 }}
                tickLine={{ stroke: '#1E293B' }}
                axisLine={{ stroke: '#1E293B' }}
                interval={'preserveStartEnd'}
              />
              <YAxis 
                stroke="#475569"
                tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`}
                tick={{ fontSize: 12 }}
                tickLine={{ stroke: '#1E293B' }}
                axisLine={{ stroke: '#1E293B' }}
                width={45}
                tickCount={5}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#0F172A',
                  border: '1px solid #1E293B',
                  borderRadius: '0.5rem',
                  color: '#F8FAFC'
                }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Balance']}
                labelFormatter={(label: string) => {
                  const date = new Date(label);
                  return date.toLocaleDateString('de-DE', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  });
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

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:justify-between mt-4 px-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
            <span className="text-gray-400 text-xs md:text-sm">Win Rate:</span>
            <span className="text-white font-medium">{stats.winRate}%</span>
          </div>
          <div className="hidden sm:block h-4 w-px bg-gray-700" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
            <span className="text-gray-400 text-xs md:text-sm">Profit Factor:</span>
            <span className="text-white font-medium">{stats.profitFactor}</span>
          </div>
          <div className="hidden sm:block h-4 w-px bg-gray-700" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
            <span className="text-gray-400 text-xs md:text-sm">Avg Win/Loss:</span>
            <span className="text-white font-medium">{stats.avgWinLossRatio}</span>
          </div>
        </div>
      </div>
    </CardWithMatrix>
  );
}

// Main Mentor Section
export default function MentorSection() {
  // Calculate total trades and win rate for stats card
  const stats = calculateTradingStats(processedTradingData);

  return (
    <section className="py-16 sm:py-24 bg-slate-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 to-slate-950/20" />
      
      <div className="container mx-auto px-4 max-w-6xl relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left Column - Text and Trading Performance */}
          <div className="space-y-8">
            {/* Header */}
            <div>
              <h4 className="text-blue-400 font-semibold mb-4">DEIN MENTOR</h4>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-6">
                Petar
              </h2>
            </div>

            {/* Trading Performance Card */}
            <TradingPerformance />

            {/* Video Preview */}
            <CardWithMatrix
              icon={<Play className="h-full w-full" />}
              title="Trading Range Analyse"
              iconColor="text-red-400"
              rainColor="#60A5FA"
              gradientColor="rgba(96, 165, 250, 0.2)"
              className="overflow-hidden"
            >
              <div className="relative p-8">
                <div className="aspect-video relative bg-slate-900">
                  <Image
                    src="/images/example-thumbnail-1.png"
                    alt="Trading Range Analyse"
                    fill
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-black/40" />
                  <Button
                    onClick={() => {
                      window.open('https://youtu.be/l4_yKCnskLY?si=rxeRswbKaOLkEjdK', '_blank')
                    }}
                    className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center group border-2 border-white/20"
                  >
                    <Play className="h-7 w-7 text-white group-hover:scale-110 transition-transform" />
                  </Button>
                </div>
                <div className="pt-6">
                  <p className="font-semibold text-white text-lg mb-4">
                    Beispiel Lektion aus der PAT Mentorship 2024
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-slate-800 rounded-md text-blue-400 text-sm">
                      Fair Value Gap
                    </span>
                    <span className="px-2 py-1 bg-slate-800 rounded-md text-blue-400 text-sm">
                      Overnight Hours
                    </span>
                    <span className="px-2 py-1 bg-slate-800 rounded-md text-blue-400 text-sm">
                      Quad Grading
                    </span>
                  </div>
                </div>
              </div>
            </CardWithMatrix>
          </div>

          {/* Right Column - Image and Stats */}
          <div className="flex flex-col h-full">
            {/* Main Image with Stats */}
            <div className="flex-1">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
                <Image
                  src="/images/mentor-image-2.png"
                  alt="Trading Mentor"
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
              </div>

              {/* Stats Cards - Now using real data */}
              <div className="mt-6 grid grid-cols-2 gap-4">
                <CardWithMatrix
                  icon={<Users className="h-full w-full" />}
                  value="90+"
                  subtitle="Erfolgreiche Mentees"
                  iconColor="text-blue-400"
                  rainColor="#60A5FA"
                  gradientColor="rgba(96, 165, 250, 0.2)"
                />
                <CardWithMatrix
                  icon={<LineChart className="h-full w-full" />}
                  value={`${stats.winRate}%`}
                  subtitle="Win-Rate (40-Tage)"
                  iconColor="text-green-400"
                  rainColor="#34D399"
                  gradientColor="rgba(52, 211, 153, 0.2)"
                />
              </div>

              {/* Bottom Text */}
              <div className="mt-6">
                <p className="text-base sm:text-lg text-gray-300 leading-relaxed mb-4">
                  Ich habe mich intensiv mit dem Trading nach 
                  ICT&apos;s Smart Money Konzepten beschäftigt und über 1000 
                  Stunden Videomaterial durchgarbeitet. Dazu gehören 
                  ICT&apos;s Private Mentorship sowie die Mentorships der Jahre 2022, 2023, 2024 - und vieles mehr.
                </p>
                <p className="text-base sm:text-lg text-gray-300 leading-relaxed mb-4">
                  Seit Anfang 2024, lehre ich diese Konzepte in meiner eigenen privaten Mentorship. 
                  Mittlerweile konnten fast 100 Mentees messbare Erfolge erzielen.
                </p>
                <p className="text-base sm:text-lg text-gray-300 leading-relaxed">
                  Ich werbe nicht mit Lifestyle und Luxus, sondern mit echten Trades 
                  - schaue dir gerne meinen YouTube Kanal an. Mein Ziel ist es, dir 
                  eine nachhaltige Fähigkeit zu vermitteln, mit der du ein stabiles monatliches Einkommen erzielen kannst.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}