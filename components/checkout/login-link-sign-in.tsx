'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth, useSignIn } from '@clerk/nextjs'
import { SignInIcon } from '@phosphor-icons/react/SignIn'
import { SpinnerGap } from '@phosphor-icons/react/SpinnerGap'
import { WarningCircle } from '@phosphor-icons/react/WarningCircle'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

// Login-Link aus der Vertragsbestätigung (nur für Konten, die beim Kauf neu angelegt wurden):
// /willkommen/anmelden#ticket=… Das Ticket steht im Fragment, geht also nie an den Server und nicht
// in Logs. Es ist einmal nutzbar und 7 Tage gültig (lib/checkout-guest.mjs, LOGIN_LINK_SECONDS).
// Eingelöst wird es erst auf Klick: Link-Scanner in Mailprogrammen, die Seiten mit JavaScript öffnen,
// würden das Einmal-Ticket sonst verbrauchen, bevor der Käufer den Link anklickt.

const TARGET = '/dashboard?willkommen=1'

type Status = 'loading' | 'ready' | 'working' | 'failed' | 'missing' | 'signed-in'

function readTicket(): string | null {
  const hash = typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, '')
  const ticket = new URLSearchParams(hash).get('ticket')
  return ticket && ticket.length > 10 ? ticket : null
}

export function LoginLinkSignIn() {
  const { isLoaded, signIn, setActive } = useSignIn()
  const { isLoaded: authLoaded, isSignedIn } = useAuth()
  const router = useRouter()
  const ticketRef = useRef<string | null>(null)
  const [hasTicket, setHasTicket] = useState<boolean | null>(null)
  const [status, setStatus] = useState<Status>('loading')

  // Sofort beim Laden: Ticket merken und aus der Adresszeile entfernen (Verlauf, Screenshots,
  // Weitergabe der URL, Analyse-Skripte), noch bevor Clerk geladen ist.
  useEffect(() => {
    ticketRef.current = readTicket()
    setHasTicket(Boolean(ticketRef.current))
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
  }, [])

  useEffect(() => {
    if (status !== 'loading' || hasTicket === null || !isLoaded || !authLoaded || !signIn) return
    if (isSignedIn) setStatus('signed-in')
    else setStatus(hasTicket ? 'ready' : 'missing')
  }, [status, hasTicket, isLoaded, authLoaded, isSignedIn, signIn])

  const redeem = () => {
    const ticket = ticketRef.current
    if (!signIn || !ticket || status !== 'ready') return
    setStatus('working')
    ticketRef.current = null
    void (async () => {
      try {
        const attempt = await signIn.create({ strategy: 'ticket', ticket })
        if (attempt.status !== 'complete' || !attempt.createdSessionId) throw new Error(`Sign-in status ${attempt.status}`)
        await setActive({ session: attempt.createdSessionId })
        router.replace(TARGET)
      } catch (error) {
        console.error('Login link sign-in failed:', error)
        setStatus('failed')
      }
    })()
  }

  const busy = status === 'loading' || status === 'working'
  const neutral = busy || status === 'ready' || status === 'signed-in'
  const title =
    status === 'loading' || status === 'ready'
      ? 'Anmelden'
      : status === 'working'
        ? 'Du wirst angemeldet'
        : status === 'signed-in'
          ? 'Du bist bereits angemeldet'
          : 'Dieser Login-Link funktioniert nicht mehr'

  return (
    <div className="min-h-[70vh] bg-gray-50 px-4 py-10 sm:py-16">
      <Card className="mx-auto max-w-xl border-2 shadow-sm" role="status" aria-live="polite">
        <CardContent className="p-6 text-center sm:p-8">
          <div
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
              neutral ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {busy ? (
              <SpinnerGap aria-hidden="true" className="h-6 w-6 animate-spin motion-reduce:animate-none" />
            ) : status === 'ready' ? (
              <SignInIcon aria-hidden="true" className="h-6 w-6" />
            ) : (
              <WarningCircle aria-hidden="true" className="h-6 w-6" />
            )}
          </div>
          <h1 className="mt-5 text-balance text-2xl font-bold text-gray-900 sm:text-3xl">{title}</h1>
          {busy ? (
            <p className="mt-3 text-gray-600">Einen Moment bitte.</p>
          ) : status === 'ready' ? (
            <>
              <p className="mt-3 text-pretty leading-relaxed text-gray-600">
                Mit einem Klick meldest du dich an und kommst in deinen Mitgliederbereich.
              </p>
              <Button type="button" size="lg" className="mt-5 w-full touch-manipulation sm:w-auto" onClick={redeem}>
                Jetzt anmelden
              </Button>
            </>
          ) : status === 'signed-in' ? (
            <Button asChild size="lg" className="mt-5 touch-manipulation">
              <Link href={TARGET} prefetch={false}>
                Zum Mitgliederbereich
              </Link>
            </Button>
          ) : (
            <>
              <p className="mt-3 text-pretty leading-relaxed text-gray-600">
                Der Link ist abgelaufen oder wurde schon benutzt. Melde dich mit deiner E-Mail-Adresse an, du bekommst
                dann einen Code per E-Mail.
              </p>
              <Button asChild size="lg" className="mt-5 touch-manipulation">
                <Link href={`/sign-in?redirect_url=${encodeURIComponent(TARGET)}`} prefetch={false}>
                  Anmelden
                </Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
