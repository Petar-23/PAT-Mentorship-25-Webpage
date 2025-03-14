'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { ArrowRight, PlayCircle, Users } from "lucide-react"
import Link from "next/link"
import { MatrixRain } from "../ui/matrix-rain"
import Image from "next/image"
import { useMediaQuery } from "@/hooks/use-media-query"
import { motion } from "framer-motion"
import { SignInButton, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

export default function Hero() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const isMobile = useMediaQuery("(max-width: 768px)")
  const [isNavigating, setIsNavigating] = useState(false)
  const { isSignedIn } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!isMobile) {
      const handleMouseMove = (e: MouseEvent) => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          setMousePosition({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top + window.scrollY
          })
        }
      }

      window.addEventListener('mousemove', handleMouseMove)
      return () => window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [isMobile])

  const handleGetStarted = () => {
    if (isSignedIn) {
      setIsNavigating(true)
      router.push('/dashboard')
      setTimeout(() => setIsNavigating(false), 500)
    }
  }

  // Custom SignInButton wrapper component
  const SignInWrapper = ({ children }: { children: React.ReactNode }) => (
    <SignInButton mode="modal" forceRedirectUrl="/dashboard">
      <div>
        {children}
      </div>
    </SignInButton>
  )

  // Get Started button component
  const GetStartedButton = () => {
    if (isSignedIn) {
      return (
        <Button 
          size="lg" 
          onClick={handleGetStarted}
          disabled={isNavigating}
          className="w-full flex items-center gap-2 justify-center"
        >
          Sichere dir deinen Platz
          <ArrowRight className="h-4 w-4" />
        </Button>
      )
    }

    return (
      <SignInWrapper>
        <Button 
          size="lg"
          className="w-full flex items-center gap-2 justify-center"
        >
          Sichere dir deinen Platz
          <ArrowRight className="h-4 w-4" />
        </Button>
      </SignInWrapper>
    )
  }

  return (
    <section 
      ref={containerRef}
      className="relative py-12 sm:py-24 md:py-20 lg:py-32 min-h-[85vh] lg:min-h-[65vh] overflow-hidden bg-gradient-to-b from-white to-gray-50"
    >
       {/* Matrix Background Layer */}
       {isMobile ? (
        // Mobile version with moving gradient
        <div className="absolute inset-0">
          <div className="absolute inset-0">
            <MatrixRain color="rgba(128, 128, 128, 0.3)" />
          </div>
          {/* Animated gradient overlay */}
          <motion.div 
            className="absolute inset-0"
            initial={{ backgroundPosition: '0% 0%' }}
            animate={{ 
              backgroundPosition: ['0% 0%', '100% 100%', '0% 100%', '100% 0%', '0% 0%'],
            }}
            transition={{ 
              duration: 20,
              ease: "linear",
              repeat: Infinity,
            }}
            style={{
              background: `radial-gradient(
                circle 150vw at 50% 50%,
                transparent 10%,
                rgba(255, 255, 255, 0.85) 30%,
                rgba(255, 255, 255, 0.95) 100%
              )`,
            }}
          />
        </div>
       ) : (
        // Desktop version with mouse follow
        <div 
          className="absolute inset-0"
          style={{
            mask: `radial-gradient(circle 300px at ${mousePosition.x}px ${mousePosition.y}px, white, transparent)`,
            WebkitMask: `radial-gradient(circle 300px at ${mousePosition.x}px ${mousePosition.y}px, white, transparent)`,
          }}
        >
          <MatrixRain color="rgba(128, 128, 128, 0.3)" />
        </div>
       )}

      {/* Content */}
      <div className="container mx-auto px-4 relative z-10 h-full">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start lg:items-center mt-0 lg:mt-8">
            {/* Left Column - Text Content */}
            <div className="space-y-8">
              <div className="inline-block">
                <span className="inline-flex items-center rounded-full px-4 py-1 text-sm font-medium bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10">
                  Limitiert auf 100 Plätze • Start im März 2025
                </span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 lg:leading-[1.1]">
                Lerne Trading nach {' '}
                <br className="hidden sm:block" />
                ICT Konzepten in einer {' '}
                <span className="bg-gradient-to-b from-purple-400 to-blue-500 bg-clip-text text-transparent"> Live Mentorship</span>
              </h1>
              
              <p className="text-lg md:text-xl text-gray-600 leading-relaxed max-w-xl">
              Statt mit passend ausgewählten Beispielen aus aufgezeichneten Kursen, bringe ich dir das Trading direkt an der Live-Price-Action bei. Du lernst anhand aktueller Marktbewegungen und erhältst Erklärungen in Echtzeit.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-2 w-full">
                <div className="w-full sm:w-auto">
                  <GetStartedButton />
                </div>
                
                <div className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" asChild className="w-full">
                    <Link href="#why-different">
                      Mentorship Details
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 sm:gap-8 pt-4 lg:pt-6">
                <div>
                  <p className="text-2xl lg:text-3xl font-bold text-gray-900">€150</p>
                  <p className="text-sm text-gray-600">Monatlich Kündbar</p>
                </div>
                <div>
                  <p className="text-2xl lg:text-3xl font-bold text-gray-900">2-3x</p>
                  <p className="text-sm text-gray-600">Lektionen / Woche</p>
                </div>
                <div>
                  <p className="text-2xl lg:text-3xl font-bold text-gray-900">100</p>
                  <p className="text-sm text-gray-600">Limitierte Plätze</p>
                </div>
              </div>
            </div>

            {/* Right Column - Visual Element */}
            <div className="relative flex items-center justify-center lg:-mt-8">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl opacity-10 blur-2xl" />
              <div className="relative bg-white p-5 sm:p-6 lg:p-7 rounded-xl shadow-xl w-full max-w-lg mx-auto">
                <div className="space-y-4 lg:space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
                      <Image
                        src="/images/ict-logo.jpg"
                        alt="ICT Logo"
                        width={48}
                        height={48}
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold">ICT Konzepte auf Deutsch</h3>
                      <p className="text-sm text-gray-600">Zusammengefasst, Strukturiert & Erklärt</p>
                    </div>
                  </div>
                  
                  <div className="h-px bg-gray-100" />

                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <PlayCircle className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Live Trading Sessions</h3>
                      <p className="text-sm text-gray-600">Anwendung der Konzepte in Echtzeit</p>
                    </div>
                  </div>
                  
                  <div className="h-px bg-gray-100" />
                  
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                      <Users className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Offene 1:1 Sessions</h3>
                      <p className="text-sm text-gray-600">Direktes Mentoring & Fragen</p>
                    </div>
                  </div>

                  <div className="h-px bg-gray-100" />
                  
                  <div className="flex items-center gap-4 mt-2">
                    <div className="bg-green-50 rounded-lg p-3 w-full border">
                      <p className="text-sm text-green-800 font-medium text-wrap">
                       Bleib 12 Monate dabei & erhalte dauerhaft Zugang zu allen Materialien
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </div>
    </section>
  )
}