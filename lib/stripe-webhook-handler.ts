import { persistPatSourceFromMentorshipCheckout } from '@/lib/pat-source'
import { handleRaidMapCheckoutCompleted } from '@/lib/raidmap-fulfillment'
import {
  handleResearchCheckoutCompleted,
  handleResearchSubscriptionEvent,
  notifyResearchInvoicePaid,
} from '@/lib/research/stripe'
import { sendCortanaTelegram } from '@/lib/telegram-notify'
import type Stripe from 'stripe'
import { stripe } from './stripe'
import { prisma } from './prisma'
import { upsertUserSubscription } from './user-subscription-cache'
import { fulfillCheckoutSession, handleCheckoutAsyncPaymentFailed } from './checkout-fulfillment'
import { CHECKOUT_PRODUCT, readCheckoutMetadata } from './checkout-guest.mjs'
import { ensureCustomerTaxInfo } from './updateCustomers'
import {
  addRoleToGuildMember,
  removeRoleFromGuildMember,
  sendDiscordChannelMessage,
} from './discord'

// Define type for Stripe error handling
interface StripeError extends Error {
  type: string
  code?: string
  param?: string
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name}`)
  }
  return value
}

function getCustomerIdFromSubscription(subscription: Stripe.Subscription): string | null {
  if (!subscription.customer) return null
  return typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id
}

function formatUnix(unix: number | null | undefined): string {
  if (!unix) return '—'
  return new Date(unix * 1000).toISOString()
}

function unixToDate(unix: number | null | undefined): Date | null {
  if (!unix || !Number.isFinite(unix)) return null
  return new Date(unix * 1000)
}

// Raid-Map-Abos: eigener Cache (RaidMapSubscription), komplett getrennt vom
// Mentorship-Pfad. userId kommt aus subscription.metadata (wird im Checkout
// immer gesetzt) — der Raid-Map-Customer traegt bewusst KEIN metadata.userId.
async function upsertRaidMapSubscription(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId
  if (!userId) {
    console.warn('[raidmap] subscription event ohne metadata.userId — skip', subscription.id)
    return
  }

  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id
  const priceId = subscription.items?.data?.[0]?.price?.id ?? null

  await prisma.raidMapSubscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId: customerId ?? '',
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      tier: subscription.metadata?.tier ?? null,
      priceId,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      currentPeriodEnd: unixToDate(subscription.current_period_end),
    },
    update: {
      stripeCustomerId: customerId ?? '',
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      tier: subscription.metadata?.tier ?? null,
      priceId,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      currentPeriodEnd: unixToDate(subscription.current_period_end),
    },
  })

  console.log('[raidmap] subscription cached', { userId, status: subscription.status })
}

async function getCustomerInfo(customerId: string): Promise<{
  email: string | null
  appUserId: string | null
  discordUserId: string | null
}> {
  const customer = await stripe.customers.retrieve(customerId)

  // Stripe kann auch ein DeletedCustomer zurückgeben (hat dann { deleted: true })
  if ('deleted' in customer && customer.deleted) {
    return { email: null, appUserId: null, discordUserId: null }
  }

  return {
    email: customer.email ?? null,
    appUserId: customer.metadata?.userId ?? null,
    discordUserId: customer.metadata?.discordUserId ?? null,
  }
}

async function safeSendModEmbed(embed: {
  title: string
  description: string
  color?: number
  fields?: Array<{ name: string; value: string; inline?: boolean }>
  footer?: { text: string }
  timestamp?: string
}) {
  const channelId = process.env.DISCORD_MOD_CHANNEL_ID
  if (!channelId) return

  try {
    await sendDiscordChannelMessage({
      channelId,
      content: '',
      embeds: [embed]
    })
  } catch (err) {
    console.error('Failed to send Discord mod embed:', err)
  }
}

async function safeSetMenteeRole(discordUserId: string) {
  try {
    const guildId = requireEnv('DISCORD_GUILD_ID')
    const roleId = requireEnv('DISCORD_ROLE_MENTEE26_ID')
    await addRoleToGuildMember({ guildId, discordUserId, roleId })
  } catch (err) {
    console.error('Failed to add Discord role:', err)
  }
}

async function safeRemoveMenteeRole(discordUserId: string) {
  try {
    const guildId = requireEnv('DISCORD_GUILD_ID')
    const roleId = requireEnv('DISCORD_ROLE_MENTEE26_ID')
    await removeRoleFromGuildMember({ guildId, discordUserId, roleId })
  } catch (err) {
    console.error('Failed to remove Discord role:', err)
  }
}

function shouldHaveAccessAndRole(subscription: Stripe.Subscription) {
  const status = subscription.status
  const isActiveOrTrial = status === 'active' || status === 'trialing'
  if (!isActiveOrTrial) return false

  // Falls das Periodenende bereits erreicht ist, soll der Zugriff/Rolle weg sein.
  const periodStillActive = subscription.current_period_end
    ? subscription.current_period_end * 1000 > Date.now()
    : true
  if (!periodStillActive) return false

  // Business-Regel:
  // - "active" behält Zugriff/Rolle bis Periodenende (auch wenn bereits gekündigt wurde)
  // - "trialing" verliert Zugriff/Rolle sofort nach Kündigung (cancel_at_period_end oder cancel_at)
  if (status === 'trialing') {
    const cancelledScheduled =
      Boolean(subscription.cancel_at_period_end) || subscription.cancel_at != null
    return !cancelledScheduled
  }

  // status === 'active'
  return true
}

/** Session aus /api/checkout/start (Gast-Checkout oder angemeldeter Kauf über /checkout)? */
function isGuestCheckoutSession(session: Stripe.Checkout.Session) {
  const meta = readCheckoutMetadata(session)
  return meta.product === CHECKOUT_PRODUCT && meta.flow !== null
}

/**
 * Stripe soll das Event erneut zustellen, wenn die Freischaltung noch nicht fertig ist (Konto wird
 * gerade anderswo angelegt) oder die Vertragsbestätigung an einem vorübergehenden Fehler scheiterte.
 * Der Zugang steht in diesem Fall schon, die Wiederholung holt nur Fehlendes nach.
 */
function assertWebhookFulfillment(
  result: Awaited<ReturnType<typeof fulfillCheckoutSession>>,
  sessionId: string
) {
  if (result.status === 'pending') {
    throw new Error(`Checkout fulfillment pending for ${sessionId}, retry later`)
  }
  if (
    result.status === 'fulfilled' &&
    typeof result.sideEffects === 'object' &&
    (result.sideEffects.mail === 'failed_transient' || result.sideEffects.mail === 'in_progress')
  ) {
    // in_progress: Ein paralleler Versuch (/willkommen) hält die Mail-Sperre und hat nicht versendet.
    throw new Error(`Checkout confirmation mail not sent yet for ${sessionId} (${result.sideEffects.mail}), retry later`)
  }
}

/**
 * Main webhook handler that processes various Stripe events.
 */
export async function handleStripeEvent(event: Stripe.Event) {
  console.log('Received Stripe event:', event.type)

  try {
    switch (event.type) {
      case 'customer.created': {
        const customer = event.data.object as Stripe.Customer
        console.log(`New customer created: ${customer.id}`)

        await ensureCustomerTaxInfo(customer.id)
        break
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        if (subscription.metadata?.product === 'raidmap') {
          // Raid Map: eigener Cache, kein Mentorship-Discord/-Rollen-Pfad
          await upsertRaidMapSubscription(subscription)
          break
        }
        if (subscription.metadata?.product === 'research') {
          // PAT Research: eigener Cache, frisch aus Stripe synchronisiert
          await handleResearchSubscriptionEvent(subscription)
          break
        }
        const customerId = getCustomerIdFromSubscription(subscription)

        if (customerId) {
          console.log(`New subscription created for customer: ${customerId}`)
          await ensureCustomerTaxInfo(customerId)

          const info = await getCustomerInfo(customerId)

          if (info.appUserId) {
            await upsertUserSubscription({
              userId: info.appUserId,
              stripeCustomerId: customerId,
              subscription,
            })
          }

          await safeSendModEmbed({
            title: 'Neuer Kunde registriert',
            description: 'Der Kunde hat erfolgreich ein Abonnement abgeschlossen und erhält Zugang zur Mentorship-Plattform.',
            color: 0x22c55e, // Grün für neue Kunden
            fields: [
              { name: 'E-Mail', value: info.email ?? 'Nicht verfügbar', inline: true },
              { name: 'Stripe Customer ID', value: customerId, inline: true },
              { name: 'Interner User ID', value: info.appUserId ?? 'Nicht verfügbar', inline: true },
              { name: 'Subscription ID', value: subscription.id, inline: false },
              { name: 'Status', value: subscription.status, inline: true }
            ],
            footer: { text: 'Price Action Trader Mentorship' },
            timestamp: new Date().toISOString()
          })

          if (info.discordUserId) {
            if (shouldHaveAccessAndRole(subscription)) {
              await safeSetMenteeRole(info.discordUserId)
            } else {
              await safeRemoveMenteeRole(info.discordUserId)
            }
          }
        }

        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        if (subscription.metadata?.product === 'raidmap') {
          // Raid Map: eigener Cache, kein Mentorship-Discord/-Rollen-Pfad
          await upsertRaidMapSubscription(subscription)
          break
        }
        if (subscription.metadata?.product === 'research') {
          // PAT Research: eigener Cache, frisch aus Stripe synchronisiert
          await handleResearchSubscriptionEvent(subscription)
          break
        }
        const customerId = getCustomerIdFromSubscription(subscription)

        const prev = event.data.previous_attributes as
          | {
              cancel_at_period_end?: boolean
              cancel_at?: number | null
              status?: string
            }
          | undefined

        if (customerId) {
          const info = await getCustomerInfo(customerId)

          if (info.appUserId) {
            await upsertUserSubscription({
              userId: info.appUserId,
              stripeCustomerId: customerId,
              subscription,
            })
          }

          const prevHasCancelAtPeriodEnd =
            prev != null && Object.prototype.hasOwnProperty.call(prev, 'cancel_at_period_end')
          const prevHasCancelAt =
            prev != null && Object.prototype.hasOwnProperty.call(prev, 'cancel_at')

          // Nur melden, wenn cancel_at_period_end IN DIESEM EVENT geändert wurde (Stripe sendet oft mehrere Updates).
          if (
            prevHasCancelAtPeriodEnd &&
            subscription.cancel_at_period_end === true &&
            prev.cancel_at_period_end === false
          ) {
            await safeSendModEmbed({
              title: 'Kündigung eingegangen',
              description: 'Der Kunde hat die Kündigung seines Abonnements beantragt. Der Zugang bleibt bis zum Ende der aktuellen Abrechnungsperiode bestehen.',
              color: 0xf59e0b, // Orange für Warnungen
              fields: [
                { name: 'E-Mail', value: info.email ?? 'Nicht verfügbar', inline: true },
                { name: 'Stripe Customer ID', value: customerId, inline: true },
                { name: 'Interner User ID', value: info.appUserId ?? 'Nicht verfügbar', inline: true },
                { name: 'Subscription ID', value: subscription.id, inline: false },
                { name: 'Kündigungsdatum', value: formatUnix(subscription.current_period_end), inline: true }
              ],
              footer: { text: 'Price Action Trader Mentorship' },
              timestamp: new Date().toISOString()
            })
          }

          // Manche Kündigungen kommen als geplantes `cancel_at` (ohne cancel_at_period_end).
          // Auch hier: nur melden, wenn sich cancel_at in diesem Event geändert hat.
          if (
            subscription.cancel_at_period_end !== true &&
            prevHasCancelAt &&
            prev.cancel_at == null &&
            subscription.cancel_at != null
          ) {
            await safeSendModEmbed({
              title: 'Geplante Kündigung',
              description: 'Eine terminierte Kündigung wurde für das Abonnement eingerichtet. Das Abonnement wird zum angegebenen Zeitpunkt automatisch beendet.',
              color: 0xf59e0b, // Orange für Warnungen
              fields: [
                { name: 'E-Mail', value: info.email ?? 'Nicht verfügbar', inline: true },
                { name: 'Stripe Customer ID', value: customerId, inline: true },
                { name: 'Interner User ID', value: info.appUserId ?? 'Nicht verfügbar', inline: true },
                { name: 'Subscription ID', value: subscription.id, inline: false },
                { name: 'Geplantes Kündigungsdatum', value: formatUnix(subscription.cancel_at), inline: true }
              ],
              footer: { text: 'Price Action Trader Mentorship' },
              timestamp: new Date().toISOString()
            })
          }

          // Melden, wenn eine Kündigung zurückgenommen wurde (cancel_at_period_end wieder false)
          if (
            prevHasCancelAtPeriodEnd &&
            subscription.cancel_at_period_end === false &&
            prev.cancel_at_period_end === true
          ) {
            await safeSendModEmbed({
              title: 'Kündigung zurückgenommen',
              description: 'Der Kunde hat seine Kündigung zurückgezogen. Das Abonnement läuft weiter und der Kunde behält vollen Zugang zur Mentorship-Plattform.',
              color: 0x22c55e, // Grün für positive Änderungen
              fields: [
                { name: 'E-Mail', value: info.email ?? 'Nicht verfügbar', inline: true },
                { name: 'Stripe Customer ID', value: customerId, inline: true },
                { name: 'Interner User ID', value: info.appUserId ?? 'Nicht verfügbar', inline: true },
                { name: 'Subscription ID', value: subscription.id, inline: false },
                { name: 'Status', value: subscription.status, inline: true },
                { name: 'Nächste Abrechnung', value: formatUnix(subscription.current_period_end), inline: true }
              ],
              footer: { text: 'Price Action Trader Mentorship' },
              timestamp: new Date().toISOString()
            })
          }

          // Access/Rolle steuern:
          // - Active bleibt bis Periodenende
          // - Trial verliert sofort bei Kündigung
          if (info.discordUserId) {
            if (shouldHaveAccessAndRole(subscription)) {
              await safeSetMenteeRole(info.discordUserId)
            } else {
              await safeRemoveMenteeRole(info.discordUserId)
            }
          }
        }

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        if (subscription.metadata?.product === 'raidmap') {
          // Raid Map: eigener Cache, kein Mentorship-Discord/-Rollen-Pfad
          await upsertRaidMapSubscription(subscription)
          break
        }
        if (subscription.metadata?.product === 'research') {
          // PAT Research: eigener Cache, frisch aus Stripe synchronisiert
          await handleResearchSubscriptionEvent(subscription)
          break
        }
        const customerId = getCustomerIdFromSubscription(subscription)

        if (customerId) {
          const info = await getCustomerInfo(customerId)

          if (info.appUserId) {
            await upsertUserSubscription({
              userId: info.appUserId,
              stripeCustomerId: customerId,
              subscription,
            })
          }

          await safeSendModEmbed({
            title: 'Abonnement beendet',
            description: 'Das Abonnement wurde erfolgreich beendet und der Zugang entzogen. Discord-Rolle wurde entfernt.',
            color: 0xef4444, // Rot für Beendigungen
            fields: [
              { name: 'E-Mail', value: info.email ?? 'Nicht verfügbar', inline: true },
              { name: 'Stripe Customer ID', value: customerId, inline: true },
              { name: 'Interner User ID', value: info.appUserId ?? 'Nicht verfügbar', inline: true },
              { name: 'Subscription ID', value: subscription.id, inline: false }
            ],
            footer: { text: 'Price Action Trader Mentorship' },
            timestamp: new Date().toISOString()
          })

          if (info.discordUserId) {
            await safeRemoveMenteeRole(info.discordUserId)
          }
        }

        break
      }

      case 'invoice.created': {
        const invoice = event.data.object as Stripe.Invoice
        console.log(
          `New invoice created ${invoice.id} - tax info should be included automatically`
        )

        if (!invoice.footer?.includes('Steueridentifizierungsnummer')) {
          console.warn(`Warning: Invoice ${invoice.id} may be missing tax information`)
        }
        break
      }

      case 'invoice.finalized': {
        const invoice = event.data.object as Stripe.Invoice
        console.log(`Invoice finalized ${invoice.id}`)

        if (!invoice.footer?.includes('Steueridentifizierungsnummer')) {
          console.warn(`Warning: Finalized invoice ${invoice.id} may be missing tax information`)

          if (invoice.customer) {
            const customerId =
              typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id

            console.log(`Attempting to update tax info for customer ${customerId}`)
            await ensureCustomerTaxInfo(customerId)
          }
        }
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        // Raid-Map-Zahlungen an Petars Telegram melden; 0-Betrag-Invoices
        // (Trial-Start) ausgenommen. Nie fatal fuer den Webhook.
        try {
          const invoiceSubscription = (invoice as unknown as { subscription?: string | { id: string } | null }).subscription
          const subscriptionId =
            typeof invoiceSubscription === 'string'
              ? invoiceSubscription
              : invoiceSubscription?.id ?? null
          if ((invoice.amount_paid ?? 0) > 0 && subscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId)
            if (subscription.metadata?.product === 'raidmap') {
              const amount = (invoice.amount_paid / 100).toFixed(2)
              const currency = (invoice.currency ?? 'usd').toUpperCase()
              await sendCortanaTelegram(
                `💰 Raid Map Zahlung eingegangen\n${amount} ${currency} · ${subscription.metadata?.tier ?? '?'} · ${invoice.customer_email ?? '?'}`
              )
            } else if (subscription.metadata?.product === 'research') {
              await notifyResearchInvoicePaid(invoice, subscription)
            }
          }
        } catch (error) {
          console.error('[raidmap] invoice.paid notify failed (non-fatal):', error)
        }
        break
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.metadata?.product === 'raidmap') {
          // Raid-Map-Kauf: TradingView-Claim in die bestehende Grant-Queue legen
          await handleRaidMapCheckoutCompleted(session)
        } else if (session.metadata?.product === 'research') {
          // PAT Research: Abo sofort synchronisieren und Abschluss protokollieren
          await handleResearchCheckoutCompleted(session)
        } else {
          console.log('Checkout completed, customer and subscription events will follow')
          await persistPatSourceFromMentorshipCheckout(session, stripe)
          // Gast-Checkout (/api/checkout/start): Konto, Zugang und Vertragsbestätigung. Der alte
          // Kontoweg (ohne metadata.flow) läuft wie bisher über die customer.subscription.*-Events.
          if (isGuestCheckoutSession(session)) {
            assertWebhookFulfillment(await fulfillCheckoutSession(session.id), session.id)
          }
        }
        break
      }

      case 'checkout.session.async_payment_succeeded': {
        // Verzögerte Zahlungsarten (z. B. SEPA-Lastschrift): Zahlung ist eingegangen. Freischaltung
        // erneut ausführen (idempotent), damit der Zugangs-Cache den aktuellen Stripe-Status hat.
        const session = event.data.object as Stripe.Checkout.Session
        if (isGuestCheckoutSession(session)) {
          assertWebhookFulfillment(await fulfillCheckoutSession(session.id), session.id)
        }
        break
      }

      case 'checkout.session.async_payment_failed': {
        // Verzögerte Zahlung gescheitert: Cache aktualisieren, Petar und Käufer je einmal informieren.
        // Der Zugang richtet sich nach dem Abo-Status, den Stripe danach meldet.
        const session = event.data.object as Stripe.Checkout.Session
        if (isGuestCheckoutSession(session)) {
          const result = await handleCheckoutAsyncPaymentFailed(session.id)
          if (result.status === 'pending') assertWebhookFulfillment(result, session.id)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
  } catch (error) {
    if (error instanceof Error) {
      const stripeError = error as StripeError
      console.error('Error handling Stripe event:', {
        message: stripeError.message,
        type: stripeError.type,
        code: stripeError.code,
      })
    }
    throw error
  }
}