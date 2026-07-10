// Billing-Portal fuer PAT-Raid-Map-Abos (separater Stripe-Customer, USD)
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createRaidMapPortalSession } from '@/lib/stripe'

export async function POST(request: Request) {
  const lang = new URL(request.url).searchParams.get('lang') === 'de' ? 'de' : 'en'
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { message: lang === 'de' ? 'Bitte melde dich erneut an.' : 'Please sign in again.' },
        { status: 401 }
      )
    }

    const { url } = await createRaidMapPortalSession(userId, lang)
    return NextResponse.json({ url })
  } catch (error) {
    console.error('Error in raidmap-portal:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('No Raid Map customer')) {
      return NextResponse.json(
        {
          message:
            lang === 'de'
              ? 'Für diesen Account wurde noch kein Raid-Map-Abo gefunden.'
              : 'No Raid Map subscription found for this account yet.',
        },
        { status: 404 }
      )
    }
    return NextResponse.json(
      {
        message:
          lang === 'de'
            ? 'Das Zahlungsportal konnte nicht geöffnet werden.'
            : 'Could not open the billing portal.',
      },
      { status: 500 }
    )
  }
}
