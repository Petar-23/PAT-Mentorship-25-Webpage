import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { emailsMatch, getVerifiedPrimaryEmail } from '@/lib/clerk-email'
import { prisma } from '@/lib/prisma'
import { getPayPalSubscription } from '@/lib/paypal'
import { consumePersistentRateLimit } from '@/lib/security-rate-limit'

export const dynamic = 'force-dynamic'

const CLAIM_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const CLAIM_RATE_LIMIT_MAX_ATTEMPTS = 5
const CLAIM_MAX_BODY_BYTES = 1_024
const EMAIL_MAX_LENGTH = 254

class ClaimConflictError extends Error {}

function isPlausibleEmail(value: string) {
  return (
    value.length <= EMAIL_MAX_LENGTH &&
    value.includes('@') &&
    !/\s/.test(value) &&
    /^[^@]+@[^@]+\.[^@]+$/.test(value)
  )
}

function isClaimConflict(error: unknown) {
  if (error instanceof ClaimConflictError) return true
  if (!error || typeof error !== 'object') return false
  return 'code' in error && error.code === 'P2002'
}

async function readClaimEmail(req: Request) {
  const contentLength = Number(req.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > CLAIM_MAX_BODY_BYTES) {
    return { error: 'Request body too large' } as const
  }

  const reader = req.body?.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  if (reader) {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue

      totalBytes += value.byteLength
      if (totalBytes > CLAIM_MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined)
        return { error: 'Request body too large' } as const
      }
      chunks.push(value)
    }
  }

  const bodyBytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  let rawBody: string
  try {
    rawBody = new TextDecoder('utf-8', { fatal: true }).decode(bodyBytes)
  } catch {
    return { error: 'Invalid request body' } as const
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return { error: 'Invalid JSON' } as const
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Invalid request body' } as const
  }

  const paypalEmail = (body as { paypalEmail?: unknown }).paypalEmail
  if (typeof paypalEmail !== 'string') {
    return { error: 'Invalid PayPal email' } as const
  }

  const normalizedEmail = paypalEmail.trim().toLowerCase()
  if (!isPlausibleEmail(normalizedEmail)) {
    return { error: 'Invalid PayPal email' } as const
  }

  return { email: normalizedEmail } as const
}

