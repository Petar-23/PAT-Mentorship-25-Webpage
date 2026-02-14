'use client'

import { MENTORSHIP_CONFIG } from '@/lib/config'
import { PlayCircle, Users, Calendar, ChartSpline, Trophy, CreditCard } from "lucide-react"
import { GlowingEffect } from "@/components/ui/glowing-effect"

const features = [
  {
    icon: <PlayCircle className="h-4 w-4 sm:h-6 sm:w-6" />,
    title: "Live Marktanalyse",
    description: "Lerne an echten, sich bewegenden Märkten, nicht an veralteten Beispielen.",
  },
  {
    icon: <Calendar className="h-4 w-4 sm:h-6 sm:w-6" />,
    title: "Live Sessions",
    description: "2-3 Live-Sessions pro Woche für Lektionen, Übungen und Live-Trading.",
  },
  {
    icon: <Users className="h-4 w-4 sm:h-6 sm:w-6" />,
    title: "Q&A Live-Session",
    description: "Monatlicher Livestream am Monatsende für deine Fragen – klar und direkt beantwortet.",
  },
  {
    icon: <ChartSpline className="h-4 w-4 sm:h-6 sm:w-6" />,
    title: "Abgeflachte Lernkurve",
    description: "Anstatt 700+ ICT YouTube Videos, Smart Money Konzepte strukturiert und an aktueller Price Action lernen.",
  },
  {
    icon: <Trophy className="h-4 w-4 sm:h-6 sm:w-6" />,
    title: "Unbefristeter Zugang",
    description: "Schließe das einjährige Programm ab und erhalte dauerhaften Zugriff auf alle Materialien.",
  },
  {
    icon: <CreditCard className="h-4 w-4 sm:h-6 sm:w-6" />,
    title: "Faire Preisgestaltung",
    description: `${MENTORSHIP_CONFIG.priceWithTax}. Monatlich kündbar, keine versteckten Kosten.`,
  },
]

function FeatureCard({ feature }: { feature: typeof features[0] }) {
  return (
    <div className="relative h-full rounded-xl sm:rounded-2xl border border-slate-700 p-0.5 sm:p-1">
      <GlowingEffect
        spread={40}
        glow={true}
        disabled={false}
        proximity={64}
        inactiveZone={0.01}
        borderWidth={3}
        variant="dark"
      />
      <div className="relative flex h-full flex-col rounded-lg sm:rounded-xl bg-slate-800 p-3 sm:p-6">
        <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
          <div className="text-blue-400 bg-blue-500/20 p-1.5 sm:p-3 rounded-md sm:rounded-lg">
            {feature.icon}
          </div>
          <h3 className="text-sm sm:text-lg font-semibold text-white">
            {feature.title}
          </h3>
        </div>
        <p className="text-xs sm:text-base text-gray-400 leading-relaxed">
          {feature.description}
        </p>
      </div>
    </div>
  )
}

export default function WhyDifferent() {
  return (
    <section id="why-different" className="py-16 sm:py-24 bg-slate-900">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-8 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 pr-3 sm:pr-4 py-1 rounded-full bg-white/10 ring-1 ring-white/20 mb-4 sm:mb-6">
            <div className="bg-blue-500/20 text-blue-400 rounded-full px-2 py-0.5 text-xs sm:text-sm">💡</div>
            <span className="text-xs sm:text-sm font-medium text-blue-400">Was mich unterscheidet</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold text-white mb-3 sm:mb-4">
            Nicht einfach ein weiterer Trading-Kurs
          </h2>
          <p className="text-sm sm:text-lg text-gray-400 max-w-2xl mx-auto">
            ICT&apos;s Smart Money Konzepte, auf Deutsch, in einem Mentoring-Programm an Live-Price-Action
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={index} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  )
}