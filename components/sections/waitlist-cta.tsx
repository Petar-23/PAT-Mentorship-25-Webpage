// src/components/sections/waitlist-cta.tsx
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export default function WaitlistCTA() {
  return (
    <section id="waitlist" className="py-20 px-4 md:px-6 bg-white">
      <div className="container mx-auto max-w-6xl">
        <Card className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-8 md:p-12">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to Transform Your Career?
              </h2>
              <p className="text-lg opacity-90 mb-6">
                Join our waitlist today and be among the first to secure your spot 
                in our 2025 Mentorship Program.
              </p>
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Join Waitlist Now
              </Button>
            </div>
            
            <div className="space-y-6">
              <div className="bg-white/10 rounded-lg p-4">
                <p className="font-medium">🎯 Limited spots available</p>
                <p className="text-sm opacity-90">
                  We keep our program exclusive to ensure quality mentorship
                </p>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <p className="font-medium">🚀 Program starts March 2025</p>
                <p className="text-sm opacity-90">
                  Early waitlist members get priority access
                </p>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <p className="font-medium">💎 No payment until program starts</p>
                <p className="text-sm opacity-90">
                  Secure your spot now, pay when the program begins
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  )
}