/**
 * PayPal Claim API: User verknuepft seinen PayPal-Account mit seinem Webapp-Account.
 *
 * POST /api/claim/paypal
 * Body: { paypalEmail: string }
 *
 * 1. Sucht PayPalSubscriber Record per Email
 * 2. Verifiziert live per PayPal API
 * 3. Verknuepft mit Clerk-User
 * 4. Erstellt UserSubscription DB-Record
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
    }

    let rateLimit
    try {
      rateLimit = await consumePersistentRateLimit({
        // Per-user statt user+IP: wechselnde oder gespoofte Proxy-Header dürfen
        // das Limit für einen authentifizierten Account nicht umgehen.
        key: `paypal-claim:user:v1:${userId}`,
        windowMs: CLAIM_RATE_LIMIT_WINDOW_MS,
        maxAttempts: CLAIM_RATE_LIMIT_MAX_ATTEMPTS,
      })
    } catch (error) {
      console.error('PayPal claim rate-limit check failed:', error)
      return NextResponse.json(
        { error: 'Der Claim kann gerade nicht sicher geprüft werden. Bitte versuche es später erneut.' },
        { status: 503 }
      )
    }

    if (rateLimit.limited) {
      return NextResponse.json(
        { error: 'Zu viele Versuche. Bitte warte kurz und versuche es dann erneut.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        }
      )
    }

    const parsedBody = await readClaimEmail(req)
    if ('error' in parsedBody) {
      return NextResponse.json(
        { error: parsedBody.error },
        { status: parsedBody.error === 'Request body too large' ? 413 : 400 }
      )
    }
    const paypalEmail = parsedBody.email

    const clerkUser = await currentUser()
    const verifiedPrimaryEmail = getVerifiedPrimaryEmail(clerkUser)
    if (!verifiedPrimaryEmail) {
      return NextResponse.json(
        { error: 'Bitte verifiziere zuerst deine primäre E-Mail-Adresse.' },
        { status: 403 }
      )
    }

    if (!emailsMatch(paypalEmail, verifiedPrimaryEmail)) {
      return NextResponse.json(
        { error: 'Die PayPal-E-Mail muss deiner verifizierten primären Account-E-Mail entsprechen.' },
        { status: 400 }
      )
    }

    // Pruefen ob User bereits einen Claim hat
    const existingClaim = await prisma.payPalSubscriber.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (existingClaim) {
      return NextResponse.json(
        { error: 'Du hast bereits einen PayPal-Account verknuepft.' },
        { status: 409 }
      )
    }

    // PayPal-Subscriber per Email suchen (Admin muss vorher importiert haben)
    const subscriber = await prisma.payPalSubscriber.findFirst({
      where: {
        paypalEmail: {
          equals: paypalEmail,
          mode: 'insensitive',
        },
        userId: null, // Noch nicht claimed
      },
      select: {
        id: true,
        paypalSubscriptionId: true,
      },
    })

    if (!subscriber) {
      return NextResponse.json(
        {
          error:
            'Wir konnten dein PayPal-Abo nicht eindeutig bestätigen. Prüfe bitte deine PayPal-Email oder kontaktiere den Support.',
        },
        { status: 400 }
      )
    }

    // Live-Verifikation per PayPal API
    let liveInfo: Awaited<ReturnType<typeof getPayPalSubscription>>
    try {
      liveInfo = await getPayPalSubscription(subscriber.paypalSubscriptionId)
    } catch (error) {
      console.error('PayPal live subscription check failed:', error)
      return NextResponse.json(
        { error: 'PayPal konnte gerade nicht sicher verifiziert werden. Bitte versuche es später erneut.' },
        { status: 503 }
      )
    }

    const liveIdentityMatches =
      liveInfo.id === subscriber.paypalSubscriptionId &&
      Boolean(liveInfo.subscriberEmail) &&
      emailsMatch(liveInfo.subscriberEmail, verifiedPrimaryEmail)

    if (liveInfo.status !== 'ACTIVE' || !liveIdentityMatches) {
      // Status in DB aktualisieren
      await prisma.payPalSubscriber.update({
        where: { id: subscriber.id },
        data: { status: liveInfo.status },
      })

      return NextResponse.json(
        {
          error:
            'Wir konnten dein PayPal-Abo nicht eindeutig bestätigen. Prüfe bitte deine PayPal-Email oder kontaktiere den Support.',
        },
        { status: 400 }
      )
    }

    try {
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.payPalSubscriber.updateMany({
          where: {
            id: subscriber.id,
            userId: null,
          },
          data: {
            userId,
            claimedAt: new Date(),
            status: 'ACTIVE',
          },
        })

        if (claimed.count !== 1) {
          throw new ClaimConflictError('PayPal subscription was claimed concurrently')
        }

        // UserSubscription Record anlegen (fuer Access-Check). Beide Writes committen atomar.
        await tx.userSubscription.upsert({
          where: { userId },
          create: {
            userId,
            paypalSubscriptionId: subscriber.paypalSubscriptionId,
            status: 'active',
            cancelAtPeriodEnd: false,
            priceIds: [],
          },
          update: {
            paypalSubscriptionId: subscriber.paypalSubscriptionId,
            status: 'active',
            cancelAtPeriodEnd: false,
          },
          select: { id: true },
        })
      })
    } catch (error) {
      if (isClaimConflict(error)) {
        return NextResponse.json(
          { error: 'Dieser PayPal-Account wurde bereits verknüpft.' },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, redirectUrl: '/mentorship' })
  } catch (error) {
    console.error('PayPal claim error:', error)
    return NextResponse.json(
      { error: 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.' },
      { status: 500 }
    )
  }
}
