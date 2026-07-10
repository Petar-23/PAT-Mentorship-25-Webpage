'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  getOnboardingDismissStorageKey,
  getOnboardingPlaybackEndpoint,
} from '@/lib/onboarding-video'
import { CalendarDots as CalendarDays } from '@phosphor-icons/react/CalendarDots'
import { CaretDown as ChevronDown } from '@phosphor-icons/react/CaretDown'
import { CheckCircle as CheckCircle2 } from '@phosphor-icons/react/CheckCircle'

type OnboardingWelcomeCardProps = {
  videoId: string
  expiresAtLabel: string
}

export function OnboardingWelcomeCard({ videoId, expiresAtLabel }: OnboardingWelcomeCardProps) {
  const storageKey = getOnboardingDismissStorageKey(videoId)

  const [isDismissed, setIsDismissed] = useState<boolean | null>(null)
  const [embedUrl, setEmbedUrl] = useState<string | null>(null)
  const [playbackError, setPlaybackError] = useState(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setIsDismissed(window.localStorage.getItem(storageKey) === '1')
      } catch {
        setIsDismissed(false)
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [storageKey])

  useEffect(() => {
    setEmbedUrl(null)
    setPlaybackError(false)
    if (isDismissed !== false) return

    const controller = new AbortController()
    void (async () => {
      try {
        const response = await fetch(getOnboardingPlaybackEndpoint(videoId), {
          cache: 'no-store',
          signal: controller.signal,
        })
        const payload = (await response.json().catch(() => null)) as
          | { url?: string; error?: string }
          | null
        if (!response.ok || !payload?.url) throw new Error(payload?.error || 'Playback unavailable')
        setEmbedUrl(payload.url)
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Onboarding playback URL failed:', error)
          setPlaybackError(true)
        }
      }
    })()

    return () => controller.abort()
  }, [isDismissed, videoId])

  const handleToggle = () => {
    if (isDismissed === true) {
      try { window.localStorage.removeItem(storageKey) } catch {}
      setIsDismissed(false)
    } else {
      try { window.localStorage.setItem(storageKey, '1') } catch {}
      setIsDismissed(true)
    }
  }

  return (
    <Card>
      <div className={isDismissed === true ? 'px-4 py-3 sm:px-6' : ''}>
        {isDismissed === true ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              <CalendarDays className="mr-1.5 inline h-4 w-4 align-text-bottom" />
              Kickoff-Stream am 03.03.2026 um 15:00 CET auf Discord — Kachel verschwindet am {expiresAtLabel}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleToggle}
              className="shrink-0"
              aria-label="Onboarding-Kachel einblenden"
            >
              Einblenden
              <span className="ml-1 inline-flex transition-transform duration-300 ease-in-out">
                <ChevronDown className="h-4 w-4" />
              </span>
            </Button>
          </div>
        ) : (
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl sm:text-2xl">Willkommen in der PAT Mentorship 2026</CardTitle>
                <CardDescription className="mt-2 flex items-center gap-2 text-sm">
                  <CalendarDays className="h-4 w-4" />
                  Kickoff-Stream am 03.03.2026 um 15:00 CET auf Discord
                </CardDescription>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleToggle}
                className="shrink-0"
                aria-label="Onboarding-Kachel ausblenden"
              >
                Ausblenden
                <span className="ml-1 inline-flex rotate-180 transition-transform duration-300 ease-in-out">
                  <ChevronDown className="h-4 w-4" />
                </span>
              </Button>
            </div>
          </CardHeader>
        )}
      </div>

      {isDismissed === false ? (
        <div className="overflow-hidden">
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
              <div className="overflow-hidden rounded-lg border border-border bg-black aspect-video">
                {embedUrl ? (
                  <iframe
                    src={embedUrl}
                    title="Onboarding Video PAT Mentorship 2026"
                    className="h-full w-full"
                    allow="accelerometer; gyroscope; encrypted-media; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/80">
                    {playbackError
                      ? 'Das Video kann gerade nicht sicher geladen werden.'
                      : 'Video wird sicher geladen…'}
                  </div>
                )}
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
      ) : null}
    </Card>
  )
}
