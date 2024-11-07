// src/components/sections/pricing-comparison.tsx
"use client"
import { Card } from "@/components/ui/card"
import { Check, X } from "lucide-react"
import { motion } from "framer-motion"

const comparisonData = {
  categories: [
    {
      name: "Pricing & Commitment",
      features: [
        {
          name: "Initial Cost",
          us: "€150/month",
          others: "€5000+ upfront",
          highlight: true,
          description: "Start with low monthly payments vs. large upfront investment"
        },
        {
          name: "Cancellation Policy",
          us: "Cancel anytime",
          others: "No cancellation",
          highlight: true,
          description: "Flexible commitment vs. locked-in payment"
        },
        {
          name: "Additional Costs",
          us: "Only TradingView",
          others: "Expensive proprietary software",
          highlight: true,
          description: "Use industry-standard tools vs. costly special software"
        }
      ]
    },
    {
      name: "Learning Experience",
      features: [
        {
          name: "Market Analysis",
          us: "Live market conditions",
          others: "Pre-recorded, outdated examples",
          highlight: true,
          description: "Learn from current market movements vs. historical scenarios"
        },
        {
          name: "Trading Sessions",
          us: "Live trading included",
          others: "Extra payment required",
          highlight: true,
          description: "Real-time trading experience included in base price"
        },
        {
          name: "Teaching Approach",
          us: "Clean price action",
          others: "Indicator-heavy charts",
          description: "Clear, professional analysis vs. cluttered indicators"
        }
      ]
    },
    {
      name: "Support & Community",
      features: [
        {
          name: "Mentorship Style",
          us: "Personal guidance",
          others: "One of thousands",
          highlight: true,
          description: "Individual attention vs. mass education"
        },
        {
          name: "Community Size",
          us: "Limited to 100 traders",
          others: "Unlimited members",
          description: "Focused group vs. overcrowded community"
        },
        {
          name: "Long-term Access",
          us: "Lifetime access after 1 year",
          others: "Limited time access",
          highlight: true,
          description: "Permanent access vs. temporary content availability"
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
          <p className="text-blue-600 font-semibold mb-4">VALUE COMPARISON</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Why Choose Our Mentorship?
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            Compare our approach with traditional trading courses
          </p>
        </div>

        <Card className="overflow-hidden border-0 shadow-2xl">
          {/* Header */}
          <div className="grid grid-cols-12 bg-gray-50 p-6 border-b">
            <div className="col-span-4">
              <p className="font-semibold text-gray-900">Features</p>
            </div>
            <div className="col-span-4 text-center">
              <p className="font-semibold text-blue-600">Our Mentorship</p>
            </div>
            <div className="col-span-4 text-center">
              <p className="font-semibold text-gray-600">Other Courses</p>
            </div>
          </div>

          {/* Content */}
          <div className="divide-y">
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
                        {feature.highlight ? (
                          <X className="h-5 w-5 text-red-500" />
                        ) : null}
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
                Choose a mentorship that prioritizes your success without the heavy upfront costs
            </h3>
            </div>
      </div>
    </section>
  )
}