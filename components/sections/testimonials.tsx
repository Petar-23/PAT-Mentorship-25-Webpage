'use client'

import { useRef, useState } from "react"
import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { GradientCard } from "@/components/ui/gradient-card"
import { InfiniteScroll } from "@/components/ui/infinite-scroll"
import { Quote, TrendingUp, Receipt, ChartCandlestick } from "lucide-react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { TestimonialModal } from "../ui/testimonial-modal"
import { TestimonialCard } from "../ui/testimonial-card"

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
    gradientColor: "rgba(59, 130, 246, 0)"
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
    gradientColor: "rgba(59, 130, 246, 0)"
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
    gradientColor: "rgba(59, 130, 246, 0)"
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
    gradientColor: "rgba(59, 130, 246, 0)"
  },
  {
    quote: "Seit mich ein Freund (danke S.!) zu @Petar gebracht hat, habe ich unheimlich viel über die Price Action gelernt und mich auch persönlich weiterentwickelt: kein Gezocke und kein Hin- und Her mit x-tausend unterschiedlichen Setups und Indikatoren, sondern geduldiges Warten auf wirklich gute Setups mit Hand und Fuß. Und das zahlt sich aus, seitdem hat es sich ins Positive entwickelt und meine Screentime angenehm entschleunigt. Ich habe mich seit vielen Jahren erfolglos mit dem Thema Daytrading beschäftigt und bin nie wirklich weitergekommen - mal gut, mal schlecht, aber im Gesamten negativ mit viel Unsicherheit, ob das alles überhaupt dauerhaft funktionieren kann. Aber nun bin ich absolut sicher, dass es dauerhaft funktionieren wird - auch wenn es Zeit braucht - humble beginnings. @Petar vermittelt die Inhalte mit einer Engelsgeduld auf eine sehr angenehme Weise und auch die Community hinter @Petar ist ein absoluter Mehrwert. Ich bin sehr dankbar, dass ich hier dabei sein darf!",
    author: "Bernhard K.",
    role: "Future Trader Beginner",
    results: {
      label: "Funded Account",
      value: "+30%",
      description: "Challenge Phase"
    },
    gradientColor: "rgba(59, 130, 246, 0)"
  },
  {
    quote: "Ich kenne niemanden der ICT so deutlich erklären und nahebringen kann wie es Petar tut viele beanspruchen diesen Titel für sich aber er gehört eindeutig Petar! seit ich in der Mentorship bin hat sich alles sehr ins Positive entwickelt auch die Community ist sehr hilfsbereit und immer für eine Antwort da. durch diesen Kurs habe ich es geschafft Nicht nur meine Challange für mein Funded Konto zu bestehen sondern dieses ziel auch nach 5 Monaten beim ersten anlauf zu erreichen! keine Burning Accounts, Petar bringt einem erstmal alle Grundlagen Step by Step bei denn nichts ist wichtiger als ein Sicheres und Stabiles Fundament. ",
    author: "ChikoDredd",
    role: "Future Trader",
    results: {
      label: "Funded Account",
      value: "+1",
      description: "Nach 5 Monaten Funded"
    },
    gradientColor: "rgba(59, 130, 246, 0)"
  },
  // 
  // ... other testimonials
]

export default function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedTestimonial, setSelectedTestimonial] = useState<typeof testimonials[0] | null>(null)
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
              icon={<Receipt className="h-6 w-6" />}
              value="46.000+ USD"
              label="Kombinierte Payouts (nach 6 Monaten)"
              color="purple"
            />
            <StatCard
              icon={<ChartCandlestick className="h-6 w-6" />}
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
                    <TestimonialCard 
                      testimonial={testimonial} 
                      isMobile={true}
                      onClick={() => setSelectedTestimonial(testimonial)}
                    />
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
                    <TestimonialCard 
                      testimonial={testimonial} 
                      isMobile={false}
                      onClick={() => setSelectedTestimonial(testimonial)}
                    />
                  </div>
                ))}
              </InfiniteScroll>
            </div>

            <div className="pb-4">
              <InfiniteScroll direction="right" speed={35} className="py-4">
                {secondHalf.map((testimonial, index) => (
                  <div key={index} className="flex-shrink-0">
                    <TestimonialCard 
                      testimonial={testimonial} 
                      isMobile={false}
                      onClick={() => setSelectedTestimonial(testimonial)}
                    />
                  </div>
                ))}
              </InfiniteScroll>
            </div>
          </div>
        )}

        {/* Modal */}
        {selectedTestimonial && (
          <TestimonialModal
            isOpen={!!selectedTestimonial}
            onClose={() => setSelectedTestimonial(null)}
            testimonial={selectedTestimonial}
          />
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
  const bgClasses = {
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    green: "bg-green-500"
  }

  const gradientClasses = {
    blue: "from-blue-50 to-blue-100/50",
    purple: "from-purple-50 to-purple-100/50",
    green: "from-green-50 to-green-100/50"
  }

  const textClasses = {
    blue: "text-blue-600",
    purple: "text-purple-600",
    green: "text-green-600"
  }

  return (
    <Card className={`p-4 bg-gradient-to-br ${gradientClasses[color]}`}>
      <div className="flex items-center gap-4">
        <div className={`${bgClasses[color]} rounded-lg p-3 text-white`}>
          {icon}
        </div>
        <div>
          <p className={`text-xl font-bold ${textClasses[color]}`}>{value}</p>
          <p className="text-sm text-gray-600">{label}</p>
        </div>
      </div>
    </Card>
  )
}