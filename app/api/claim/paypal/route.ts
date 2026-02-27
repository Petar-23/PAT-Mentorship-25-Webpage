import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPayPalSubscription } from '@/lib/paypal'

export const dynamic = 'force-dynamic'

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

    const body = await req.json()
    const paypalEmail = typeof body.paypalEmail === 'string' ? body.paypalEmail.trim().toLowerCase() : ''

    if (!paypalEmail) {
      return NextResponse.json(
        { error: 'Bitte gib deine PayPal-Email-Adresse ein.' },
        { status: 400 }
      )
    }

    // Pruefen ob User bereits einen Claim hat
    const existingClaim = await prisma.payPalSubscriber.findUnique({
      where: { userId },
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
    })

    if (!subscriber) {
      return NextResponse.json(
        {
          error:
            'Diese Email-Adresse wurde nicht gefunden. Stelle sicher, dass du die Email verwendest, mit der du bei PayPal bezahlst. Bei Fragen kontaktiere den Support.',
        },
        { status: 404 }
      )
    }

    // Live-Verifikation per PayPal API
    let liveStatus: string
    try {
      const info = await getPayPalSubscription(subscriber.paypalSubscriptionId)
      liveStatus = info.status
    } catch {
      // Falls PayPal API gerade nicht erreichbar: gespeicherten Status verwenden
      console.error('PayPal API check failed, using stored status')
      liveStatus = subscriber.status
    }

    if (liveStatus !== 'ACTIVE') {
      // Status in DB aktualisieren
      await prisma.payPalSubscriber.update({
        where: { id: subscriber.id },
        data: { status: liveStatus },
      })

      return NextResponse.json(
        {
          error:
            'Dein PayPal-Abonnement ist nicht aktiv. Bitte stelle sicher, dass dein Abo aktiv ist und versuche es erneut.',
        },
        { status: 403 }
      )
    }

    // Claim durchfuehren
    await prisma.payPalSubscriber.update({
      where: { id: subscriber.id },
      data: {
        userId,
        claimedAt: new Date(),
        status: liveStatus,
      },
    })

    // UserSubscription Record anlegen (fuer Access-Check)
    await prisma.userSubscription.upsert({
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
    })

    return NextResponse.json({ success: true, redirectUrl: '/mentorship' })
  } catch (error) {
    console.error('PayPal claim error:', error)
    return NextResponse.json(
      { error: 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.' },
      { status: 500 }
    )
  }
}
