import { NextResponse } from 'next/server'
const isValidEmail = (value: string) => {
  const email = value.trim()
  if (!email) return false
  // Simple, fast check; detailed validation happens in the ESP later.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const email = typeof body?.email === 'string' ? body.email : ''
    const firstName =
      typeof body?.firstName === 'string' ? body.firstName.trim() : undefined
    const source = typeof body?.source === 'string' ? body.source : undefined
    const utmSource =
      typeof body?.utmSource === 'string' ? body.utmSource : undefined
    const utmMedium =
      typeof body?.utmMedium === 'string' ? body.utmMedium : undefined
    const utmCampaign =
      typeof body?.utmCampaign === 'string' ? body.utmCampaign : undefined
    const utmContent =
      typeof body?.utmContent === 'string' ? body.utmContent : undefined
    const utmTerm = typeof body?.utmTerm === 'string' ? body.utmTerm : undefined
    const referrerHeader = request.headers.get('referer') ?? undefined
    const referrer =
      typeof body?.referrer === 'string' ? body.referrer : referrerHeader

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
        const res = await fetch('https://api.brevo.com/v3/contacts', {
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
        })

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
