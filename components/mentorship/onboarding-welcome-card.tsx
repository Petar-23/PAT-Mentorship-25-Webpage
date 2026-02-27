'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getOnboardingDismissStorageKey, getOnboardingEmbedUrl } from '@/lib/onboarding-video'
import { CalendarDays, X } from 'lucide-react'

type OnboardingWelcomeCardProps = {
  videoId: string
  expiresAtLabel: string
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

  if (isDismissed) {
    return null
  }

  return (
    <Card className="md:col-span-2 xl:col-span-3 min-[1800px]:col-span-4 border-orange-500/30 bg-orange-50/40">
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

          <div className="space-y-3 self-center">
            <p className="text-sm text-muted-foreground">
              Schau dir dieses kurze Onboarding an, damit du direkt weißt, wie du die Plattform optimal nutzt und
              was dich im ersten Stream erwartet.
            </p>
            <p className="text-sm text-muted-foreground">
              Die Kachel verschwindet automatisch am <span className="font-medium text-foreground">{expiresAtLabel}</span>.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
