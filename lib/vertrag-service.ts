import 'server-only'

// Verarbeitung von Kündigungen (/kuendigen, § 312k BGB) und Widerrufen (/widerrufen, § 356a BGB).
// Der Ablauf selbst (Empfänger der E-Mails, Limits, Reihenfolge) steht in lib/vertrag-ablauf.mjs,
// hier werden nur DB (inkl. PayPal-Liste), Stripe, Clerk, E-Mail (Google Workspace über lib/mailer.ts)
// und Telegram angeschlossen.
//
// ANWALTLICH PRÜFEN: Ablauf und Wortlaut sind ein Entwurf. Vor dem Livegang soll ein Anwalt
// für IT- und Wettbewerbsrecht freigeben, was automatisch passiert und was manuell bleibt.
//
// Grundsätze:
// - Jede Erklärung gilt als eingegangen, sobald sie gültig übermittelt wurde. Fehler bei DB,
//   Stripe oder Mailversand dürfen die Eingangsbestätigung auf der Seite nie verhindern.
// - Die Antwort an den Browser ist für alle Fälle gleich aufgebaut und kommt, bevor Stripe gefragt
//   wird. Sie verrät nicht, ob zur E-Mail-Adresse ein Vertrag existiert.
// - Kündigung bei Stripe nur per cancel_at_period_end (umkehrbar), nie sofortige Beendigung.
// - Widerruf: nur erfassen, bestätigen, melden. Beenden, Erstattung und Wertersatz macht Petar.
// - Telegram bekommt nur Eingangs-ID, Typ und Bearbeitungsstatus, keine personenbezogenen Daten.

import { randomBytes } from 'node:crypto'
import type Stripe from 'stripe'
import { clerkClient } from '@clerk/nextjs/server'
import { prisma, withPrismaRetry } from '@/lib/prisma'
import { stripe, getAccessPriceIdsFromEnv, getRaidMapPriceId } from '@/lib/stripe'
import { sendMail } from '@/lib/mailer'
import { sendCortanaTelegram } from '@/lib/telegram-notify'
import {
  CONTACT_EMAIL,
  escapeStripeSearchValue,
  openSubscriptionsFor,
  sameEmail,
  subscriptionMatchesContract,
  type Mail,
  type PriceConfig,
  type SubscriptionFacts,
} from '@/lib/vertrag-erklaerung.mjs'
import {
  acceptKuendigung as acceptKuendigungFlow,
  acceptWiderruf as acceptWiderrufFlow,
  normalizeEmail,
  withTimeout,
  type Accepted,
  type DeclarationDeps,
  type DeclarationRecord,
  type DeclarationUpdate,
} from '@/lib/vertrag-ablauf.mjs'
import type { KuendigungData, WiderrufData } from '@/lib/vertrag-validierung.mjs'

// Zeitgrenzen: Die Eingangsbestätigung muss auch dann erscheinen, wenn DB, Stripe oder Gmail hängen.
// Vor der Antwort: nur Speichern (6 s). Danach (after): Limit zählen 6 s, Stripe bzw. PayPal-Liste
// 15 s (die neutrale E-Mail an eine abweichende Adresse läuft parallel dazu), Mails parallel 8 s
// (je Mail Gmail-Token und Versand zusammen), Update und Telegram parallel 6 s. Schlimmster Fall
// 6 s + 35 s = 41 s, unter maxDuration = 60 in den API-Routen.
const DB_TIMEOUT_MS = 6_000
const STRIPE_BUDGET_MS = 15_000
const STRIPE_UPDATE_TIMEOUT_MS = 10_000
const MAIL_TIMEOUT_MS = 8_000
const MAX_CUSTOMERS = 5

type Contract = KuendigungData['contract']
type CustomerMatch = { id: string; emails: string[] }

// ---------------------------------------------------------------------------
// Stripe und Clerk
// ---------------------------------------------------------------------------

