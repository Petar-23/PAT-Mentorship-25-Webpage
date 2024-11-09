// src/components/sections/mentor.tsx
"use client"
import Image from 'next/image'
import { motion } from "framer-motion"
import { Play, Users, BookOpen, LineChart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GradientCard } from "@/components/ui/gradient-card"

export default function MentorSection() {
  return (
    <section className="py-24 bg-slate-950 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 to-slate-950/20" />
      
      <div className="container mx-auto px-4 max-w-6xl relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Image and Stats */}
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative"
            >
              {/* Main Image */}
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden">
                <Image
                  src="/images/mentor-image-2.png"
                  alt="Your Name - Trading Mentor"
                  fill
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
              </div>

              {/* Stats Card */}
              <GradientCard className="absolute -bottom-6 -right-6 max-w-[240px]" >
                <div className="space-y-4 p-6">
                  <div className="flex items-center gap-4">
                    <Users className="h-5 w-5 text-blue-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">500+</p>
                      <p className="text-sm text-gray-400">Students Mentored</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <LineChart className="h-5 w-5 text-green-400" />
                    <div>
                      <p className="text-2xl font-bold text-white">12+</p>
                      <p className="text-sm text-gray-400">Years Trading</p>
                    </div>
                  </div>
                </div>
              </GradientCard>
            </motion.div>
          </div>

          {/* Right Column - Text Content */}
          <div className="space-y-8">
            <div>
              <h4 className="text-blue-400 font-semibold mb-4">MEET YOUR MENTOR</h4>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Your Name
              </h2>
              <p className="text-lg text-gray-300 leading-relaxed mb-6">
                With over 12 years of trading experience, I have developed a deep understanding 
                of price action and market structure. My journey from retail trader to 
                professional has given me unique insights into the challenges traders face 
                and how to overcome them.
              </p>
              <p className="text-lg text-gray-300 leading-relaxed">
                My teaching approach focuses on clean price action analysis without 
                relying on complex indicators. I believe in teaching traders to read 
                the market directly, developing skills that last a lifetime.
              </p>
            </div>

            {/* Video Preview */}
            <GradientCard className="overflow-hidden">
              <div className="relative">
                <div className="aspect-video relative bg-slate-900">
                  <Image
                    src="/images/example-thumbnail-1.png"
                    alt="Mentorship Preview"
                    fill
                    className="object-cover"
                  />
                  {/* YouTube Play Button */}
                  <Button
                    onClick={() => {
                      window.open('https://youtu.be/l4_yKCnskLY?si=xyqUudDEmyye0udQ', '_blank')
                    }}
                    className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center group border-2 border-white/20"
                  >
                    <Play className="h-8 w-8 text-white group-hover:scale-110 transition-transform" />
                  </Button>
                </div>
                <div className="p-4">
                  <h4 className="font-medium text-white">Sample Mentorship Lecture</h4>
                  <p className="text-sm text-gray-400">
                    Watch how we analyze live market conditions and identify trading opportunities
                  </p>
                </div>
              </div>
            </GradientCard>

            {/* Teaching Philosophy */}
            <div className="grid sm:grid-cols-2 gap-6">
              <GradientCard className="h-full" gradientColor="rgba(59, 130, 246, 0.2)">
                <div className="p-6">
                  <BookOpen className="h-6 w-6 text-blue-400 mb-4" />
                  <h3 className="font-semibold text-white mb-2">Teaching Approach</h3>
                  <p className="text-sm text-gray-300">
                    Focus on clean charts and pure price action. No indicator dependency 
                    or complex systems.
                  </p>
                </div>
              </GradientCard>
              
              <GradientCard className="h-full" gradientColor="rgba(147, 51, 234, 0.2)">
                <div className="p-6">
                  <Users className="h-6 w-6 text-purple-400 mb-4" />
                  <h3 className="font-semibold text-white mb-2">Personal Attention</h3>
                  <p className="text-sm text-gray-300">
                    Limited to 100 students to ensure quality mentorship and individual attention.
                  </p>
                </div>
              </GradientCard>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}