// src/components/sections/why-different.tsx
import { PlayCircle, Users, Calendar, Clock, Trophy, CreditCard } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

const features = [
  {
    icon: <PlayCircle className="h-6 w-6" />,
    title: "Live Market Analysis",
    description: "Learn from real-time price action, not outdated examples. Watch and analyze the markets as they move.",
  },
  {
    icon: <Calendar className="h-6 w-6" />,
    title: "2-3 Live Sessions Weekly",
    description: "Regular live streams for teaching, exercises, and eventually live trading sessions.",
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: "Public 1:1 Sessions",
    description: "Get your specific questions answered in public mentoring sessions that benefit all members.",
  },
  {
    icon: <Clock className="h-6 w-6" />,
    title: "Flexible Commitment",
    description: "Monthly subscription with the freedom to cancel if you don't feel the value - we're that confident.",
  },
  {
    icon: <Trophy className="h-6 w-6" />,
    title: "Lifetime Access",
    description: "Complete the year-long program and get lifetime access to all materials and future updates.",
  },
  {
    icon: <CreditCard className="h-6 w-6" />,
    title: "Fair Pricing",
    description: "€150/month with no upfront fees or hidden costs. Pay monthly, cancel anytime.",
  },
]

export default function WhyDifferent() {
  return (
    <section className="py-24 bg-gray-50">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Not Just Another Trading Course
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            A dynamic, live mentorship program that evolves with the market
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="border-2 hover:border-blue-500/20 transition-colors">
              <CardContent className="pt-6">
                <div className="flex flex-col h-full">
                  <div className="text-blue-500 bg-blue-50 p-3 rounded-lg w-fit mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">
                    {feature.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}