function getPriceConfig(): PriceConfig {
  return {
    mentorshipPriceIds: getAccessPriceIdsFromEnv(),
    raidmapPriceIds: [getRaidMapPriceId('monthly'), getRaidMapPriceId('annual')].filter(
      (id): id is string => typeof id === 'string' && id.length > 0
    ),
  }
}

function toFacts(subscription: Stripe.Subscription, contactEmails: string[]): SubscriptionFacts {
  const priceIds = (subscription.items?.data ?? [])
    .map((item) => (typeof item.price === 'string' ? item.price : item.price?.id))
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

  return {
    id: subscription.id,
    status: subscription.status,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    cancelAt: subscription.cancel_at ?? null,
    currentPeriodEnd: subscription.current_period_end ?? null,
    created: subscription.created,
    product: typeof subscription.metadata?.product === 'string' ? subscription.metadata.product : null,
    priceIds: Array.from(new Set(priceIds)),
    contactEmails,
  }
}

function liveCustomers(customers: Stripe.ApiSearchResult<Stripe.Customer>): Stripe.Customer[] {
  return customers.data
    .filter((customer) => !('deleted' in customer && customer.deleted))
    .sort((a, b) => b.created - a.created)
}

function uniqueEmails(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map(normalizeEmail).filter((value) => value.length > 0)))
}

async function customersByEmail(email: string): Promise<CustomerMatch[]> {
  const customers = await stripe.customers.search({
    query: `email:'${escapeStripeSearchValue(email)}'`,
    limit: 10,
  })
  // Die Stripe-Suche ist keine exakte Adressgleichheit (sie findet z. B. auch längere Adressen mit
  // denselben Wörtern). Ohne diesen Filter könnte eine Kündigung das Abo einer anderen Person treffen.
  return liveCustomers(customers)
    .filter((customer) => sameEmail(customer.email, email))
    .map((customer) => ({ id: customer.id, emails: uniqueEmails([customer.email]) }))
}

// Clerk-Konten, bei denen genau diese Adresse bestätigt ist. Fehler zählen als "keine".
async function verifiedClerkUserIds(email: string): Promise<string[]> {
  try {
    const client = await clerkClient()
    const users = await client.users.getUserList({ emailAddress: [email], limit: 5 })
    return users.data
      .filter((user) =>
        user.emailAddresses.some(
          (address) => sameEmail(address.emailAddress, email) && address.verification?.status === 'verified'
        )
      )
      .map((user) => user.id)
  } catch (error) {
    console.error('[vertrag] Clerk lookup failed (non-fatal):', error)
    return []
  }
}

// Fallback: E-Mail des Kontos (Clerk) → userId → Stripe-Customer. Hilft, wenn die E-Mail im
// Stripe-Kundenportal geändert wurde. Nur bestätigte Clerk-Adressen zählen. Mentorship-Customers
// tragen metadata.userId, Raid-Map-Customers metadata.raidmapUserId (siehe lib/stripe.ts).
async function customersByAccount(email: string, contract: Contract): Promise<CustomerMatch[]> {
  const key = contract === 'raidmap' ? 'raidmapUserId' : 'userId'
  const matches: CustomerMatch[] = []
  for (const userId of await verifiedClerkUserIds(email)) {
    const customers = await stripe.customers.search({
      query: `metadata['${key}']:'${escapeStripeSearchValue(userId)}'`,
      limit: 10,
    })
    matches.push(
      ...liveCustomers(customers).map((customer) => ({ id: customer.id, emails: uniqueEmails([email, customer.email]) }))
    )
  }
  return matches
}

