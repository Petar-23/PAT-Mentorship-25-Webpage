// src/components/sections/final-cta.tsx
"use client"
import dynamic from "next/dynamic"
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react"
import { Clock } from "@phosphor-icons/react/Clock"
import { Trophy } from "@phosphor-icons/react/Trophy"
import { Users } from "@phosphor-icons/react/Users"
import { Countdown } from "@/components/ui/countdown"
import { useMediaQuery } from "@/hooks/use-media-query"
import { MENTORSHIP_CONFIG, MENTORSHIP_IS_UPCOMING } from '@/lib/config'
import { MentorshipEntryCta } from '@/components/sections/mentorship-entry-cta'

const Vortex = dynamic(
    () => import("@/components/ui/vortex").then((mod) => mod.Vortex),
    {
        ssr: false,
        loading: () => null,
    }
)

function FinalCtaInfoCard({
    icon,
    title,
    description,
    glowColor,
}: {
    icon: ReactNode
    title: string
    description: string
    glowColor: string
}) {
    const style = { "--final-cta-card-glow": glowColor } as CSSProperties

    return (
        <div
            style={style}
            className="group relative h-full rounded-xl border border-slate-700/90 bg-slate-900 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_18px_45px_rgba(15,23,42,0.45)] transition-colors duration-300 before:absolute before:inset-0 before:rounded-[inherit] before:bg-[radial-gradient(circle_at_35%_0%,var(--final-cta-card-glow),transparent_38%)] before:opacity-15 before:transition-opacity before:duration-300 hover:border-slate-500/80 hover:before:opacity-25"
        >
            <div className="relative">
                {icon}
                <h3 className="text-lg font-semibold text-white mb-2">
                    {title}
                </h3>
                <p className="text-gray-300">
                    {description}
                </p>
            </div>
        </div>
    )
}

export default function FinalCTA() {
    const isMobile = useMediaQuery("(max-width: 768px)")
    const sectionRef = useRef<HTMLElement>(null)
    const [isInView, setIsInView] = useState(false)
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
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

    useEffect(() => {
        if (typeof window === 'undefined') return

        const media = window.matchMedia('(prefers-reduced-motion: reduce)')
        const updatePreference = () => setPrefersReducedMotion(media.matches)

        updatePreference()
        media.addEventListener('change', updatePreference)
        return () => media.removeEventListener('change', updatePreference)
    }, [])

    return (
        <section ref={sectionRef} className="relative py-12 sm:py-24 overflow-hidden">
            {/* Vortex Background */}
            <div className="absolute inset-0 bg-slate-950">
                {isInView && !prefersReducedMotion && (
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
                    <div className="motion-safe:animate-[final-cta-fade-up_600ms_ease-out_both]">
                        <div className="flex justify-center mb-4 sm:mb-6">
                            <div className="inline-flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 pr-3 sm:pr-4 py-1 rounded-full bg-white/10 ring-1 ring-white/20">
                                <div className="bg-blue-500/20 text-blue-400 rounded-full px-2 py-0.5 text-xs sm:text-sm">🚀</div>
                                <span className="text-xs sm:text-sm font-medium text-blue-400">Jetzt starten</span>
                            </div>
                        </div>
                        <h2 className="text-balance text-2xl font-bold text-white sm:text-4xl md:text-5xl">
                            Bereit, ICT <span className="text-blue-400">live anzuwenden?</span>
                        </h2>
                        <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm text-gray-300 sm:mt-6 sm:text-xl">
                            {MENTORSHIP_IS_UPCOMING
                                ? `Melde dich für den Start im ${MENTORSHIP_CONFIG.startMonthYear} an und sichere dir Zugang zu Live-Sessions, Aufzeichnungen und Community.`
                                : 'Steig in die laufende Mentorship ein und erhalte Zugang zu Live-Sessions, Aufzeichnungen und Community.'}
                        </p>
                    </div>
                    <div className="mt-6 sm:mt-8 flex justify-center">
                        {MENTORSHIP_IS_UPCOMING ? (
                            <div className="max-w-md w-full">
                                <p className="text-xs sm:text-sm text-gray-200 mb-2 sm:mb-3">
                                    Verbleibende Zeit zur Anmeldung in die Warteliste
                                </p>
                                <Countdown targetDate={MENTORSHIP_CONFIG.startDate} variant="dark" />
                            </div>
                        ) : (
                            <p className="rounded-full border border-blue-400/30 bg-blue-400/10 px-4 py-2 text-sm font-medium text-blue-200">
                                {MENTORSHIP_CONFIG.enrollmentLabel}
                            </p>
                        )}
                    </div>
                </div>

                <div className="hidden md:grid md:grid-cols-3 gap-6 mb-12">
                    {[
                        {
                            icon: <Users className="h-8 w-8 text-blue-400 mb-4" />,
                            title: "Fokussierte Community",
                            description: "Austausch, Rückfragen und direktes Feedback begleiten deinen Lernprozess.",
                            glowColor: "#60A5FA" // blue-400
                        },
                        {
                            icon: <Clock className="h-8 w-8 text-purple-400 mb-4" />,
                            title: "Flexibler Einstieg",
                            description: MENTORSHIP_IS_UPCOMING
                                ? `Start im ${MENTORSHIP_CONFIG.startMonthYear}; kündbar mit 1 Tag Frist zum Monatsende.`
                                : "Der laufende Jahrgang ist offen und mit 1 Tag Frist zum Monatsende kündbar.",
                            glowColor: "#A78BFA" // purple-400
                        },
                        {
                            icon: <Trophy className="h-8 w-8 text-green-400 mb-4" />,
                            title: "Aufzeichnungen inklusive",
                            description: "Greife während deiner Mitgliedschaft auf Materialien und bisherige Sessions zu.",
                            glowColor: "#4ADE80" // green-400
                        }
                    ].map((card) => (
                        <FinalCtaInfoCard
                            key={card.title}
                            icon={card.icon}
                            title={card.title}
                            description={card.description}
                            glowColor={card.glowColor}
                        />
                    ))}
                </div>

                <div className="text-center mt-6 sm:mt-8 md:mt-0 motion-safe:animate-[final-cta-pop_500ms_ease-out_200ms_both]">
                    <MentorshipEntryCta
                        source="final_cta"
                        className="h-auto bg-white px-6 py-4 text-sm text-slate-900 hover:bg-white/90 sm:px-8 sm:py-6 sm:text-lg"
                    />
                    
                    <p className="mt-4 sm:mt-6 text-xs sm:text-base text-gray-400">
                        Kostenlos anmelden → Konditionen prüfen → sicher über Stripe buchen
                    </p>

                    <div className="mt-6 sm:mt-12 inline-flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 pr-3 sm:pr-4 py-1 rounded-full bg-white/10 ring-1 ring-white/20">
                        <div className="bg-amber-500/20 text-amber-400 rounded-full px-2 py-0.5 text-xs sm:text-sm">⚡</div>
                        <span className="text-xs sm:text-sm font-medium text-amber-300">
                            Transparente Konditionen · monatlich kündbar
                        </span>
                    </div>
                </div>
            </div>
        </section>
    )
}
