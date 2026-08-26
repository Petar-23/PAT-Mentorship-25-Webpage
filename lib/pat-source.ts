import type Stripe from 'stripe'

export const PAT_SOURCE_FIELD_KEY = 'pat_source'

export const PAT_SOURCE_OPTIONS = [
  'YouTube',
  'Instagram',
  'Discord',
  'Freund',
  'Google',
  'X',
  'Andere',
] as const

export type PatSourceOption = (typeof PAT_SOURCE_OPTIONS)[number]

export const MENTORSHIP_SOURCE_CUSTOM_FIELDS: Stripe.Checkout.SessionCreateParams.CustomField[] =
  [
    {
      key: PAT_SOURCE_FIELD_KEY,
      label: { type: 'custom', custom: 'Wie hast du uns gefunden?' },
      type: 'dropdown',
      dropdown: {
        options: PAT_SOURCE_OPTIONS.map((option) => ({
          label: option,
          value: option,
        })),
      },
    },
  ]

export function readPatSourceFromCheckoutSession(
  session: Pick<Stripe.Checkout.Session, 'custom_fields'>
): PatSourceOption | null {
  const value = session.custom_fields
    ?.find((field) => field.key === PAT_SOURCE_FIELD_KEY)
    ?.dropdown?.value?.trim()

  if (!value) return null
  return PAT_SOURCE_OPTIONS.includes(value as PatSourceOption)
    ? (value as PatSourceOption)
    : null
}