// PayPal-Altverträge: hinterlegt ist die PayPal-Adresse aus der importierten Liste (PayPalSubscriber),
// ersatzweise die bestätigte Clerk-Adresse des Kontos, das den PayPal-Vertrag übernommen hat (Claim).
// Nur für die Wahl des Empfängers, gekündigt wird PayPal weiter von Hand.
async function findPayPalContacts(email: string): Promise<string[]> {
  const byEmail = await withTimeout(
    prisma.payPalSubscriber.findMany({
      where: { paypalEmail: { equals: email, mode: 'insensitive' } },
      select: { paypalEmail: true },
      take: 5,
    }),
    DB_TIMEOUT_MS,
    'PayPal lookup'
  )
  if (byEmail.length > 0) return uniqueEmails([email, ...byEmail.map((row) => row.paypalEmail)])

  const userIds = await verifiedClerkUserIds(email)
  if (userIds.length === 0) return []
  const claimed = await withTimeout(
    prisma.payPalSubscriber.findMany({ where: { userId: { in: userIds } }, select: { paypalEmail: true }, take: 5 }),
    DB_TIMEOUT_MS,
    'PayPal claim lookup'
  )
  return claimed.length > 0 ? uniqueEmails([email, ...claimed.map((row) => row.paypalEmail)]) : []
}

async function subscriptionsForCustomers(customers: CustomerMatch[], seen: Set<string>): Promise<SubscriptionFacts[]> {
  const facts: SubscriptionFacts[] = []
  for (const customer of customers) {
    if (seen.has(customer.id) || seen.size >= MAX_CUSTOMERS) continue
    seen.add(customer.id)
    const subscriptions = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 20 })
    facts.push(...subscriptions.data.map((subscription) => toFacts(subscription, customer.emails)))
  }
  return facts
}

// mode 'open': laufende, kündbare Abos (Kündigung). mode 'any': auch beendete Abos (Widerruf).
async function findSubscriptions(email: string, contract: string, mode: 'open' | 'any'): Promise<SubscriptionFacts[]> {
  const priceConfig = getPriceConfig()
  const relevant = (facts: SubscriptionFacts[]) =>
    mode === 'open'
      ? openSubscriptionsFor(facts, contract, priceConfig)
      : facts.filter((subscription) => subscriptionMatchesContract(subscription, contract, priceConfig))

  const seen = new Set<string>()
  const facts = await subscriptionsForCustomers(await customersByEmail(email), seen)
  if (relevant(facts).length === 0) {
    facts.push(...(await subscriptionsForCustomers(await customersByAccount(email, contract as Contract), seen)))
  }
  const unique = new Map(facts.map((subscription) => [subscription.id, subscription]))
  return Array.from(unique.values())
}

async function scheduleCancellation(subscriptionId: string, declarationId: string): Promise<Date | null> {
  const updated = await stripe.subscriptions.update(
    subscriptionId,
    {
      cancel_at_period_end: true,
      cancellation_details: { comment: `Kündigung über /kuendigen, Eingangs-ID ${declarationId}` },
      metadata: { kuendigung_id: declarationId },
    },
    { timeout: STRIPE_UPDATE_TIMEOUT_MS }
  )
  return updated.current_period_end ? new Date(updated.current_period_end * 1000) : null
}

// ---------------------------------------------------------------------------
// E-Mail (Google Workspace, lib/mailer.ts) und Telegram
// ---------------------------------------------------------------------------

function copyEmail(): string | null {
  return process.env.CONTRACT_NOTICE_COPY_EMAIL?.trim() || null
}

async function sendContractMail(to: string, mail: Mail, options: { tag: string; bcc: boolean }): Promise<boolean> {
  const copy = options.bcc ? copyEmail() : null
  const result = await sendMail(
    {
      to,
      bcc: copy && copy.toLowerCase() !== to.toLowerCase() ? copy : null,
      replyTo: CONTACT_EMAIL,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    },
    { tag: options.tag, timeoutMs: MAIL_TIMEOUT_MS }
  )
  return result.ok
}

async function notifyPetar(lines: string[]) {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '') ?? ''
  await sendCortanaTelegram([...lines, `Details: ${base}/owner/vertrag`].join('\n'))
}

