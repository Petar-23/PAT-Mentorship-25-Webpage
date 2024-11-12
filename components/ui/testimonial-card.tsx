import { Quote } from "lucide-react"
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
  return (
    <GradientCard
      gradientColor={testimonial.gradientColor}
      className={`bg-white border-gray-200 cursor-pointer transition-transform hover:scale-[1.02] ${
        isMobile ? 'w-[calc(100vw-32px)]' : 'w-[400px] mx-3'
      }`}
      onClick={onClick}
    >
      <div className="p-6 flex flex-col gap-4 min-h-[320px]">
        {/* Header */}
        <div className="flex-shrink-0">
          <Quote className="h-8 w-8 text-blue-500" />
        </div>
        
        {/* Quote */}
        <div className="flex-grow">
          <p className="line-clamp-3 text-gray-900 break-words whitespace-pre-wrap">
            {testimonial.quote}
          </p>
        </div>
        
        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-100 pt-4 mt-auto">
          <div className="mb-4">
            <p className="font-semibold text-gray-900">{testimonial.author}</p>
            <p className="text-sm text-gray-500">{testimonial.role}</p>
          </div>
          
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
}