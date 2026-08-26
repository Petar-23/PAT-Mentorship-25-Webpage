import type Stripe from 'stripe'

export const PAT_SOURCE_KEY = 'pat_source'

export const PAT_SOURCE_OPTIONS = [
  'YouTube',
  'Instagram',
  'Discord',
  'Freund',
  'Google',
  'X',
  'Andere',
] as const

export type PatSource = (typeof PAT_SOURCE_OPTIONS)[number]

export function mentorshipSourceCustomFields(): Stripe.Checkout.SessionCreateParams.CustomField[] {
  return [
    {
      key: PAT_SOURCE_KEY,
      label: { type: 'custom', custom: 'Wie hast du uns gefunden?' },
      type: 'dropdown',
      optional: false,
      dropdown: {
        options: PAT_SOURCE_OPTIONS.map((option) => ({
          label: option,
          value: option,
        })),
      },
    },
  ]
}

export function readPatSourceFromSession(session: Stripe.Checkout.Session): PatSource | null {
  const raw = session.custom_fields
    ?.find((field) => field.key === PAT_SOURCE_KEY)
    ?.dropdown?.value
    ?.trim()

  if (!raw) return null
  if (!(PAT_SOURCE_OPTIONS as readonly string[]).includes(raw)) return null
  return raw as PatSource
}

// Nur neue Mentorship-Checkouts: pat_source setzen, bestehende Werte nie
// ueberschreiben. Fehler sind nicht fatal — der Webhook darf das Abo nicht
// blockieren.
export async function persistPatSourceFromMentorshipCheckout(
  session: Stripe.Checkout.Session,
  stripeClient: Stripe
) {
  try {
    if (session.metadata?.product === 'raidmap') return

    const source = readPatSourceFromSession(session)
    if (!source) {
      console.log('[pat-source] no source on checkout session — skip')
      return
    }

    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id
    if (!customerId) {
      console.warn('[pat-source] checkout.session.completed ohne customer')
      return
    }

    const customer = await stripeClient.customers.retrieve(customerId)
    if ('deleted' in customer && customer.deleted) return

    if (customer.metadata?.[PAT_SOURCE_KEY]) {
      console.log('[pat-source] existing pat_source — do not overwrite', { customerId })
      return
    }

    await stripeClient.customers.update(customerId, {
      metadata: { [PAT_SOURCE_KEY]: source },
    })

    console.log('[pat-source] wrote customer.metadata.pat_source', { customerId, source })
  } catch (error) {
    console.error('[pat-source] persist failed (non-fatal):', error)
  }
}