// ---------------------------------------------------------------------------
// Datenbank
// ---------------------------------------------------------------------------

async function saveDeclaration(data: DeclarationRecord): Promise<boolean> {
  try {
    await withTimeout(
      withPrismaRetry(() => prisma.contractDeclaration.create({ data }), { label: 'Save contract declaration' }),
      DB_TIMEOUT_MS,
      'Save contract declaration'
    )
    return true
  } catch (error) {
    // Letzter Rettungsanker, damit keine Erklärung verloren geht: Daten im Server-Log (ohne IP-Hash).
    console.error(
      '[vertrag] Saving declaration failed, full record follows for manual recovery:',
      error,
      JSON.stringify({ ...data, ipHash: undefined })
    )
    return false
  }
}

async function updateDeclaration(id: string, data: DeclarationUpdate) {
  try {
    await withTimeout(
      withPrismaRetry(() => prisma.contractDeclaration.update({ where: { id }, data }), { label: 'Update contract declaration' }),
      DB_TIMEOUT_MS,
      'Update contract declaration'
    )
  } catch (error) {
    console.error('[vertrag] Updating declaration failed:', id, error, JSON.stringify(data))
  }
}

// Zählt die Erklärungen, die im Zeitfenster vor der aktuellen eingegangen sind: je Adresse (als Konto-
// oder Bestätigungsadresse), je IP-Hash und insgesamt. Wirft bei Fehlern, der Ablauf macht dann ohne
// dauerhaftes Limit weiter.
async function countRecent({
  emails,
  ipHash,
  since,
  before,
}: {
  emails: string[]
  ipHash: string | null
  since: Date
  before: Date
}) {
  const receivedAt = { gte: since, lt: before }
  return withTimeout(
    (async () => {
      const emailCounts = await Promise.all(
        emails.map((email) =>
          prisma.contractDeclaration.count({
            where: { receivedAt, OR: [{ email }, { confirmationEmail: email }] },
          })
        )
      )
      const ipCount = ipHash ? await prisma.contractDeclaration.count({ where: { ipHash, receivedAt } }) : null
      const totalCount = await prisma.contractDeclaration.count({ where: { receivedAt } })
      return { emailCounts, ipCount, totalCount }
    })(),
    DB_TIMEOUT_MS,
    'Count recent declarations'
  )
}

async function purgeIpHashes(before: Date) {
  await withTimeout(
    prisma.contractDeclaration.updateMany({ where: { ipHash: { not: null }, receivedAt: { lt: before } }, data: { ipHash: null } }),
    DB_TIMEOUT_MS,
    'Purge IP hashes'
  )
}

// ---------------------------------------------------------------------------
// Einstieg für die API-Routen
// ---------------------------------------------------------------------------

function deps(): DeclarationDeps {
  return {
    now: () => new Date(),
    randomBytes: (size) => randomBytes(size),
    priceConfig: getPriceConfig(),
    internalCopyEmail: copyEmail(),
    saveDeclaration,
    updateDeclaration,
    countRecent,
    purgeIpHashes,
    findSubscriptions,
    findPayPalContacts,
    scheduleCancellation,
    sendMail: sendContractMail,
    notify: notifyPetar,
    stripeBudgetMs: STRIPE_BUDGET_MS,
  }
}

/**
 * Speichert die Kündigung und liefert die (immer gleich aufgebaute) Antwort. `background` erledigt
 * Limit, Stripe, E-Mails und Telegram und wird von der Route per `after` nach der Antwort gestartet.
 */
export function acceptKuendigung(data: KuendigungData, meta: { ipHash: string | null }): Promise<Accepted> {
  return acceptKuendigungFlow(data, meta, deps())
}

/** Wie acceptKuendigung, für den Widerruf. */
export function acceptWiderruf(data: WiderrufData, meta: { ipHash: string | null }): Promise<Accepted> {
  return acceptWiderrufFlow(data, meta, deps())
}
