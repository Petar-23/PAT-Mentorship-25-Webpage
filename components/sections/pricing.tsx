// src/components/sections/pricing.tsx
import { Check } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const features = [
  "1:1 Mentorship Sessions",
  "Personalized Growth Plan",
  "Community Access",
  "Resource Library",
  "Progress Tracking",
  "Priority Support",
]

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 px-4 md:px-6 bg-gray-50">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-gray-600">
            Join our waitlist today to secure your spot in the 2026 program.
          </p>
        </div>

        <Card className="relative border-2">
          
          <div className="absolute top-0 right-0 mr-6 -mt-4">
            <span className="inline-flex items-center rounded-full bg-blue-50 px-4 py-1 text-sm font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
              Limited Spots
            </span>
          </div>
          
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Mentorship Program</CardTitle>
            <CardDescription>Starting March 2026</CardDescription>
            <div className="mt-4">
              <span className="text-4xl font-bold">€150</span>
              <span className="text-gray-600">/month</span>
            </div>
          </CardHeader>
          
          <CardContent>
            <ul className="space-y-4">
              {features.map((feature) => (
                <li key={feature} className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-blue-500" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          
          <CardFooter>
            <Button className="w-full" size="lg">
              Join Waitlist
            </Button>
          </CardFooter>
        </Card>
      </div>
    </section>
  )
}