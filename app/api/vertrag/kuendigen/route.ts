import { NextResponse, after } from 'next/server'
import { parseKuendigung } from '@/lib/vertrag-validierung.mjs'
import { acceptKuendigung } from '@/lib/vertrag-service'
import { FALLBACK_ERROR, clientIpHash, createLimiters, guardLimits, guardRequest } from '@/lib/vertrag-request'

// Kündigungsbutton nach § 312k BGB. Öffentlich, ohne Login und ohne Captcha.
// ANWALTLICH PRÜFEN: Ablauf und Wortlaut (siehe lib/vertrag-service.ts).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Summe der Zeitgrenzen in lib/vertrag-service.ts (vor und nach der Antwort) bleibt darunter.
export const maxDuration = 60

const limiters = createLimiters()

export async function POST(request: Request) {
  const blocked = guardRequest(request)
  if (blocked) return blocked

  const input = await request.json().catch(() => null)
  const parsed = parseKuendigung(input)
  if (!parsed.ok) {
    return NextResponse.json({ error: 'Bitte prüfen Sie Ihre Angaben.', errors: parsed.errors }, { status: 400 })
  }

  const limited = guardLimits(request, limiters, [parsed.data.accountEmail, parsed.data.confirmationEmail])
  if (limited) return limited

  try {
    // Antwort sofort und für alle Fälle gleich aufgebaut (kein Vertragsende, kein Mitgliedsstatus).
    // Stripe, E-Mails und Telegram laufen erst nach der Antwort.
    const { body, background } = await acceptKuendigung(parsed.data, { ipHash: clientIpHash(request) })
    after(async () => {
      try {
        await background()
      } catch (error) {
        console.error('[vertrag] Kündigung background failed:', body.receipt.id, error)
      }
    })
    return NextResponse.json(body)
  } catch (error) {
    console.error('[vertrag] Kündigung failed:', error)
    return NextResponse.json({ error: FALLBACK_ERROR }, { status: 500 })
  }
}
