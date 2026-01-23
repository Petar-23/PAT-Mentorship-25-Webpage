// src/components/sections/final-cta.tsx
"use client"
import { motion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowRight, Users, Clock, Trophy } from "lucide-react"
import { GlowingCard } from "@/components/ui/glowing-card"
import { Vortex } from "@/components/ui/vortex"
import { Countdown } from "@/components/ui/countdown"
import { useUser, SignInButton } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { trackConversion } from '@/components/analytics/google-tag-manager'
import { useMediaQuery } from "@/hooks/use-media-query"

export default function FinalCTA() {
    const { isSignedIn } = useUser()
    const router = useRouter()
    const isMobile = useMediaQuery("(max-width: 768px)")
    const sectionRef = useRef<HTMLElement>(null)
    const [isInView, setIsInView] = useState(false)
    const vortexConfig = isMobile
        ? {
            particleCount: 150,
            baseHue: 240,
            baseSpeed: 0.1,
            rangeSpeed: 0.6,
            baseRadius: 0.4,
            rangeRadius: 1.0,
        }
        : {
            particleCount: 500,
            baseHue: 240,
            baseSpeed: 0.2,
            rangeSpeed: 1.0,
            baseRadius: 0.5,
            rangeRadius: 1.5,
        }

    // Handle click for signed-in users
    const handleJoinClick = () => {
        trackConversion.ctaClick()
        router.push('/dashboard')
    }
    
    // Handle click for non-signed-in users
    const handleSignInClick = () => {
        trackConversion.ctaClick()
        trackConversion.signInStart()
    }

    const buttonContent = (
        <>
            <span>Platz jetzt sichern</span>
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </>
    )

    useEffect(() => {
        if (!sectionRef.current) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsInView(entry.isIntersecting)
            },
            { threshold: 0.15 }
        )

        observer.observe(sectionRef.current)
        return () => observer.disconnect()
    }, [])

    const ctaButton = isSignedIn ? (
        <Button
            onClick={handleJoinClick}
            size="lg"
            className="bg-white text-slate-900 hover:bg-white/90 text-sm sm:text-lg px-6 sm:px-8 py-4 sm:py-6 h-auto group"
        >
            {buttonContent}
        </Button>
    ) : (
        <SignInButton mode="modal" forceRedirectUrl="/dashboard">
            <Button
                size="lg"
                className="bg-white text-slate-900 hover:bg-white/90 text-sm sm:text-lg px-6 sm:px-8 py-4 sm:py-6 h-auto group"
                onClick={handleSignInClick}
            >
                {buttonContent}
            </Button>
        </SignInButton>
    )
    
    const handleScrollToDetails = () => {
        const target = document.getElementById('why-different')
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        } else {
            window.location.hash = 'why-different'
        }
    }

    return (
        <section ref={sectionRef} className="relative py-12 sm:py-24 overflow-hidden">
            {/* Vortex Background */}
            <div className="absolute inset-0 bg-slate-950">
                {isInView && (
                    <Vortex
                        particleCount={vortexConfig.particleCount}
                        baseHue={vortexConfig.baseHue}
                        baseSpeed={vortexConfig.baseSpeed}
                        rangeSpeed={vortexConfig.rangeSpeed}
                        baseRadius={vortexConfig.baseRadius}
                        rangeRadius={vortexConfig.rangeRadius}
                        backgroundColor="transparent"
                        containerClassName="opacity-30"
                    />
                )}
            </div>
            
            {/* Content */}
            <div className="container relative z-10 mx-auto px-4 max-w-6xl">
                <div className="text-center mb-8 sm:mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="flex justify-center mb-4 sm:mb-6">
                            <div className="inline-flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 pr-3 sm:pr-4 py-1 rounded-full bg-white/10 ring-1 ring-white/20">
                                <div className="bg-blue-500/20 text-blue-400 rounded-full px-2 py-0.5 text-xs sm:text-sm">🚀</div>
                                <span className="text-xs sm:text-sm font-medium text-blue-400">Jetzt starten</span>
                            </div>
                        </div>
                        <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white mb-4 sm:mb-6">
                            Deine Trading-Reise <br />
                            <span className="text-blue-400">
                                Beginnt im März 2026
                            </span>
                        </h2>
                        <p className="text-sm sm:text-xl text-gray-300 max-w-2xl mx-auto">
                            Werde einer von 100 ambitionierten Tradern und erlebe ein transformatives Jahr 
                            mit Live-Marktanalysen, Echtzeit-Trading und messbarem Wachstum.
                        </p>
                    </motion.div>
                    <div className="mt-6 sm:mt-8 flex justify-center">
                        <div className="max-w-md w-full">
                            <p className="text-xs sm:text-sm text-gray-200 mb-2 sm:mb-3">
                                Verbleibende Zeit zur Anmeldung in die Warteliste
                            </p>
                            <Countdown targetDate="2026-03-01T00:00:00+01:00" variant="dark" />
                        </div>
                    </div>
                </div>

                <div className="hidden md:grid md:grid-cols-3 gap-6 mb-12">
                    {[
                        {
                            icon: <Users className="h-8 w-8 text-blue-400 mb-4" />,
                            title: "Begrenzte Plätze",
                            description: "Nur 100 Trader werden aufgenommen, um eine qualitativ hochwertige Betreuung zu gewährleisten",
                            glowColor: "#60A5FA" // blue-400
                        },
                        {
                            icon: <Clock className="h-8 w-8 text-purple-400 mb-4" />,
                            title: "Frühzeitig Sichern",
                            description: "Die Vergabe der Mentorship-Plätze erfolgt nach dem Prinzip: Wer zuerst kommt, mahlt zuerst.",
                            glowColor: "#A78BFA" // purple-400
                        },
                        {
                            icon: <Trophy className="h-8 w-8 text-green-400 mb-4" />,
                            title: "Lebenslanger Zugang",
                            description: "Schließe das Jahr ab und erhalte permanenten Zugriff auf alle Materialien und Aufzeichnungen",
                            glowColor: "#4ADE80" // green-400
                        }
                    ].map((card, index) => (
                        <GlowingCard key={index} glowColor={card.glowColor}>
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
                    className="text-center mt-6 sm:mt-8 md:mt-0"
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    {ctaButton}
                    
                    <p className="mt-4 sm:mt-6 text-xs sm:text-base text-gray-400">
                        Keine Zahlung bis zum Programmstart.
                    </p>

                    <div className="mt-6 sm:mt-12 inline-flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 pr-3 sm:pr-4 py-1 rounded-full bg-white/10 ring-1 ring-white/20">
                        <div className="bg-amber-500/20 text-amber-400 rounded-full px-2 py-0.5 text-xs sm:text-sm">⚡</div>
                        <span className="text-xs sm:text-sm font-medium text-amber-300">Nur die ersten 100 Anmeldungen werden akzeptiert</span>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}