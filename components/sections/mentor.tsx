'use client'

import Image from 'next/image'
import { Award, Play, Users, LineChart, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CardWithMatrix } from "@/components/ui/card-with-matrix"
import { AreaChart, Area, ReferenceLine, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useState, useEffect } from 'react'
import { processedTradingData } from '@/components/tradingData/trading-performance-data'

// Trading performance component
function TradingPerformance() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsMounted(true))
    return () => cancelAnimationFrame(raf)
  }, []);

  if (!isMounted) {
    return null;
  }

  const winRate = '41'
  const roiPerMonth = '36,8'
  const accountSize = '2.000'
  const totalReturn = '73,6'

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
          <div>
            <p className="text-gray-400 text-sm">Meine aktuelle Statistik</p>
            <p className="text-gray-500 text-xs mt-1">
              FK-Konto mit 2000 USD Max Drawdown
            </p>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-green-400 text-2xl font-semibold">+{roiPerMonth}%</span>
            <span className="text-gray-400 text-xs">Ø ROI / Monat</span>
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
                  const [year, month, day] = dateStr.split('-').map((num) => parseInt(num, 10));
                  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return '';
                  return `${day}.${month}.`;
                }}
                tick={{ fontSize: 10 }}
                tickLine={{ stroke: '#1E293B' }}
                axisLine={{ stroke: '#1E293B' }}
                interval={'preserveStartEnd'}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mt-4 px-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
            <span className="text-gray-400 text-xs md:text-sm">Total Return:</span>
            <span className="text-white font-medium">+{totalReturn}%</span>
          </div>
          <div className="flex items-center justify-start sm:justify-end">
            <span className="text-gray-400 text-xs md:text-sm">
              Live auf YouTube eingeloggt & alle Trades veröffentlicht
            </span>
          </div>
        </div>
      </div>
    </CardWithMatrix>
  );
}

