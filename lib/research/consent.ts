import 'server-only'

import { createHash } from 'node:crypto'

import type { Prisma } from '@prisma/client'

import { prisma, withPrismaRetry } from '@/lib/prisma'
import {
  RESEARCH_CONSENT_TEXT,
  RESEARCH_CONSENT_VERSIONS,
  isResearchInterval,
  isResearchTier,
  type ResearchInterval,
  type ResearchTier,
} from '@/lib/research/config.mjs'

// Nachweis-Log für Einwilligungen und Erklärungen (ResearchConsentEvent).
// Nur anhängen, nie ändern oder löschen. Keine E-Mail-Adressen oder anderen
// Klardaten in `metadata` ablegen – die Zeile ist über userId zuordenbar.

export const RESEARCH_CONSENT_KINDS = [
  'terms_accepted',
  'withdrawal_waiver',
  'checkout_session_created',
  'checkout_completed',
] as const

export type ResearchConsentKind = (typeof RESEARCH_CONSENT_KINDS)[number]

export type RecordResearchConsentInput = {
  userId: string | null
  kind: ResearchConsentKind
  // Default je Art, siehe researchConsentTextVersion().
  textVersion?: string
  // Verknüpft zusammengehörige Einträge (Checkout-Einwilligung ↔ Session).
  reference?: string | null
  metadata?: Prisma.InputJsonObject | null
}

const MAX_ID_LENGTH = 255
const MAX_TEXT_VERSION_LENGTH = 200

function isResearchConsentKind(value: unknown): value is ResearchConsentKind {
  return typeof value === 'string' && (RESEARCH_CONSENT_KINDS as readonly string[]).includes(value)
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
}

function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex')
}

/**
 * Textversion, die zu einer Art gehört. Checkout-Ereignisse beziehen sich auf
 * beide zum Zeitpunkt gültigen Texte (AGB + Widerrufsverzicht).
 */
export function researchConsentTextVersion(kind: ResearchConsentKind): string {
  switch (kind) {
    case 'terms_accepted':
      return RESEARCH_CONSENT_VERSIONS.terms
    case 'withdrawal_waiver':
      return RESEARCH_CONSENT_VERSIONS.withdrawalWaiver
    case 'checkout_session_created':
    case 'checkout_completed':
      return `${RESEARCH_CONSENT_VERSIONS.terms}+${RESEARCH_CONSENT_VERSIONS.withdrawalWaiver}`
  }
}

function buildConsentData(input: RecordResearchConsentInput): Prisma.ResearchConsentEventCreateInput {
  if (!input || typeof input !== 'object') throw new Error('Invalid research consent input')

  const { userId, kind, reference, metadata } = input
  if (!isResearchConsentKind(kind)) throw new Error('Invalid research consent kind')
  if (userId !== null && !isBoundedString(userId, MAX_ID_LENGTH)) {
    throw new Error('Invalid research consent userId')
  }

  const textVersion = input.textVersion ?? researchConsentTextVersion(kind)
  if (!isBoundedString(textVersion, MAX_TEXT_VERSION_LENGTH)) {
    throw new Error('Invalid research consent textVersion')
  }
  if (reference !== undefined && reference !== null && !isBoundedString(reference, MAX_ID_LENGTH)) {
    throw new Error('Invalid research consent reference')
  }
  if (
    metadata !== undefined &&
    metadata !== null &&
    (typeof metadata !== 'object' || Array.isArray(metadata))
  ) {
    throw new Error('Invalid research consent metadata')
  }

  return {
    userId,
    kind,
    textVersion,
    reference: reference ?? null,
    ...(metadata ? { metadata } : {}),
  }
}

/** Hängt genau einen Eintrag an das Nachweis-Log an. */
export async function recordResearchConsent(input: RecordResearchConsentInput): Promise<{ id: string }> {
  const data = buildConsentData(input)

  return withPrismaRetry(
    () => prisma.researchConsentEvent.create({ data, select: { id: true } }),
    { label: 'Record research consent' }
  )
}

/**
 * Protokolliert AGB-Annahme und Widerrufsverzicht eines Checkouts in EINER
 * Transaktion (beide oder keiner). `reference` verknüpft sie später mit der
 * Stripe-Checkout-Session (checkout_session_created / checkout_completed).
 * `textSha256` belegt den exakten Wortlaut, auch falls jemand den Text ändert,
 * ohne die Version hochzuzählen.
 */
export async function recordCheckoutConsents(input: {
  userId: string
  reference: string
  tier: ResearchTier
  interval: ResearchInterval
}): Promise<{ termsId: string; withdrawalWaiverId: string }> {
  if (!input || typeof input !== 'object') throw new Error('Invalid research consent input')

  const { userId, reference, tier, interval } = input
  if (!isBoundedString(userId, MAX_ID_LENGTH)) throw new Error('Invalid research consent userId')
  if (!isBoundedString(reference, MAX_ID_LENGTH)) throw new Error('Invalid research consent reference')
  if (!isResearchTier(tier) || !isResearchInterval(interval)) {
    throw new Error('Invalid research consent tier or interval')
  }

  const terms = buildConsentData({
    userId,
    kind: 'terms_accepted',
    reference,
    metadata: { tier, interval, textSha256: sha256(RESEARCH_CONSENT_TEXT.terms) },
  })
  const withdrawalWaiver = buildConsentData({
    userId,
    kind: 'withdrawal_waiver',
    reference,
    metadata: { tier, interval, textSha256: sha256(RESEARCH_CONSENT_TEXT.withdrawalWaiver) },
  })

  const [termsRow, waiverRow] = await withPrismaRetry(
    () =>
      prisma.$transaction([
        prisma.researchConsentEvent.create({ data: terms, select: { id: true } }),
        prisma.researchConsentEvent.create({ data: withdrawalWaiver, select: { id: true } }),
      ]),
    { label: 'Record research checkout consents' }
  )

  return { termsId: termsRow.id, withdrawalWaiverId: waiverRow.id }
}
