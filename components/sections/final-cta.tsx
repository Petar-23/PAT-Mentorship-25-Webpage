// src/components/sections/final-cta.tsx
"use client"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowRight, Users, Clock, Trophy } from "lucide-react"
import { GlowingCard } from "@/components/ui/glowing-card"
import { Vortex } from "@/components/ui/vortex"
import { useUser, SignInButton } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

export default function FinalCTA() {
    const { isSignedIn } = useUser()
    const router = useRouter()

    // Handle click for signed-in users
    const handleJoinClick = () => {
        router.push('/dashboard')
    }

    // Wrapper component for the CTA button
    const CTAButton = () => {
        const buttonContent = (
            <>
                <span>Platz jetzt sichern</span>
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </>
        )

        if (isSignedIn) {
            return (
                <Button 
                    onClick={handleJoinClick}
                    size="lg" 
                    className="bg-white text-slate-900 hover:bg-white/90 text-lg px-8 py-6 h-auto group"
                >
                    {buttonContent}
                </Button>
            )
        }

        return (
            <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <Button 
                    size="lg" 
                    className="bg-white text-slate-900 hover:bg-white/90 text-lg px-8 py-6 h-auto group"
                >
                    {buttonContent}
                </Button>
            </SignInButton>
        )
    }

    return (
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
                            Deine Trading-Reise <br />
                            Beginnt im März 2026
                        </h2>
                        <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                            Werde einer von 100 ambitionierten Tradern und erlebe ein transformatives Jahr 
                            mit Live-Marktanalysen, Echtzeit-Trading und messbarem Wachstum.
                        </p>
                    </motion.div>
                </div>

                <div className="grid md:grid-cols-3 gap-6 mb-12">
                    {[
                        {
                            icon: <Users className="h-8 w-8 text-blue-400 mb-4" />,
                            title: "Begrenzte Plätze",
                            description: "Nur 100 Trader werden aufgenommen, um eine qualitativ hochwertige Betreuung zu gewährleisten"
                        },
                        {
                            icon: <Clock className="h-8 w-8 text-purple-400 mb-4" />,
                            title: "Frühzeitig Sichern",
                            description: "Die Vergabe der Mentorship-Plätze erfolgt nach dem Prinzip: Wer zuerst kommt, mahlt zuerst."
                        },
                        {
                            icon: <Trophy className="h-8 w-8 text-green-400 mb-4" />,
                            title: "Lebenslanger Zugang",
                            description: "Schließe das Jahr ab und erhalte permanenten Zugriff auf alle Materialien und Aufzeichnungen"
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
                    <CTAButton />
                    
                    <p className="mt-6 text-gray-400">
                        Keine Zahlung bis zum Programmstart.
                    </p>

                    <div className="mt-12 backdrop-blur-md bg-white/5 rounded-lg inline-block px-6 py-3 border border-white/10">
                        <p className="text-white text-sm">
                            ⚡ Nur die ersten 100 Anmeldungen werden akzeptiert
                        </p>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}