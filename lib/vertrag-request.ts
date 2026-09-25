import 'server-only'

import { createHmac } from 'node:crypto'
import { NextResponse } from 'next/server'
import { CONTACT_EMAIL, createRateLimiter } from '@/lib/vertrag-erklaerung.mjs'

// Gemeinsame Prüfungen für /api/vertrag/*. Keine Hürden für Menschen (kein Login, kein Captcha),
// nur Schutz gegen Missbrauch: gleiche Herkunft, JSON, Rate-Limit pro IP und pro E-Mail-Adresse.
// Das Rate-Limit zählt nur gültige Erklärungen, damit Tippfehler niemanden aussperren.
// Dieses Limit gilt je Serverless-Instanz im Speicher und schützt vor schnellen Serien. Das
// dauerhafte Limit über die Datenbank steht in lib/vertrag-ablauf.mjs (LIMITS).

export const FALLBACK_ERROR = `Die Übermittlung hat leider nicht geklappt. Bitte versuchen Sie es erneut oder schreiben Sie an ${CONTACT_EMAIL}.`

const TOO_MANY = `Zu viele Anfragen in kurzer Zeit. Bitte versuchen Sie es in einigen Minuten erneut oder schreiben Sie an ${CONTACT_EMAIL}.`

type Limiter = ReturnType<typeof createRateLimiter>
type Limiters = { ip: Limiter; email: Limiter }

export function createLimiters(): Limiters {
  return {
    ip: createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 }),
    email: createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 }),
  }
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || 'unknown'
  return request.headers.get('x-real-ip') || 'unknown'
}

// Die IP wird nie im Klartext gespeichert, nur als HMAC für das dauerhafte Limit (nach 48 Stunden
// gelöscht, siehe lib/vertrag-ablauf.mjs). Schlüssel: CONTRACT_IP_HASH_SECRET, ersatzweise ein
// vorhandenes Server-Geheimnis, damit sich IPv4-Adressen nicht einfach durchprobieren lassen.
function ipHashSecret() {
  return process.env.CONTRACT_IP_HASH_SECRET?.trim() || process.env.CLERK_SECRET_KEY?.trim() || null
}

/** HMAC der Client-IP oder null, wenn IP oder Schlüssel fehlen (dann greift nur das E-Mail-Limit). */
export function clientIpHash(request: Request): string | null {
  const ip = getClientIp(request)
  const secret = ipHashSecret()
  if (ip === 'unknown' || !secret) return null
  return createHmac('sha256', secret).update(`vertrag-ip:v1:${ip.toLowerCase()}`).digest('hex')
}

function hostOf(url: string | null | undefined) {
  if (!url) return null
  try {
    return new URL(url).host.toLowerCase()
  } catch {
    return null
  }
}

// Hinter Proxys kann request.url einen internen Host tragen. Ein falsches 403 würde die gesetzlich
// vorgeschriebene Funktion blockieren, deshalb zählen auch Host, X-Forwarded-Host und die App-URL.
function trustedHosts(request: Request) {
  const hosts = new Set<string>()
  const add = (value: string | null | undefined) => {
    const host = value?.split(',')[0]?.trim().toLowerCase()
    if (host) hosts.add(host)
  }
  add(hostOf(request.url))
  add(request.headers.get('x-forwarded-host'))
  add(request.headers.get('host'))
  add(hostOf(process.env.NEXT_PUBLIC_APP_URL))
  return hosts
}

function tooMany(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: TOO_MANY },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  )
}

/** Prüft Inhaltstyp und Herkunft. Liefert eine Fehlerantwort oder null. */
export function guardRequest(request: Request): NextResponse | null {
  const contentType = request.headers.get('content-type') || ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return NextResponse.json({ error: FALLBACK_ERROR }, { status: 415 })
  }

  if (process.env.NODE_ENV === 'production') {
    const hosts = trustedHosts(request)
    const source = hostOf(request.headers.get('origin')) ?? hostOf(request.headers.get('referer'))
    if (!source || !hosts.has(source)) {
      return NextResponse.json({ error: FALLBACK_ERROR }, { status: 403 })
    }
  }

  return null
}

/** Rate-Limit pro IP und pro E-Mail-Adresse, erst nach erfolgreicher Validierung aufrufen. */
export function guardLimits(request: Request, limiters: Limiters, emails: string[]): NextResponse | null {
  const ipLimit = limiters.ip.consume(getClientIp(request))
  if (ipLimit.limited) return tooMany(ipLimit.retryAfterSeconds)

  for (const email of Array.from(new Set(emails))) {
    const limit = limiters.email.consume(email)
    if (limit.limited) return tooMany(limit.retryAfterSeconds)
  }
  return null
}
