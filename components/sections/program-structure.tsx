// src/components/sections/program-structure.tsx
'use client'

import { CheckCircle, Users, BrainCircuit, LineChart } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { CardWithMatrix } from '@/components/ui/card-with-matrix'
import { GradientCard } from '@/components/ui/gradient-card'

interface ProgramPhase {
  phase: string;
  description: string;
  features: string[];
  duration: string;
}

const programPhases: ProgramPhase[] = [
  {
    phase: "Phase 1: Grundlagen",
    description: "Hier legen wir das Fundament für die Mentorship",
    features: [
      "Live Sessions (Bias und Liquidiät)",
      "PD Array Matrix (FVG, Orderblock, Breaker etc.)",
      "Wichtige Zeiten (Makros, Silver Bullet & Sessions)",
      "Journaling Methoden"
    ],
    duration: "Monat 1-3"
  },
  {
    phase: "Phase 2: Fortgeschrittene Konzepte",
    description: "Vertiefe dein Verständnis",
    features: [
      "Live Sessions (Zeitbasierte Liquidiät & PD Arrays)",
      "SMT Divergenzen",
      "Diverse Einstiegstechniken",
      "Risikomanagement Grundlagen"
    ],
    duration: "Monat 4-6"
  },
  {
    phase: "Phase 3: Live Trading",
    description: "Wende dein Wissen unter realen Marktbedingungen an",
    features: [
      "Live Trading Sessions mit minimalen Hebel",
      "Trade Review Workshops",
      "Fortgeschrittenes Risikomanagement",
      "Finde dein Model"
    ],
    duration: "Monat 7-9"
  },
  {
    phase: "Phase 4: Feinschliff",
    description: "Verfeinere deine Edge und baue nachhaltigen Erfolg auf",
    features: [
      "Trading Psychologie",
      "Bias aus höheren Timeframes",
      "Persönliche Strategieentwicklung (realistische Ziele)",
      "FK Funding & Payouts"
    ],
    duration: "Monat 10-12"
  }
];

interface WeeklySession {
  day: string;
  time: string;
  type: string;
  description: string;
  gradientColor: string;
}

const weeklySchedule: WeeklySession[] = [
  {
    day: "Dienstag",
    time: "15:00 Uhr",
    type: "Live Marktanalyse",
    description: "Anwendung der Konzepte an der Live Price Action",
    gradientColor: "rgba(96, 165, 250, 0.2)" // Blue
  },
  {
    day: "Donnerstag",
    time: "18:00 Uhr",
    type: "Strategie & Ausbildung",
    description: "Vermittlung neuer Inhalte und Q&A",
    gradientColor: "rgba(167, 139, 250, 0.2)" // Purple
  },
  {
    day: "Freitag",
    time: "18:00 Uhr",
    type: "Wochenvorbereitung",
    description: "Marktrückblick und Planung der kommenden Woche",
    gradientColor: "rgba(52, 211, 153, 0.2)" // Green
  }
];

const supportFeatures = [
  {
    icon: <Users className="h-full w-full" />,
    title: "Community Hub",
    description: "24/7 Zugang zu unserer privaten Discord-Community. Vernetze dich und wachse mit den anderen Mentees.",
    iconColor: "text-blue-400",
    rainColor: "#60A5FA",
    gradientColor: "rgba(96, 165, 250, 0.2)"
  },
  {
    icon: <LineChart className="h-full w-full" />,
    title: "Trading Indikatoren",
    description: "Speziell entwickelte Indikatoren für ICT Konzepte, die dir Zeit einsparen und manuelles einzeichnen von Leveln erleichtern.",
    iconColor: "text-purple-400",
    rainColor: "#A78BFA",
    gradientColor: "rgba(167, 139, 250, 0.2)"
  },
  {
    icon: <BrainCircuit className="h-full w-full" />,
    title: "Zugang zu Absolventen",
    description: "Vernetze dich mit Absolventen vorheriger PAT Mentorships, die dir ein paar Schritte vorraus sind.",
    iconColor: "text-green-400",
    rainColor: "#34D399",
    gradientColor: "rgba(52, 211, 153, 0.2)"
  }
];

export default function ProgramStructure() {
  return (
    <section className="py-24 sm:py-32 bg-slate-950">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Dein Weg zum Trading-Erfolg
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Ein strukturierter Ansatz, der deine Fähigkeiten schrittweise aufbaut
          </p>
        </div>

        {/* Program Phases */}
        <div className="grid md:grid-cols-2 gap-6 mb-24">
          {programPhases.map((phase, index) => (
            <Card key={index} className="relative overflow-hidden bg-slate-900 border-slate-800">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
              <CardContent className="pt-6">
                <div className="mb-4">
                  <span className="text-sm font-medium text-blue-400">
                    {phase.duration}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  {phase.phase}
                </h3>
                <p className="text-gray-400 mb-4">
                  {phase.description}
                </p>
                <ul className="space-y-2">
                  {phase.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Weekly Schedule */}
        <div className="bg-slate-900 rounded-2xl p-6 sm:p-8 mb-24 border border-slate-800">
          <h3 className="text-2xl font-bold text-white mb-6 text-center">
            Wöchentliche Live Sessions*
          </h3>
          <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
            {weeklySchedule.map((session, index) => (
              <GradientCard
                key={index}
                gradientColor={session.gradientColor}
                className="bg-slate-800 backdrop-blur"
              >
                <div className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-gray-300">
                      {session.day}
                    </span>
                    <span className="text-sm font-medium text-blue-400">
                      {session.time}
                    </span>
                  </div>
                  <h4 className="font-semibold text-white mb-2">
                    {session.type}
                  </h4>
                  <p className="text-sm text-gray-400">
                    {session.description}
                  </p>
                </div>
              </GradientCard>
            ))}
          </div>
          
          <div className="mt-8 p-4 bg-blue-900/20 rounded-lg border border-blue-800/30">
            <p className="text-center text-blue-300 text-sm">
              Alle Sessions werden aufgezeichnet und sind für dich jederzeit verfügbar.
              Keine Zeit für die Live Session? Schaue sie dir in Ruhe an und stelle deine Fragen in der nächsten Q&A Runde.
            </p>
          </div>

          <p className="mt-6 text-center text-gray-500 text-sm italic">
            * Zeitplan kann je nach Marktbedingungen und Gruppenbedürfnissen angepasst werden
          </p>
        </div>

        {/* Support System */}
        <div className="mt-24">
          <h3 className="text-2xl font-bold text-white mb-6 text-center">
            Umfassendes Support-System
          </h3>
          <p className="text-gray-400 mb-12 max-w-2xl mx-auto text-center">
            Neben den strukturierten Sessions erhältst du Zugang zu einem kompletten Trading-Support-Ökosystem
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-[1200px] mx-auto">
            {supportFeatures.map((feature, index) => (
              <CardWithMatrix
                key={index}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                iconColor={feature.iconColor}
                rainColor={feature.rainColor}
                gradientColor={feature.gradientColor}
                className="h-auto sm:h-[250px] lg:h-auto" // Optimized height for mobile
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}