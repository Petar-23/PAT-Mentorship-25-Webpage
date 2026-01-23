import Image from "next/image"
import { BadgeCheck, Quote, Star } from "lucide-react"
import { GradientCard } from "@/components/ui/gradient-card"

interface TestimonialCardProps {
  testimonial: {
    quote: string
    author: string
    role: string
    results: {
      label: string
      value: string
      description: string
    }
    gradientColor: string
  }
  isMobile: boolean
  onClick: () => void
}

export function TestimonialCard({ testimonial, isMobile, onClick }: TestimonialCardProps) {
  const isWhopReview = testimonial.role.toLowerCase().includes('whop')

  return (
    <GradientCard
      gradientColor={isWhopReview ? 'rgba(0, 0, 0, 0)' : testimonial.gradientColor}
      className="bg-white border-gray-200 transition-transform md:hover:scale-[1.02] w-[calc(100vw-32px)] sm:w-[400px] sm:mx-3"
    >
      <button
        type="button"
        className="w-full text-left cursor-pointer"
        onClick={onClick}
        aria-label={`Testimonial von ${testimonial.author} anzeigen`}
      >
      <div className="p-4 sm:p-6 flex flex-col gap-3 sm:gap-4 min-h-[260px] sm:min-h-[320px]">
        {/* Header */}
        <div className="flex-shrink-0">
          {isWhopReview ? (
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <Image
                  src="/images/whop-logo.png"
                  alt="Whop"
                  width={28}
                  height={28}
                  className="h-5 w-5 sm:h-7 sm:w-7"
                />
                <p className="text-xs sm:text-sm font-semibold text-gray-900">Whop Review</p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-0.5 sm:gap-1 text-amber-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3 w-3 sm:h-4 sm:w-4 fill-current" />
                  ))}
                </div>
                <span className="inline-flex items-center gap-0.5 sm:gap-1 rounded-full bg-emerald-50 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                  <BadgeCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  Verifiziert
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <Quote className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500" />
              <span className="inline-flex items-center gap-0.5 sm:gap-1 rounded-full bg-emerald-50 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                <BadgeCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                Verifiziert
              </span>
            </div>
          )}
        </div>
        
        {/* Quote */}
        <div className="flex-grow">
          <p
            className={`break-words whitespace-pre-wrap text-gray-900 leading-relaxed ${
              isMobile ? 'text-sm sm:text-base line-clamp-4' : 'text-sm line-clamp-3'
            }`}
          >
            {testimonial.quote}
          </p>
        </div>
        
        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-100 pt-3 sm:pt-4 mt-auto">
          <div className="mb-3 sm:mb-4">
            <p className="text-sm sm:text-base font-semibold text-gray-900">{testimonial.author}</p>
            <p className="text-xs sm:text-sm text-gray-600">{testimonial.role}</p>
          </div>
          
          <div className="bg-emerald-50/70 rounded-lg p-2 sm:p-3 border border-emerald-100">
            <p className="text-xs sm:text-sm text-gray-700">{testimonial.results.label}</p>
            <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
              <p className="text-xl sm:text-2xl font-bold text-green-600">
                {testimonial.results.value}
              </p>
              <p className="text-xs sm:text-sm text-gray-600">
                {testimonial.results.description}
              </p>
            </div>
          </div>
        </div>
      </div>
      </button>
    </GradientCard>
  )
}