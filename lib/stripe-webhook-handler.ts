import type Stripe from 'stripe'
import { stripe } from './stripe'
import { prisma } from './prisma'
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

function getPriceIdsFromSubscription(subscription: Stripe.Subscription): string[] {
  const items = subscription.items?.data ?? []
  const ids = items
    .map((item) => {
      const price = item.price
      const priceId = typeof price === 'string' ? price : price?.id
      return typeof priceId === 'string' && priceId.length > 0 ? priceId : null
    })
    .filter((id): id is string => typeof id === 'string')

  return Array.from(new Set(ids))
}

async function upsertUserSubscription(params: {
  userId: string
  stripeCustomerId: string
  subscription: Stripe.Subscription
}) {
  const { userId, stripeCustomerId, subscription } = params

  const priceIds = getPriceIdsFromSubscription(subscription)

  await prisma.userSubscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      currentPeriodEnd: unixToDate(subscription.current_period_end),
      cancelAt: unixToDate(subscription.cancel_at),
      priceIds,
    },
    update: {
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      currentPeriodEnd: unixToDate(subscription.current_period_end),
      cancelAt: unixToDate(subscription.cancel_at),
      priceIds,
    },
  })
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

async function safeSendModMessage(content: string) {
  const channelId = process.env.DISCORD_MOD_CHANNEL_ID
  if (!channelId) return

  try {
    await sendDiscordChannelMessage({ channelId, content })
  } catch (err) {
    console.error('Failed to send Discord mod message:', err)
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

          await safeSendModMessage(
            `Neuer Kunde registriert

Kundendetails:
• E-Mail: ${info.email ?? 'Nicht verfügbar'}
• Stripe Customer ID: ${customerId}
• Interner User ID: ${info.appUserId ?? 'Nicht verfügbar'}
• Subscription ID: ${subscription.id}
• Status: ${subscription.status}

Der Kunde hat erfolgreich ein Abonnement abgeschlossen und erhält Zugang zur Mentorship-Plattform.`
          )

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
            await safeSendModMessage(
              `Kündigung eingegangen

Der Kunde hat die Kündigung seines Abonnements beantragt.

Kundendetails:
• E-Mail: ${info.email ?? 'Nicht verfügbar'}
• Stripe Customer ID: ${customerId}
• Interner User ID: ${info.appUserId ?? 'Nicht verfügbar'}
• Subscription ID: ${subscription.id}
• Kündigungsdatum: ${formatUnix(subscription.current_period_end)}

Der Zugang bleibt bis zum Ende der aktuellen Abrechnungsperiode bestehen.`
            )
          }

          // Manche Kündigungen kommen als geplantes `cancel_at` (ohne cancel_at_period_end).
          // Auch hier: nur melden, wenn sich cancel_at in diesem Event geändert hat.
          if (
            subscription.cancel_at_period_end !== true &&
            prevHasCancelAt &&
            prev.cancel_at == null &&
            subscription.cancel_at != null
          ) {
            await safeSendModMessage(
              `Geplante Kündigung

Eine terminierte Kündigung wurde für das Abonnement eingerichtet.

Kundendetails:
• E-Mail: ${info.email ?? 'Nicht verfügbar'}
• Stripe Customer ID: ${customerId}
• Interner User ID: ${info.appUserId ?? 'Nicht verfügbar'}
• Subscription ID: ${subscription.id}
• Geplantes Kündigungsdatum: ${formatUnix(subscription.cancel_at)}

Das Abonnement wird zum angegebenen Zeitpunkt automatisch beendet.`
            )
          }

          // Melden, wenn eine Kündigung zurückgenommen wurde (cancel_at_period_end wieder false)
          if (
            prevHasCancelAtPeriodEnd &&
            subscription.cancel_at_period_end === false &&
            prev.cancel_at_period_end === true
          ) {
            await safeSendModMessage(
              `Kündigung zurückgenommen

Der Kunde hat seine Kündigung zurückgezogen. Das Abonnement läuft weiter.

Kundendetails:
• E-Mail: ${info.email ?? 'Nicht verfügbar'}
• Stripe Customer ID: ${customerId}
• Interner User ID: ${info.appUserId ?? 'Nicht verfügbar'}
• Subscription ID: ${subscription.id}
• Status: ${subscription.status}
• Nächste Abrechnung: ${formatUnix(subscription.current_period_end)}

Der Kunde behält weiterhin vollen Zugang zur Mentorship-Plattform.`
            )
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

          await safeSendModMessage(
            `Abonnement beendet

Das Abonnement wurde erfolgreich beendet und der Zugang entzogen.

Kundendetails:
• E-Mail: ${info.email ?? 'Nicht verfügbar'}
• Stripe Customer ID: ${customerId}
• Interner User ID: ${info.appUserId ?? 'Nicht verfügbar'}
• Subscription ID: ${subscription.id}

Der Kunde hat keinen Zugang mehr zur Mentorship-Plattform. Discord-Rolle wurde entfernt.`
          )

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

      case 'checkout.session.completed': {
        console.log('Checkout completed, customer and subscription events will follow')
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