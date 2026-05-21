import { NextResponse } from 'next/server'

const LEAD_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const LEAD_RATE_LIMIT_MAX_ATTEMPTS = 6
const BREVO_CONTACT_SYNC_TIMEOUT_MS = 6_000
const leadAttempts = new Map<string, { count: number; resetAt: number }>()

const isValidEmail = (value: string) => {
  const email = value.trim()
  if (!email) return false
  // Simple, fast check; detailed validation happens in the ESP later.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }

  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  )
}

function consumeRateLimit(key: string) {
  const now = Date.now()
  const current = leadAttempts.get(key)

  if (!current || current.resetAt <= now) {
    leadAttempts.set(key, {
      count: 1,
      resetAt: now + LEAD_RATE_LIMIT_WINDOW_MS,
    })
    return { limited: false, retryAfterSeconds: 0 }
  }

  if (current.count >= LEAD_RATE_LIMIT_MAX_ATTEMPTS) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000)
      ),
    }
  }

  current.count += 1
  return { limited: false, retryAfterSeconds: 0 }
}

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  if (!trimmed) return undefined

  return trimmed.slice(0, maxLength)
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  label: string
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`${label} timed out after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function matchesRequestHost(url: string | null, requestHost: string) {
  if (!url) return false

  try {
    return new URL(url).host === requestHost
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.toLowerCase().includes('application/json')) {
      return NextResponse.json(
        { error: 'Unsupported content type.' },
        { status: 415 }
      )
    }

    const requestHost = new URL(request.url).host
    const origin = request.headers.get('origin')
    const refererHeader = request.headers.get('referer')
    const hasTrustedSource =
      matchesRequestHost(origin, requestHost) ||
      matchesRequestHost(refererHeader, requestHost)

    if (process.env.NODE_ENV === 'production' && !hasTrustedSource) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const rateLimit = consumeRateLimit(`${requestHost}:${getClientIp(request)}`)
    if (rateLimit.limited) {
      return NextResponse.json(
        {
          error:
            'Zu viele Anfragen. Bitte warte kurz und versuche es dann erneut.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimit.retryAfterSeconds.toString(),
          },
        }
      )
    }

    const body = (await request.json().catch(() => null)) as
      | {
          email?: unknown
          firstName?: unknown
          source?: unknown
          utmSource?: unknown
          utmMedium?: unknown
          utmCampaign?: unknown
          utmContent?: unknown
          utmTerm?: unknown
          referrer?: unknown
          website?: unknown
        }
      | null

    if (!body) {
      return NextResponse.json(
        { error: 'Ungueltige Anfrage.' },
        { status: 400 }
      )
    }

    // Bots fuellen versteckte Felder haeufig automatisch aus. Erfolgreich quittieren,
    // damit wir ihnen kein verwertbares Feedback geben.
    if (sanitizeText(body.website, 256)) {
      return NextResponse.json({ ok: true })
    }

    const email = typeof body?.email === 'string' ? body.email : ''
    const firstName = sanitizeText(body.firstName, 80)
    const source = sanitizeText(body.source, 64)
    const utmSource = sanitizeText(body.utmSource, 120)
    const utmMedium = sanitizeText(body.utmMedium, 120)
    const utmCampaign = sanitizeText(body.utmCampaign, 160)
    const utmContent = sanitizeText(body.utmContent, 160)
    const utmTerm = sanitizeText(body.utmTerm, 160)
    const referrer =
      sanitizeText(body.referrer, 300) ||
      sanitizeText(refererHeader, 300)

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Bitte gib eine gültige E‑Mail‑Adresse ein.' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()

    const brevoApiKey = process.env.BREVO_API_KEY
    const brevoListIdRaw = process.env.BREVO_LIST_ID
    const brevoListId = brevoListIdRaw ? Number.parseInt(brevoListIdRaw, 10) : null

    if (brevoApiKey && brevoListId) {
      const attributes: Record<string, string> = {}

      if (firstName) {
        attributes.FIRSTNAME = firstName
      }

      try {
        const res = await fetchWithTimeout(
          'https://api.brevo.com/v3/contacts',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'api-key': brevoApiKey,
            },
            body: JSON.stringify({
              email: normalizedEmail,
              attributes: Object.keys(attributes).length ? attributes : undefined,
              listIds: [brevoListId],
              updateEnabled: true,
            }),
          },
          BREVO_CONTACT_SYNC_TIMEOUT_MS,
          'Brevo contact sync'
        )

        if (!res.ok) {
          const text = await res.text().catch(() => '')
          console.error('Brevo contact sync failed:', res.status, text)
        }
      } catch (error) {
        console.error('Brevo contact sync error:', error)
      }
    } else {
      console.warn('Brevo env not configured. Skipping contact sync.')
    }

    const discordChannelId = process.env.DISCORD_MOD_CHANNEL_ID
    const discordBotToken = process.env.DISCORD_BOT_TOKEN
    const discordClientId = process.env.DISCORD_CLIENT_ID
    const discordClientSecret = process.env.DISCORD_CLIENT_SECRET

    if (
      discordChannelId &&
      discordBotToken &&
      discordClientId &&
      discordClientSecret
    ) {
      try {
        const { sendDiscordChannelMessage } = await import('@/lib/discord')

        await sendDiscordChannelMessage({
          channelId: discordChannelId,
          content: '',
          embeds: [
            {
              title: 'Neuer Quick‑Start Lead',
              color: 0xec4899,
              fields: [
                { name: 'E‑Mail', value: normalizedEmail, inline: false },
                { name: 'Vorname', value: firstName || '—', inline: true },
                { name: 'Quelle', value: source || '—', inline: true },
                { name: 'UTM Source', value: utmSource || '—', inline: true },
                { name: 'UTM Medium', value: utmMedium || '—', inline: true },
                { name: 'UTM Campaign', value: utmCampaign || '—', inline: true },
              ],
              footer: {
                text: referrer ? `Referrer: ${referrer}` : 'Referrer: —',
              },
              timestamp: new Date().toISOString(),
            },
          ],
        })
      } catch (error) {
        console.error('Discord lead notification failed:', error)
      }
    } else {
      console.warn('Discord env not configured. Skipping lead notification.')
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Lead magnet signup failed:', error)
    return NextResponse.json(
      { error: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.' },
      { status: 500 }
    )
  }
}
