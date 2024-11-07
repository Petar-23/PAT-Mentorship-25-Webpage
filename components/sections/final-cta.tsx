// src/components/sections/final-cta.tsx
"use client"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowRight, Users, Clock, Trophy } from "lucide-react"
import { MouseGradient } from "@/components/ui/mouse-gradient"
import { GlowingCard } from "@/components/ui/glowing-card"
import { Vortex } from "@/components/ui/vortex"

export default function FinalCTA() {
  return (
    <MouseGradient>
      <section className="relative py-24 overflow-hidden">
        {/* Vortex Background */}
        <div className="absolute inset-0 bg-slate-950">
          <Vortex
            particleCount={500}
            baseHue={240}
            baseSpeed={0.2}
            rangeSpeed={1.0}
            baseRadius={0.5}
            rangeRadius={1.5}
            backgroundColor="transparent"
            containerClassName="opacity-30"
          />
        </div>
        
        {/* Content */}
        <div className="container relative z-10 mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Your Trading Journey <br />
                Begins March 2025
              </h2>
              <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                Join 100 dedicated traders in a transformative year of live market analysis, 
                real-time trading, and professional growth.
              </p>
            </motion.div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {[
              {
                icon: <Users className="h-8 w-8 text-blue-400 mb-4" />,
                title: "Limited Spots",
                description: "Only 100 traders will be accepted to ensure quality mentorship"
              },
              {
                icon: <Clock className="h-8 w-8 text-purple-400 mb-4" />,
                title: "Early Access",
                description: "Waitlist members get priority access and program updates"
              },
              {
                icon: <Trophy className="h-8 w-8 text-green-400 mb-4" />,
                title: "Lifetime Access",
                description: "Complete the year and get permanent access to all materials"
              }
            ].map((card, index) => (
              <GlowingCard key={index}>
                <div className="p-6">
                  {card.icon}
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {card.title}
                  </h3>
                  <p className="text-gray-300">
                    {card.description}
                  </p>
                </div>
              </GlowingCard>
            ))}
          </div>

          <motion.div
            className="text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Button 
              size="lg" 
              className="bg-white text-slate-900 hover:bg-white/90 text-lg px-8 py-6 h-auto group"
            >
              <span>Join the Waitlist</span>
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>

            <p className="mt-6 text-gray-400">
              No payment required to join the waitlist
            </p>

            <div className="mt-12 backdrop-blur-md bg-white/5 rounded-lg inline-block px-6 py-3 border border-white/10">
              <p className="text-white text-sm">
                👥 <span className="text-blue-400 font-medium">47 traders</span> already on the waitlist
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </MouseGradient>
  )
}