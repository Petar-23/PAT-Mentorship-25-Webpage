// src/app/components/sections/hero.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { ArrowRight, PlayCircle, Users } from "lucide-react"
import Link from "next/link"
import { MatrixRain } from "../ui/matrix-rain"
import Image from "next/image"

export default function Hero() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
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
  }, [])

  return (
    <section 
      ref={containerRef}
      className="relative py-20 px md:px-6 lg:py-32 in-h-[80vh] overflow-hidden bg-gradient-to-b from-white to-gray-50"
    >
       {/* Matrix Background Layer */}
       <div 
        className="absolute inset-0"
        style={{
          mask: `radial-gradient(circle 300px at ${mousePosition.x}px ${mousePosition.y}px, white, transparent)`,
          WebkitMask: `radial-gradient(circle 300px at ${mousePosition.x}px ${mousePosition.y}px, white, transparent)`,
        }}
      >
        <MatrixRain color="rgba(128, 128, 128, 0.3)" />
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 relative z-10 h-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Text Content */}
            <div className="space-y-8">
              <div className="inline-block">
                <span className="inline-flex items-center rounded-full px-4 py-1 text-sm font-medium bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10">
                  Limitiert auf 100 Plätze • Start im März 2025
                </span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900">
                Lerne Smart Money Konzepte in einer Live 
                <span className="bg-gradient-to-b from-purple-400 to-blue-500 bg-clip-text text-transparent"> Mentorship</span>
              </h1>
              
              <p className="text-lg md:text-xl text-gray-600 leading-relaxed">
              Vergiss vorgefertigte Kurse mit veralteten Beispielen. Lerne das Traden an der harten rechten Kante der Charts, an Live Marktdaten mit direkter Anleitung in Echtzeit.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" asChild>
                  <Link href="#waitlist" className="flex items-center gap-2">
                    Sichere dir deinen Platz
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                
                <Button size="lg" variant="outline" asChild>
                  <Link href="#why-different">
                    Mentorship Details
                  </Link>
                </Button>
              </div>

              <div className="flex items-center gap-8 pt-4">
                <div>
                  <p className="text-3xl font-bold text-gray-900">€150</p>
                  <p className="text-sm text-gray-600">Monatliche Gebühr</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">2-3x</p>
                  <p className="text-sm text-gray-600">Lektionen / Woche</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">100</p>
                  <p className="text-sm text-gray-600">Limitierte Plätze</p>
                </div>
              </div>
            </div>

            {/* Right Column - Visual Element */}
            <div className="relative lg:h-[600px] flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl opacity-10 blur-2xl" />
              <div className="relative bg-white p-8 rounded-xl shadow-xl">
                <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
                      <Image
                        src="/images/ict-logo.jpg" // Make sure to add your ICT logo
                        alt="ICT Logo"
                        width={48}
                        height={48}
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold">ICT Konzepte in Deutsch</h3>
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