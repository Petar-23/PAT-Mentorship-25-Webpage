'use client'

import { useRef, useState } from "react"
import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { GradientCard } from "@/components/ui/gradient-card"
import { InfiniteScroll } from "@/components/ui/infinite-scroll"
import { Quote, TrendingUp, ChartBar } from "lucide-react"
import { useMediaQuery } from "@/hooks/use-media-query"

const testimonials = [
  {
    quote: "Dank Petar und der Mentorship, habe ich meinen dritten Payout Requested. Kann nur sagen das sich die Mentorship lohnt!",
    author: "Tommy H.",
    role: "Future Trader",
    results: {
      label: "Win-Rate",
      value: "+18%",
      description: "Durchschnitt nach 6 Monaten"
    },
    gradientColor: "rgba(59, 130, 246, 0.1)"
  },
  {
    quote: "Ich danke @Petar und der ganzen Community. Wir formen  uns gemeinsam zu ICT Tradern und die Ergebnisse lassen sich sehen und es folgen bald viele andere.",
    author: "Sergej M.",
    role: "Future Trader",
    results: {
      label: "Win-Rate",
      value: "+25%",
      description: "Durchschnitt nach 6 Monaten"
    },
    gradientColor: "rgba(59, 130, 246, 0.1)"
  },
  // 
  {
    quote: "Ich habe in fünf Tagen knappe 10K Dollar ertradet mit diesen drei Fundet Konten. Ein ganz besonderer Dank geht natürlich raus an @Petar. Danke Bro für die Zeit welche Du investierst für uns.",
    author: "Michael G.",
    role: "Future Trader",
    results: {
      label: "Payouts",
      value: "+9.000 USD",
      description: "Nach 6 Monaten"
    },
    gradientColor: "rgba(59, 130, 246, 0.1)"
  },
  // 
  {
    quote: "Was für eine Woche!! 7 Tage in Folge jeden Tag +1000$ in copy auf 4 PA-Konten. Ich denke ich habe es endlich geschafft.",
    author: "Nikolaus K.",
    role: "Future Trader",
    results: {
      label: "Payout",
      value: "+20.000 USD",
      description: "Nach 6 Monaten"
    },
    gradientColor: "rgba(59, 130, 246, 0.1)"
  },
  // 
  // ... other testimonials
]

const TestimonialCard = ({ testimonial, isMobile }: { 
  testimonial: typeof testimonials[0]
  isMobile: boolean 
}) => (
  <GradientCard
    gradientColor={testimonial.gradientColor}
    className={`bg-white border-gray-200 ${
      isMobile ? 'w-[calc(100vw-32px)]' : 'w-[400px] mx-3'
    }`}
  >
    <div className="p-6">
      <Quote className="h-8 w-8 text-blue-500 mb-4 flex-shrink-0" />
      <div className="text-gray-900 mb-6 break-words">
        <p className="line-clamp-4 whitespace-normal">{testimonial.quote}</p>
      </div>
      
      <div className="border-t border-gray-100 pt-4 mt-auto">
        <p className="font-semibold text-gray-900">{testimonial.author}</p>
        <p className="text-sm text-gray-500 mb-4">{testimonial.role}</p>
        
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-sm text-gray-600">{testimonial.results.label}</p>
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-2xl font-bold text-green-600">
              {testimonial.results.value}
            </p>
            <p className="text-sm text-gray-500">
              {testimonial.results.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  </GradientCard>
)

export default function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const isMobile = useMediaQuery("(max-width: 768px)")
  const [touchStart, setTouchStart] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Split testimonials for desktop scroll
  const firstHalf = testimonials.slice(0, Math.ceil(testimonials.length / 2))
  const secondHalf = testimonials.slice(Math.ceil(testimonials.length / 2))

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return

    const currentTouch = e.touches[0].clientX
    const diff = touchStart - currentTouch

    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentIndex < testimonials.length - 1) {
        setCurrentIndex(prev => prev + 1)
      } else if (diff < 0 && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1)
      }
      setTouchStart(0)
    }
  }

  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid md:grid-cols-3 gap-4 mb-12">
            <StatCard
              icon={<TrendingUp className="h-6 w-6" />}
              value="25%"
              label="Erfolgsquote (nach 6 Monaten)"
              color="blue"
            />
            <StatCard
              icon={<ChartBar className="h-6 w-6" />}
              value="36.000 USD"
              label="Kombinierte Payouts (nach 6 Monaten)"
              color="purple"
            />
            <StatCard
              icon={<Quote className="h-6 w-6" />}
              value="90+"
              label="Aktive Trader"
              color="green"
            />
          </div>

        {isMobile ? (
          // Mobile Layout
          <div className="relative">
            <div 
              ref={containerRef}
              className="overflow-hidden touch-pan-x"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
            >
              <motion.div
                className="flex"
                animate={{ x: `-${currentIndex * 100}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                {testimonials.map((testimonial, index) => (
                  <div 
                    key={index} 
                    className="min-w-full flex-shrink-0 flex justify-center"
                  >
                    <TestimonialCard testimonial={testimonial} isMobile={true} />
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Pagination Dots */}
            <div className="flex justify-center mt-6 gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentIndex ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                  onClick={() => setCurrentIndex(index)}
                />
              ))}
            </div>
          </div>
        ) : (
          // Desktop Layout - remains the same
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white to-transparent z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white to-transparent z-10" />
            
            <div className="pb-8">
              <InfiniteScroll speed={30} className="py-4">
                {firstHalf.map((testimonial, index) => (
                  <div key={index} className="flex-shrink-0">
                    <TestimonialCard testimonial={testimonial} isMobile={false} />
                  </div>
                ))}
              </InfiniteScroll>
            </div>

            <div className="pb-4">
              <InfiniteScroll direction="right" speed={35} className="py-4">
                {secondHalf.map((testimonial, index) => (
                  <div key={index} className="flex-shrink-0">
                    <TestimonialCard testimonial={testimonial} isMobile={false} />
                  </div>
                ))}
              </InfiniteScroll>
            </div>
          </div>
        )}

        <p className="text-sm text-gray-500 text-center mt-8">
          *Ergebnisse können variieren. Trading ist mit Risiken verbunden. Vergangene Leistungen garantieren keine zukünftigen Ergebnisse.
        </p>
      </div>
    </section>
  )
}
const StatCard = ({ icon, value, label, color }: { 
  icon: React.ReactNode
  value: string
  label: string
  color: 'blue' | 'purple' | 'green'
}) => {
  const colorClasses = {
    blue: "from-blue-50 to-blue-100/50",
    purple: "from-purple-50 to-purple-100/50",
    green: "from-green-50 to-green-100/50"
  }

  return (
    <Card className={`p-4 bg-gradient-to-br ${colorClasses[color]}`}>
      <div className="flex items-center gap-4">
        <div className={`bg-${color}-500 rounded-lg p-3 text-white`}>
          {icon}
        </div>
        <div>
          <p className={`text-xl font-bold text-${color}-600`}>{value}</p>
          <p className="text-sm text-gray-600">{label}</p>
        </div>
      </div>
    </Card>
  )
}