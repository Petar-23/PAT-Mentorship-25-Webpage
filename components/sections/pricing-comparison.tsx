
"use client"
import { Card } from "@/components/ui/card"
import { Check, X, ArrowRight } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { SignInButton, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { HeroPill } from "@/components/ui/hero-pill"

interface Feature {
  name: string
  us: string
  others: string
  highlight: boolean
  description: string
}

interface Category {
  name: string
  features: Feature[]
}

interface MobileFeatureCardProps {
  feature: Feature
}

function MobileFeatureCard({ feature }: MobileFeatureCardProps) {
  return (
    <motion.div
      className={`p-3 space-y-2.5 ${feature.highlight ? 'bg-emerald-50/40' : 'bg-white'}`}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      <div>
        <p className="text-sm font-semibold text-gray-800 mb-1">{feature.name}</p>
        <p className="text-xs text-gray-600 leading-relaxed">{feature.description}</p>
      </div>
      
      {/* Our Mentorship */}
      <div className="bg-emerald-50 rounded-lg p-2.5 border border-emerald-200">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="size-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
            <Check className="h-3 w-3 text-white" />
          </div>
          <span className="text-xs font-semibold text-emerald-700">Meine Mentorship</span>
        </div>
        <p className="text-xs text-gray-800 pl-7">{feature.us}</p>
      </div>

      {/* Other Courses */}
      <div className="bg-red-50 rounded-lg p-2.5 border border-red-200">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="size-5 rounded-full bg-red-500 flex items-center justify-center shrink-0">
            <X className="h-3 w-3 text-white" />
          </div>
          <span className="text-xs font-semibold text-red-700">Andere Kurse</span>
        </div>
        <p className="text-xs text-gray-800 pl-7">{feature.others}</p>
      </div>
    </motion.div>
  )
}

const comparisonData: { categories: Category[] } = {
  categories: [
    {
      name: "Preise & Verpflichtung",
      features: [
        {
          name: "Startkosten",
          us: "€150/Monat (inkl. MwSt.)",
          others: "€3.000+ vorab",
          highlight: true,
          description: "Niedrige monatliche Zahlungen vs. hohe Vorabinvestition"
        },
        {
          name: "Kündigungsbedingungen",
          us: "Jederzeit kündbar",
          others: "Keine Kündigung",
          highlight: true,
          description: "Flexible Bindung vs. feste Vertragslaufzeit"
        },
        {
          name: "Zusatzkosten",
          us: "Nur TradingView",
          others: "Eigene Spezialsoftware",
          highlight: true,
          description: "Branchenstandard-Tools vs. kostspielige Spezialsoftware"
        }
      ]
    },
    {
      name: "Lernerfahrung",
      features: [
        {
          name: "Marktanalyse",
          us: "Live Marktbedingungen",
          others: "Voraufgezeichnet",
          highlight: true,
          description: "Lernen an aktuellen Marktbewegungen vs. historische Beispiele"
        },
        {
          name: "Live Trading",
          us: "Live Trading / Tape Reading",
          others: "Zusätzliche Kosten",
          highlight: true,
          description: "Live Trading und Tape Reading"
        },
        {
          name: "Lehrmethode",
          us: "Klare Price Action",
          others: "Viele Indikatoren",
          highlight: true,
          description: "Saubere Analyse vs. überladene Charts"
        }
      ]
    },
    {
      name: "Support & Community",
      features: [
        {
          name: "Mentoring-Stil",
          us: "Persönliche Betreuung",
          others: "Einer von Tausenden",
          highlight: true,
          description: "Individuelle Aufmerksamkeit vs. Massenabfertigung"
        },
        {
          name: "Community-Größe",
          us: "Limitiert auf 100",
          others: "Unbegrenzt",
          highlight: true,
          description: "Fokussierte Gruppe vs. überfüllte Community"
        }
      ]
    }
  ]
}

export default function PricingComparison() {
  const { isSignedIn } = useUser()
  const router = useRouter()

  const handleClick = () => {
    if (isSignedIn) {
      router.push('/dashboard')
    }
  }

  return (
    <section className="py-12 sm:py-24 bg-white">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-8 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 pr-3 sm:pr-4 py-1 rounded-full bg-blue-50 ring-1 ring-blue-200 mb-4 sm:mb-6">
            <div className="bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 text-xs sm:text-sm">⚖️</div>
            <span className="text-xs sm:text-sm font-medium text-blue-700">Vergleich</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2 sm:mb-4">
            Warum meine Mentorship?
          </h2>
          <p className="text-sm sm:text-lg text-gray-600 max-w-2xl mx-auto">
            Mein Ansatz im Vergleich zu traditionellen Trading-Kursen
          </p>
        </div>

        <Card className="overflow-hidden border-0 shadow-2xl">
          {/* Mobile Version */}
          <div className="md:hidden divide-y bg-white">
            {comparisonData.categories.map((category, categoryIndex) => (
              <div key={categoryIndex} className="divide-y">
                <div className="p-3 bg-slate-800">
                  <p className="text-sm font-semibold text-white">{category.name}</p>
                </div>
                {category.features.map((feature, featureIndex) => (
                  <MobileFeatureCard key={featureIndex} feature={feature} />
                ))}
              </div>
            ))}
          </div>

          {/* Desktop Version */}
          <div className="hidden md:block">
            {/* Sticky Header */}
            <div className="grid grid-cols-12 bg-slate-100 p-6 border-b sticky top-0 z-10">
              <div className="col-span-4 flex items-center">
                <p className="font-semibold text-gray-900">Features</p>
              </div>
              <div className="col-span-4 flex justify-center">
                <HeroPill
                  variant="emerald"
                  size="default"
                  className="py-2 text-sm font-semibold"
                  announcement={<Check className="h-4 w-4" />}
                  label="Meine Mentorship"
                />
              </div>
              <div className="col-span-4 flex justify-center">
                <HeroPill
                  variant="red"
                  size="default"
                  className="py-2 text-sm font-semibold"
                  announcement={<X className="h-4 w-4" />}
                  label="Andere Kurse"
                />
              </div>
            </div>
            
            <div className="divide-y">
              {comparisonData.categories.map((category, categoryIndex) => (
                <div key={categoryIndex} className="divide-y">
                  <div className="p-6 bg-slate-800">
                    <p className="font-semibold text-white">{category.name}</p>
                  </div>
                  {category.features.map((feature, featureIndex) => (
                    <motion.div
                      key={featureIndex}
                      className="grid grid-cols-12 hover:bg-slate-50 transition-colors"
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: featureIndex * 0.05 }}
                    >
                      <div className="col-span-4 p-6 flex items-center">
                        <div>
                          <p className="font-semibold text-gray-800">{feature.name}</p>
                          <p className="text-sm text-gray-600 mt-1">{feature.description}</p>
                        </div>
                      </div>
                      {/* Meine Mentorship - grüner Hintergrund */}
                      <div className="col-span-4 flex items-center justify-center bg-emerald-50/60 border-x border-emerald-100 p-6">
                        <span className="inline-flex items-center gap-2.5 text-emerald-700 font-semibold text-sm">
                          <div className="size-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                            <Check className="h-3.5 w-3.5 text-white" />
                          </div>
                          {feature.us}
                        </span>
                      </div>
                      {/* Andere Kurse */}
                      <div className="col-span-4 flex items-center justify-center p-6">
                        <span className="inline-flex items-center gap-2.5 text-gray-600 text-sm">
                          {feature.highlight && (
                            <div className="size-6 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                              <X className="h-3.5 w-3.5 text-white" />
                            </div>
                          )}
                          {feature.others}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Bottom CTA */}
        <div className="mt-8 sm:mt-12 text-center space-y-6">
          <h3 className="text-lg sm:text-2xl md:text-3xl font-bold text-gray-900">
            Wähle eine Lernmethode, die deinen Erfolg priorisiert
          </h3>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isSignedIn ? (
              <Button size="lg" onClick={handleClick} className="gap-2">
                Jetzt Platz sichern
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <Button size="lg" className="gap-2">
                  Jetzt Platz sichern
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </SignInButton>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}