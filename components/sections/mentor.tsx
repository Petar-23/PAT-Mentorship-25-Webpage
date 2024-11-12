'use client'

import Image from 'next/image'
import { motion } from "framer-motion"
import { Play, Users, BookOpen, LineChart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CardWithMatrix } from "@/components/ui/card-with-matrix"

// Define types
interface StatCard {
  icon: React.ReactNode
  value: string
  subtitle: string
  iconColor: string
  rainColor: string
  gradientColor: string
}

interface FeatureCard extends Omit<StatCard, 'value' | 'subtitle'> {
  title: string
  description: string
}

export default function MentorSection() {
  const statsCards: StatCard[] = [
    {
      icon: <Users className="h-full w-full" />,
      value: "90+",
      subtitle: "Erfolgreiche Mentees",
      iconColor: "text-blue-400",
      rainColor: "#60A5FA",
      gradientColor: "rgba(96, 165, 250, 0.2)"
    },
    {
      icon: <LineChart className="h-full w-full" />,
      value: "2+",
      subtitle: "Jahre Trading",
      iconColor: "text-green-400",
      rainColor: "#34D399",
      gradientColor: "rgba(52, 211, 153, 0.2)"
    }
  ]

  const featureCards: FeatureCard[] = [
    {
      icon: <BookOpen className="h-full w-full" />,
      title: "Smart Money Konzepte",
      description: "Strukturierte Vermittlung der ICT Konzepte auf Deutsch",
      iconColor: "text-blue-400",
      rainColor: "#60A5FA",
      gradientColor: "rgba(96, 165, 250, 0.2)"
    },
    {
      icon: <Users className="h-full w-full" />,
      title: "Risiko Management",
      description: "Strategien dein Kapital zu schützen",
      iconColor: "text-purple-400",
      rainColor: "#A78BFA",
      gradientColor: "rgba(167, 139, 250, 0.2)"
    }
  ]

  return (
    <section className="py-16 sm:py-24 bg-slate-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 to-slate-950/20" />
      
      <div className="container mx-auto px-4 max-w-6xl relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Left Column */}
          <div className="space-y-6">
            <div className="mb-8">
              <h4 className="text-blue-400 font-semibold mb-4">DEIN MENTOR</h4>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-6">
                Petar
              </h2>
              <p className="text-base sm:text-lg text-gray-300 leading-relaxed mb-4">
                Seit 2 Jahren befasse ich mich intensiv mit dem Trading nach ICT&apos;s Smart Money Konzepten. 
                Ich habe weit über 1000 Stunden Videomaterial durchgarbeitet. Dazu zählen 
                ICT&apos;s Private Mentorship, ICT Mentorships 2022, 2023 und 2024.
              </p>
              {/* Additional text shown on mobile */}
              <p className="text-base sm:text-lg text-gray-300 leading-relaxed mt-4 lg:hidden">
                Ich werbe nicht mit Lifestyle und Luxus, sondern mit Trades (schaue dir gerne mein YouTube Kanal an).
                Mein Ziel ist es dir eine nachhaltige 
                Fähigkeit zu vermitteln und dir zu helfen ein 
                stabiles monatliches Einkommen aufzubauen und von dort aus kontinuierlich 
                zu wachsen.
              </p>
            </div>

            {/* Mobile: Image and Stats first */}
            <div className="block lg:hidden">
              <MentorImageAndStats statsCards={statsCards} />
            </div>

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
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-white text-lg">
                      Beispiel Lektion aus der PAT Mentorship 2024
                    </h4>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-4 text-sm">
                    <span className="px-2 py-1 bg-slate-800 rounded-md text-blue-400">
                      Fair Value Gap
                    </span>
                    <span className="px-2 py-1 bg-slate-800 rounded-md text-blue-400">
                      Overnight Hours
                    </span>
                    <span className="px-2 py-1 bg-slate-800 rounded-md text-blue-400">
                      Quad Grading
                    </span>
                  </div>
                </div>
              </div>
            </CardWithMatrix>

            {/* Feature Cards */}
            <div className="grid grid-cols-2 gap-4">
              {featureCards.map((card, index) => (
                <CardWithMatrix key={index} {...card} />
              ))}
            </div>
          </div>

          {/* Right Column */}
          <div className="hidden lg:block">
            <MentorImageAndStats statsCards={statsCards} />
            
            <div className="mt-8">
              <p className="text-base sm:text-lg text-gray-300 leading-relaxed mt-2">
                Ich werbe nicht mit Lifestyle und Luxus, sondern mit Trades (schaue dir gerne mein YouTube Kanal an).
                Mein Ziel ist es dir eine nachhaltige 
                Fähigkeit zu vermitteln und dir zu helfen ein 
                stabiles monatliches Einkommen aufzubauen und von dort aus kontinuierlich 
                zu wachsen.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// Extracted component for image and stats
function MentorImageAndStats({ statsCards }: { statsCards: StatCard[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      className="relative"
    >
      {/* Main Image */}
      <div className="relative aspect-[4/3] lg:aspect-[3/4] rounded-2xl overflow-hidden">
        <Image
          src="/images/mentor-image-2.png"
          alt="Trading Mentor"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 mt-4 lg:absolute lg:-bottom-6 lg:-right-6 lg:max-w-[340px]">
        {statsCards.map((card, index) => (
          <CardWithMatrix key={index} {...card} />
        ))}
      </div>
    </motion.div>
  )
}