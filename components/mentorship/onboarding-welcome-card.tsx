'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getOnboardingDismissStorageKey, getOnboardingEmbedUrl } from '@/lib/onboarding-video'
import { CalendarDays, CheckCircle2, ChevronDown } from 'lucide-react'

type OnboardingWelcomeCardProps = {
  videoId: string
  expiresAtLabel: string
}

export function OnboardingWelcomeCard({ videoId, expiresAtLabel }: OnboardingWelcomeCardProps) {
  const storageKey = getOnboardingDismissStorageKey(videoId)
  const embedUrl = getOnboardingEmbedUrl(videoId)
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState<number>(0)

  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem(storageKey) === '1'
    } catch {
      return false
    }
  })

  const measureHeight = useCallback(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight)
    }
  }, [])

  useEffect(() => {
    measureHeight()
    window.addEventListener('resize', measureHeight)
    return () => window.removeEventListener('resize', measureHeight)
  }, [measureHeight])

  const handleToggle = () => {
    if (isDismissed) {
      try { window.localStorage.removeItem(storageKey) } catch {}
      // re-measure before expanding
      measureHeight()
      setIsDismissed(false)
    } else {
      try { window.localStorage.setItem(storageKey, '1') } catch {}
      setIsDismissed(true)
    }
  }

  return (
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
            onClick={handleToggle}
            className="shrink-0"
            aria-label={isDismissed ? 'Onboarding-Kachel einblenden' : 'Onboarding-Kachel ausblenden'}
          >
            {isDismissed ? 'Einblenden' : 'Ausblenden'}
            <motion.span
              className="ml-1 inline-flex"
              animate={{ rotate: isDismissed ? 0 : 180 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <ChevronDown className="h-4 w-4" />
            </motion.span>
          </Button>
        </div>
      </CardHeader>

      <motion.div
        initial={false}
        animate={{
          height: isDismissed ? 0 : contentHeight || 'auto',
          opacity: isDismissed ? 0 : 1,
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        style={{ overflow: 'hidden' }}
      >
        <div ref={contentRef}>
          <CardContent className="pt-0">
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
        </div>
      </motion.div>
    </Card>
  )
}
