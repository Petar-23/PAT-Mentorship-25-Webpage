
"use client"
import { Card } from "@/components/ui/card"
import { Check, X } from "lucide-react"
import { motion } from "framer-motion"

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
      className={`p-4 space-y-4 ${feature.highlight ? 'bg-blue-50/20' : ''}`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      <div>
        <p className="font-medium text-gray-900 mb-2">{feature.name}</p>
        <p className="text-sm text-gray-500 mb-4">{feature.description}</p>
      </div>
      
      {/* Our Mentorship */}
      <div className="bg-white rounded-lg p-3 border border-blue-100">
        <p className="text-sm font-medium text-blue-600 mb-2">Live Mentorship:</p>
        <span className="inline-flex items-center gap-2 text-gray-900">
          <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <span>{feature.us}</span>
        </span>
      </div>

      {/* Other Courses */}
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
        <p className="text-sm font-medium text-gray-600 mb-2">Andere Kurse:</p>
        <span className="inline-flex items-center gap-2 text-gray-700">
          {feature.highlight && <X className="h-4 w-4 text-red-500 flex-shrink-0" />}
          <span>{feature.others}</span>
        </span>
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
          us: "€150/Monat",
          others: "€3500+ vorab",
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
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-16">
          <p className="text-blue-600 font-semibold mb-4">VERGLEICH</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Warum eine Live Mentorship?
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            Unser Ansatz im Vergleich zu traditionellen Trading-Kursen
          </p>
        </div>

        <Card className="overflow-hidden border-0 shadow-2xl">
          {/* Mobile Version */}
          <div className="md:hidden divide-y">
            {comparisonData.categories.map((category, categoryIndex) => (
              <div key={categoryIndex} className="divide-y">
                <div className="p-4 bg-gray-50">
                  <p className="font-semibold text-gray-900">{category.name}</p>
                </div>
                {category.features.map((feature, featureIndex) => (
                  <MobileFeatureCard key={featureIndex} feature={feature} />
                ))}
              </div>
            ))}
          </div>

          {/* Desktop Version */}
          <div className="hidden md:block divide-y">
            <div className="grid grid-cols-12 bg-gray-50 p-6 border-b">
              <div className="col-span-4">
                <p className="font-semibold text-gray-900">Features</p>
              </div>
              <div className="col-span-4 text-center">
                <p className="font-semibold text-blue-600">Live Mentorship</p>
              </div>
              <div className="col-span-4 text-center">
                <p className="font-semibold text-gray-600">Andere Kurse</p>
              </div>
            </div>
            
            {comparisonData.categories.map((category, categoryIndex) => (
              <div key={categoryIndex} className="divide-y">
                <div className="p-6 bg-gray-50/50">
                  <p className="font-semibold text-gray-900">{category.name}</p>
                </div>
                {category.features.map((feature, featureIndex) => (
                  <motion.div
                    key={featureIndex}
                    className={`grid grid-cols-12 p-6 hover:bg-blue-50/50 transition-colors ${
                      feature.highlight ? 'bg-blue-50/20' : ''
                    }`}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: featureIndex * 0.1 }}
                  >
                    <div className="col-span-4">
                      <p className="font-medium text-gray-900">{feature.name}</p>
                      <p className="text-sm text-gray-500 mt-1">{feature.description}</p>
                    </div>
                    <div className="col-span-4 text-center flex items-center justify-center">
                      <span className="inline-flex items-center gap-2 text-blue-600 font-medium">
                        <Check className="h-5 w-5 text-blue-500" />
                        {feature.us}
                      </span>
                    </div>
                    <div className="col-span-4 text-center flex items-center justify-center">
                      <span className="inline-flex items-center gap-2 text-gray-500">
                        {feature.highlight && <X className="h-5 w-5 text-red-500" />}
                        {feature.others}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            ))}
          </div>
        </Card>

        {/* Bottom Note */}
        <div className="mt-12 text-center">
          <h3 
            className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-[linear-gradient(to_right,theme(colors.blue.600),theme(colors.purple.600),theme(colors.blue.600))] animate-text-shine inline-flex"
            style={{
              backgroundSize: '200% auto',
            }}
          >
            Wähle eine Lernmethode, die deinen Erfolg ohne hohe Vorabkosten priorisiert
          </h3>
        </div>
      </div>
    </section>
  )
}