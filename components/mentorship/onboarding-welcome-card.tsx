'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getOnboardingDismissStorageKey, getOnboardingEmbedUrl } from '@/lib/onboarding-video'
import { CalendarDays, CheckCircle2, RotateCcw, X } from 'lucide-react'

type OnboardingWelcomeCardProps = {
  videoId: string
  expiresAtLabel: string
}

const layoutTransition = {
  duration: 0.24,
  ease: 'easeInOut' as const,
}

const swapTransition = {
  duration: 0.18,
  ease: 'easeOut' as const,
}

export function OnboardingWelcomeCard({ videoId, expiresAtLabel }: OnboardingWelcomeCardProps) {
  const storageKey = getOnboardingDismissStorageKey(videoId)
  const embedUrl = getOnboardingEmbedUrl(videoId)

  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === 'undefined') return false

    try {
      return window.localStorage.getItem(storageKey) === '1'
    } catch {
      return false
    }
  })

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(storageKey, '1')
    } catch {
      // localStorage kann blockiert sein; UI trotzdem schließen
    }
    setIsDismissed(true)
  }

  const handleRestore = () => {
    try {
      window.localStorage.removeItem(storageKey)
    } catch {
      // ignore storage errors
    }
    setIsDismissed(false)
  }

  return (
    <motion.div layout transition={layoutTransition} className="overflow-hidden">
      <AnimatePresence initial={false}>
        {isDismissed ? (
          <motion.div
            key="onboarding-dismissed"
            layout
            initial={{ opacity: 0.97, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0.97, y: -2 }}
            transition={swapTransition}
          >
            <Card>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">Onboarding-Video ausgeblendet.</p>
                <Button type="button" variant="outline" size="sm" onClick={handleRestore} className="w-full sm:w-auto">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Wieder einblenden
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="onboarding-visible"
            layout
            initial={{ opacity: 0.97, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0.97, y: -2 }}
            transition={swapTransition}
          >
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl sm:text-2xl">Willkommen in der PAT Mentorship 2026</CardTitle>
                    <CardDescription className="mt-2 flex items-center gap-2 text-sm">
                      <CalendarDays className="h-4 w-4" />
                      Kickoff-Stream am 03.03.2026 um 15:00 CET
                    </CardDescription>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDismiss}
                    className="shrink-0"
                    aria-label="Onboarding-Kachel ausblenden"
                  >
                    <X className="mr-1 h-4 w-4" />
                    Ausblenden
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                  <div className="overflow-hidden rounded-lg border border-border bg-black aspect-video">
                    <iframe
                      src={embedUrl}
                      title="Onboarding Video PAT Mentorship 2026"
                      className="h-full w-full"
                      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  </div>

                  <div className="space-y-4 self-center">
                    <div className="rounded-md border border-border bg-muted/30 p-3">
                      <p className="text-sm font-semibold text-foreground">In wenigen Minuten startklar</p>
                      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                          <span>So findest du sofort die wichtigsten Module und deinen nächsten Schritt.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                          <span>Du bekommst den Ablauf für den Kickoff-Stream und die ersten Aufgaben.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                          <span>Ideal, wenn du ohne Rumklicken direkt produktiv starten willst.</span>
                        </li>
                      </ul>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Hinweis: Diese Kachel verschwindet automatisch am{' '}
                      <span className="font-medium text-foreground">{expiresAtLabel}</span>.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
