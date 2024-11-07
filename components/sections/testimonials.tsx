// src/components/sections/testimonials.tsx
import { Card } from "@/components/ui/card"
import { GradientCard } from "@/components/ui/gradient-card"
import { InfiniteScroll } from "@/components/ui/infinite-scroll"
import { Quote, TrendingUp, ChartBar } from "lucide-react"

const testimonials = [
    {
      quote: "The live trading sessions were a game-changer. Learning to analyze price action in real-time accelerated my growth tremendously.",
      author: "Michael R.",
      role: "Full-time Trader",
      results: {
        label: "Monthly Return",
        value: "+18%",
        description: "Average after 6 months"
      },
      gradientColor: "rgba(59, 130, 246, 0.2)"
    },
    {
      quote: "What sets this apart is the focus on live market analysis. No outdated examples, just real-time learning and adaptation.",
      author: "Sarah K.",
      role: "Professional Trader",
      results: {
        label: "Win Rate",
        value: "67%",
        description: "Last 100 trades"
      },
      gradientColor: "rgba(147, 51, 234, 0.2)"
    },
    {
      quote: "The community aspect is invaluable. Learning from others' trades and analyses provided perspectives I would've missed trading alone.",
      author: "David L.",
      role: "Institutional Trader",
      results: {
        label: "Account Growth",
        value: "142%",
        description: "In first year"
      },
      gradientColor: "rgba(16, 185, 129, 0.2)"
    },
    // Add more testimonials...
    {
      quote: "The ICT concepts taught here completely transformed my understanding of market structure.",
      author: "James T.",
      role: "Forex Trader",
      results: {
        label: "Success Rate",
        value: "73%",
        description: "Major setups"
      },
      gradientColor: "rgba(59, 130, 246, 0.2)"
    },
    {
      quote: "Learning to read order flow and market structure in real-time has been invaluable.",
      author: "Emma S.",
      role: "Crypto Trader",
      results: {
        label: "Portfolio Growth",
        value: "215%",
        description: "Since joining"
      },
      gradientColor: "rgba(147, 51, 234, 0.2)"
    },
    {
        quote: "Learning to read order flow and market structure in real-time has been invaluable.",
        author: "Emma S.",
        role: "Crypto Trader",
        results: {
          label: "Portfolio Growth",
          value: "215%",
          description: "Since joining"
        },
        gradientColor: "rgba(147, 51, 234, 0.2)"
      },
    // Add more testimonials to reach 10+
  ]

const TestimonialCard = ({ testimonial }: { testimonial: typeof testimonials[0] }) => (
<GradientCard
    gradientColor={testimonial.gradientColor}
    className="mx-3 bg-white border-gray-200 h-full"
>
    <Quote className="h-8 w-8 text-blue-500 mb-4 flex-shrink-0" />
    <blockquote className="text-gray-900 mb-6 whitespace-normal line-clamp-4">
    {testimonial.quote}
    </blockquote>
    
    <div className="border-t border-gray-100 pt-4 mt-auto">
    <p className="font-semibold text-gray-900">{testimonial.author}</p>
    <p className="text-gray-500 text-sm mb-4">{testimonial.role}</p>
    
    <div className="bg-gray-50 rounded-lg p-3">
        <p className="text-sm text-gray-600">{testimonial.results.label}</p>
        <div className="flex items-end gap-2">
        <p className="text-2xl font-bold text-green-600">
            {testimonial.results.value}
        </p>
        <p className="text-sm text-gray-500 mb-1">
            {testimonial.results.description}
        </p>
        </div>
    </div>
    </div>
</GradientCard>
)

export default function Testimonials() {
    // Split testimonials into two arrays
    const firstHalf = testimonials.slice(0, Math.ceil(testimonials.length / 2))
    const secondHalf = testimonials.slice(Math.ceil(testimonials.length / 2))
    return (
        <section className="py-24 bg-white">
        <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-16">
            <p className="text-blue-600 font-semibold mb-4">TRADER SUCCESS STORIES</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Learn From Successful Mentees
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto text-lg">
                Real results from traders who committed to their growth through our mentorship program
            </p>
            </div>

            {/* Stats Overview */}
            <div className="grid md:grid-cols-3 gap-8 mb-20">
            <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100/50">
                <div className="flex items-center gap-4">
                <div className="bg-blue-500 rounded-lg p-3 text-white">
                    <TrendingUp className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-2xl font-bold text-blue-600">89%</p>
                    <p className="text-sm text-gray-600">Success Rate</p>
                </div>
                </div>
            </Card>
            <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100/50">
                <div className="flex items-center gap-4">
                <div className="bg-purple-500 rounded-lg p-3 text-white">
                    <ChartBar className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-2xl font-bold text-purple-600">€2.8M+</p>
                    <p className="text-sm text-gray-600">Combined Profits</p>
                </div>
                </div>
            </Card>
            <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100/50">
                <div className="flex items-center gap-4">
                <div className="bg-green-500 rounded-lg p-3 text-white">
                    <Quote className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-2xl font-bold text-green-600">250+</p>
                    <p className="text-sm text-gray-600">Active Traders</p>
                </div>
                </div>
            </Card>
            </div>

            {/* Infinite Scroll Testimonials */}
            <div className="relative">
            {/* Gradient Overlays */}
            <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white to-transparent z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white to-transparent z-10" />
            
            {/* First Row */}
          <div className="pb-8">
            <InfiniteScroll speed={30} className="py-4">
              {firstHalf.map((testimonial, index) => (
                <div key={index} className="flex-shrink-0 w-[400px]">
                  <TestimonialCard testimonial={testimonial} />
                </div>
              ))}
            </InfiniteScroll>
          </div>

          {/* Second Row */}
          <div className="pb-4">
            <InfiniteScroll direction="right" speed={35} className="py-4">
              {secondHalf.map((testimonial, index) => (
                <div key={index} className="flex-shrink-0 w-[400px]">
                  <TestimonialCard testimonial={testimonial} />
                </div>
              ))}
            </InfiniteScroll>
          </div>
        </div>

            {/* Disclaimer */}
            <p className="text-sm text-gray-500 text-center mt-8">
            *Results may vary. Trading carries risk. Past performance does not guarantee future results.
            </p>
        </div>
        </section>
    )
}