// Main Mentor Section
export default function MentorSection() {
  const [whopReviewCount, setWhopReviewCount] = useState<number | null>(null)
  const [whopReviewsError, setWhopReviewsError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadWhopReviewCount() {
      try {
        // Max: 200 (Route capped). Reicht für die Landing Page; bei sehr vielen Reviews zeigen wir "200+".
        const res = await fetch('/api/whop/reviews?limit=200&per=50')
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error || 'Failed to load reviews')
        const count = typeof data?.count === 'number' ? data.count : null
        if (!cancelled) setWhopReviewCount(count)
      } catch (e) {
        console.error('Failed to load Whop reviews count:', e)
        if (!cancelled) setWhopReviewsError(true)
      }
    }

    loadWhopReviewCount()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="py-16 sm:py-24 bg-slate-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 to-slate-950/20" />
      
      <div className="container mx-auto px-4 max-w-6xl relative z-10">
        {/* Section Header (global, damit Chart & Mentor-Bild oben bündig starten) */}
        <div className="mb-8">
          <h4 className="text-blue-400 font-semibold mb-4">DEIN MENTOR</h4>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
            Petar
          </h2>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden space-y-8">
          <div>
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
              <Image
                src="/images/mentor_petar.png"
                alt="Trading Mentor"
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
              <CardWithMatrix
                icon={<Users className="h-full w-full" />}
                value="130+"
                subtitle="Erfolgreiche Mentees"
                iconColor="text-blue-400"
                rainColor="#60A5FA"
                gradientColor="rgba(96, 165, 250, 0.2)"
              />
              <CardWithMatrix
                icon={<Award className="h-full w-full" />}
                title="Mentor-Erfahrung"
                iconColor="text-purple-400"
                rainColor="#A78BFA"
                gradientColor="rgba(167, 139, 250, 0.2)"
              >
                <div className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 text-purple-400">
                      <Award className="h-full w-full" />
                    </div>
                    <div>
                      <p className="text-lg sm:text-2xl font-bold text-white whitespace-nowrap">
                        2 Jahre
                      </p>
                      <p className="text-sm text-gray-400">Mentor-Erfahrung</p>
                    </div>
                  </div>
                </div>
              </CardWithMatrix>
            </div>

            <div className="mt-6">
              <CardWithMatrix
                icon={
                  <div className="relative h-full w-full">
                    <Image
                      src="/images/whop-logo.png"
                      alt="Whop"
                      fill
                      className="object-contain"
                      sizes="40px"
                    />
                  </div>
                }
                title="Whop Reviews"
                iconColor="text-yellow-300"
                rainColor="#FBBF24"
                gradientColor="rgba(251, 191, 36, 0.18)"
                className="lg:min-h-[130px]"
              >
                <div className="p-6 flex items-center lg:min-h-[130px]">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10">
                      <div className="relative h-10 w-10">
                        <Image
                          src="/images/whop-logo.png"
                          alt="Whop"
                          fill
                          className="object-contain"
                          sizes="40px"
                        />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-current" />
                        ))}
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        {whopReviewsError
                          ? 'Whop Reviews aktuell nicht verfügbar'
                          : whopReviewCount == null
                            ? 'Bewertungen werden geladen…'
                            : `${whopReviewCount >= 200 ? '200+' : whopReviewCount} Bewertungen (Whop)`}
                      </p>
                    </div>
                  </div>
                </div>
              </CardWithMatrix>
            </div>
          </div>

          <div>
            <p className="text-base sm:text-lg text-gray-300 leading-relaxed mb-4">
              Ich habe mich intensiv mit dem Trading nach 
              ICT&apos;s Smart Money Konzepten beschäftigt und über 1000 
              Stunden Videomaterial durchgearbeitet. Dazu gehören 
              ICT&apos;s Private Mentorship, die ICT 2025 Lecture Series sowie die Mentorships der Jahre 2022, 2023, 2024 - und vieles mehr.
            </p>
            <p className="text-base sm:text-lg text-gray-300 leading-relaxed mb-4">
              Seit Anfang 2024, lehre ich diese Konzepte in meiner eigenen privaten Mentorship. 
              Mittlerweile konnten 130+ Mentees messbare Erfolge erzielen.
            </p>
            <p className="text-base sm:text-lg text-gray-300 leading-relaxed">
              Ich werbe nicht mit Lifestyle und Luxus, sondern mit echten Trades 
              - schaue dir gerne meinen YouTube Kanal an. Mein Ziel ist es, dir 
              eine nachhaltige Fähigkeit zu vermitteln, mit der du ein stabiles monatliches Einkommen erzielen kannst.
            </p>
          </div>

          <div className="space-y-6 sm:space-y-8">
            <TradingPerformance />

            <CardWithMatrix
              icon={<LineChart className="h-full w-full" />}
              title="Topstep Payout"
              iconColor="text-green-400"
              rainColor="#34D399"
              gradientColor="rgba(52, 211, 153, 0.2)"
              className="overflow-hidden"
            >
              <a
                href="https://x.com/Topstep/status/1960336160917479927?s=20"
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <div className="relative">
                  <div className="flex items-center gap-3 px-5 py-4">
                    <div className="h-9 w-9 text-green-400">
                      <LineChart className="h-full w-full" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Payout Nachweis</p>
                      <p className="text-xs text-gray-400">Offizieller Topstep X Account</p>
                    </div>
                  </div>

                  <div className="relative w-full overflow-hidden px-5 pb-4">
                    <div className="relative w-full h-[130px] sm:h-[150px] md:h-[160px] overflow-hidden rounded-lg">
                      <Image
                        src="/images/ts_payout.png"
                        alt="Topstep Payout Screenshot"
                        fill
                        className="object-contain object-left"
                        sizes="(max-width: 768px) 90vw, 520px"
                      />
                    </div>
                  </div>
                </div>
              </a>
            </CardWithMatrix>
          </div>

          <CardWithMatrix
            icon={<Play className="h-full w-full" />}
            title="Trading Range Analyse"
            iconColor="text-red-400"
            rainColor="#60A5FA"
            gradientColor="rgba(96, 165, 250, 0.2)"
            className="overflow-hidden"
          >
            <div className="relative p-6">
              <div className="aspect-[16/8] relative bg-slate-900">
                <Image
                  src="https://i.ytimg.com/vi/63V_7Ji_omw/hqdefault.jpg"
                  alt="Trading Range Analyse"
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-black/40" />
                <Button
                  onClick={() => {
                    window.open('https://www.youtube.com/watch?v=63V_7Ji_omw', '_blank')
                  }}
                  className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center group border-2 border-white/20"
                >
                  <Play className="h-7 w-7 text-white group-hover:scale-110 transition-transform" />
                </Button>
              </div>
              <div className="pt-6">
                <p className="font-semibold text-white text-lg mb-4">
                  Beispiel Lektion aus der PAT Mentorship 2025
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-slate-800 rounded-md text-blue-400 text-sm">
                    Live Ausführung
                  </span>
                  <span className="px-2 py-1 bg-slate-800 rounded-md text-blue-400 text-sm">
                    ICT Modell 22
                  </span>
                  <span className="px-2 py-1 bg-slate-800 rounded-md text-blue-400 text-sm">
                    Lektion
                  </span>
                </div>
              </div>
            </div>
          </CardWithMatrix>
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-8 sm:gap-12 items-start">
          {/* Left Column - Text and Trading Performance */}
          <div className="space-y-6 sm:space-y-8">
            <TradingPerformance />

            <CardWithMatrix
              icon={<LineChart className="h-full w-full" />}
              title="Topstep Payout"
              iconColor="text-green-400"
              rainColor="#34D399"
              gradientColor="rgba(52, 211, 153, 0.2)"
              className="overflow-hidden"
            >
              <a
                href="https://x.com/Topstep/status/1960336160917479927?s=20"
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <div className="relative">
                  <div className="flex items-center gap-3 px-5 py-4">
                    <div className="h-9 w-9 text-green-400">
                      <LineChart className="h-full w-full" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Payout Nachweis</p>
                      <p className="text-xs text-gray-400">Offizieller Topstep X Account</p>
                    </div>
                  </div>

                  <div className="relative w-full overflow-hidden px-5 pb-4">
                    <div className="relative w-full h-[130px] sm:h-[150px] md:h-[160px] overflow-hidden rounded-lg">
                      <Image
                        src="/images/ts_payout.png"
                        alt="Topstep Payout Screenshot"
                        fill
                        className="object-contain object-left"
                        sizes="(max-width: 768px) 90vw, 520px"
                      />
                    </div>
                  </div>
                </div>
              </a>
            </CardWithMatrix>

            <CardWithMatrix
              icon={<Play className="h-full w-full" />}
              title="Trading Range Analyse"
              iconColor="text-red-400"
              rainColor="#60A5FA"
              gradientColor="rgba(96, 165, 250, 0.2)"
              className="overflow-hidden"
            >
              <div className="relative p-6">
                <div className="aspect-[16/8] relative bg-slate-900">
                  <Image
                    src="https://i.ytimg.com/vi/63V_7Ji_omw/hqdefault.jpg"
                    alt="Trading Range Analyse"
                    fill
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-black/40" />
                  <Button
                    onClick={() => {
                      window.open('https://www.youtube.com/watch?v=63V_7Ji_omw', '_blank')
                    }}
                    className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center group border-2 border-white/20"
                  >
                    <Play className="h-7 w-7 text-white group-hover:scale-110 transition-transform" />
                  </Button>
                </div>
                <div className="pt-6">
                  <p className="font-semibold text-white text-lg mb-4">
                    Beispiel Lektion aus der PAT Mentorship 2025
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-slate-800 rounded-md text-blue-400 text-sm">
                      Live Ausführung
                    </span>
                    <span className="px-2 py-1 bg-slate-800 rounded-md text-blue-400 text-sm">
                      ICT Modell 22
                    </span>
                    <span className="px-2 py-1 bg-slate-800 rounded-md text-blue-400 text-sm">
                      Lektion
                    </span>
                  </div>
                </div>
              </div>
            </CardWithMatrix>
          </div>

          {/* Right Column - Image and Stats */}
          <div className="flex flex-col h-full">
            <div className="flex-1">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
                <Image
                  src="/images/mentor_petar.png"
                  alt="Trading Mentor"
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
                <CardWithMatrix
                  icon={<Users className="h-full w-full" />}
                  value="130+"
                  subtitle="Erfolgreiche Mentees"
                  iconColor="text-blue-400"
                  rainColor="#60A5FA"
                  gradientColor="rgba(96, 165, 250, 0.2)"
                />
                <CardWithMatrix
                  icon={<Award className="h-full w-full" />}
                  title="Mentor-Erfahrung"
                  iconColor="text-purple-400"
                  rainColor="#A78BFA"
                  gradientColor="rgba(167, 139, 250, 0.2)"
                >
                  <div className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 text-purple-400">
                        <Award className="h-full w-full" />
                      </div>
                      <div>
                        <p className="text-lg sm:text-2xl font-bold text-white whitespace-nowrap">
                          2 Jahre
                        </p>
                        <p className="text-sm text-gray-400">Mentor-Erfahrung</p>
                      </div>
                    </div>
                  </div>
                </CardWithMatrix>
              </div>

              <div className="mt-6">
                <p className="text-base sm:text-lg text-gray-300 leading-relaxed mb-4">
                  Ich habe mich intensiv mit dem Trading nach 
                  ICT&apos;s Smart Money Konzepten beschäftigt und über 1000 
                  Stunden Videomaterial durchgearbeitet. Dazu gehören 
                  ICT&apos;s Private Mentorship, die ICT 2025 Lecture Series sowie die Mentorships der Jahre 2022, 2023, 2024 - und vieles mehr.
                </p>
                <p className="text-base sm:text-lg text-gray-300 leading-relaxed mb-4">
                  Seit Anfang 2024, lehre ich diese Konzepte in meiner eigenen privaten Mentorship. 
                  Mittlerweile konnten 130+ Mentees messbare Erfolge erzielen.
                </p>
                <p className="text-base sm:text-lg text-gray-300 leading-relaxed">
                  Ich werbe nicht mit Lifestyle und Luxus, sondern mit echten Trades 
                  - schaue dir gerne meinen YouTube Kanal an. Mein Ziel ist es, dir 
                  eine nachhaltige Fähigkeit zu vermitteln, mit der du ein stabiles monatliches Einkommen erzielen kannst.
                </p>

                <div className="mt-6">
                  <CardWithMatrix
                    icon={
                      <div className="relative h-full w-full">
                        <Image
                          src="/images/whop-logo.png"
                          alt="Whop"
                          fill
                          className="object-contain"
                          sizes="40px"
                        />
                      </div>
                    }
                    title="Whop Reviews"
                    iconColor="text-yellow-300"
                    rainColor="#FBBF24"
                    gradientColor="rgba(251, 191, 36, 0.18)"
                    className="lg:min-h-[130px]"
                  >
                    <div className="p-6 flex items-center lg:min-h-[130px]">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10">
                          <div className="relative h-10 w-10">
                            <Image
                              src="/images/whop-logo.png"
                              alt="Whop"
                              fill
                              className="object-contain"
                              sizes="40px"
                            />
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 text-amber-400">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className="h-4 w-4 fill-current" />
                            ))}
                          </div>
                          <p className="text-sm text-gray-400 mt-1">
                            {whopReviewsError
                              ? 'Whop Reviews aktuell nicht verfügbar'
                              : whopReviewCount == null
                                ? 'Bewertungen werden geladen…'
                                : `${whopReviewCount >= 200 ? '200+' : whopReviewCount} Bewertungen (Whop)`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardWithMatrix>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}