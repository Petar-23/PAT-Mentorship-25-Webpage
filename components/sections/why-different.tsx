'use client'

import { useState, useRef } from 'react'
import { PlayCircle, Users, Calendar, ChartSpline, Trophy, CreditCard } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { MatrixRain } from "@/components/ui/matrix-rain"

const features = [
  {
    icon: <PlayCircle className="h-5 w-5 sm:h-6 sm:w-6" />,
    title: "Live Marktanalyse",
    description: "Lerne an echten, sich bewegenden Märkten, nicht an veralteten Beispielen.",
  },
  {
    icon: <Calendar className="h-5 w-5 sm:h-6 sm:w-6" />,
    title: "2-3 Live Sessions pro Woche",
    description: "Regelmäßige Livestreams für Lektionen, Übungen und Live-Trading.",
  },
  {
    icon: <Users className="h-5 w-5 sm:h-6 sm:w-6" />,
    title: "1:1 Sessions",
    description: "Erhalte Antworten auf deine spezifischen Fragen in Mentoring-Sessions.",
  },
  {
    icon: <ChartSpline className="h-5 w-5 sm:h-6 sm:w-6" />,
    title: "Abgeflachte Lernkurve",
    description: "Anstatt 700+ ICT YouTube Videos, Smart Money Konzepte strukturiert und an aktueller Price Action lernen.",
  },
  {
    icon: <Trophy className="h-5 w-5 sm:h-6 sm:w-6" />,
    title: "Unbefristeter Zugang",
    description: "Schließe das einjährige Programm ab und erhalte dauerhaften Zugriff auf alle Materialien.",
  },
  {
    icon: <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" />,
    title: "Faire Preisgestaltung",
    description: "Zahle monatlich, kündige jederzeit. Kein Mehrwert, keine Kosten.",
  },
]

function FeatureCard({ feature }: { feature: typeof features[0] }) {
  const [isHovered, setIsHovered] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    setMousePosition({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    })
  }

  return (
    <Card 
      ref={cardRef}
      className="relative border-2 hover:border-blue-500/20 transition-colors overflow-hidden group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
    >
      {/* Matrix Rain Layer */}
      <div 
        className="absolute inset-0 transition-opacity duration-300 opacity-0 group-hover:opacity-100"
        style={{
          mask: `radial-gradient(circle 80px at ${mousePosition.x}% ${mousePosition.y}%, white, transparent)`,
          WebkitMask: `radial-gradient(circle 80px at ${mousePosition.x}% ${mousePosition.y}%, white, transparent)`,
        }}
      >
        {isHovered && <MatrixRain color="rgba(0, 0, 255, 0.15)" />}
      </div>
      
      {/* Content */}
      <CardContent className="relative z-10 p-4 sm:p-6">
        <div className="flex flex-col h-full">
          <div className="text-blue-500 bg-blue-50 p-2 sm:p-3 rounded-lg w-fit mb-3 sm:mb-4">
            {feature.icon}
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
            {feature.title}
          </h3>
          <p className="text-sm sm:text-base text-gray-600">
            {feature.description}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function WhyDifferent() {
  return (
    <section id="why-different" className="py-16 sm:py-24 bg-gray-50">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-4">
            Nicht einfach ein weiterer Trading-Kurs
          </h2>
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
            ICT&apos;s Smart Money Konzepte, auf Deutsch, in einem Mentoring-Programm an Live-Price-Action
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={index} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  )
}