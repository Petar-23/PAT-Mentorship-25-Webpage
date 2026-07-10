import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendDiscordChannelMessage, sendDiscordChannelMessageWithAttachment } from '@/lib/discord'
import { buildBunnyThumbnailUrl } from '@/lib/bunny-thumbnail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUNNY_WEBHOOK_SIGNING_SECRET = process.env.BUNNY_WEBHOOK_SIGNING_SECRET?.trim()
const THUMBNAIL_FETCH_TIMEOUT_MS = 8_000

/**
 * Bunny Stream Webhook
 * Receives POST when video status changes.
 * Status 3 = Encoding finished → trigger Discord announcement if not already sent.
 *
 * Payload: { VideoLibraryId: number, VideoGuid: string, Status: number }
 * Docs: https://docs.bunny.net/stream/webhooks
 */

function getStringProp(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const v = record[key]
  return typeof v === 'string' ? v : null
}

function getBooleanProp(value: unknown, key: string): boolean | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const v = record[key]
  return typeof v === 'boolean' ? v : null
}

function isValidSignatureHex(value: string) {
  return /^[a-f0-9]{64}$/.test(value)
}

function timingSafeHexEqual(left: string, right: string) {
  if (!isValidSignatureHex(left) || !isValidSignatureHex(right)) {
    return false
  }

  const leftBuffer = Buffer.from(left, 'hex')
  const rightBuffer = Buffer.from(right, 'hex')

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function verifyBunnyWebhookSignature(rawBody: string, headers: Headers) {
  if (!BUNNY_WEBHOOK_SIGNING_SECRET) {
    return {
      ok: false as const,
      reason: 'signing secret is not configured',
    }
  }

  const version = headers.get('x-bunnystream-signature-version')
  const algorithm = headers.get('x-bunnystream-signature-algorithm')
  const signature = headers.get('x-bunnystream-signature')

  if (version !== 'v1') {
    return {
      ok: false as const,
      reason: 'invalid version',
    }
  }

  if (algorithm !== 'hmac-sha256') {
    return {
      ok: false as const,
      reason: 'invalid algorithm',
    }
  }

  if (!signature) {
    return {
      ok: false as const,
      reason: 'missing signature',
    }
  }

  const expectedSignature = crypto
    .createHmac('sha256', BUNNY_WEBHOOK_SIGNING_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex')

  if (!timingSafeHexEqual(signature, expectedSignature)) {
    return {
      ok: false as const,
      reason: 'signature mismatch',
    }
  }

  return { ok: true as const, reason: null }
}

async function fetchThumbnailAttachment(thumbnailUrl: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), THUMBNAIL_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(thumbnailUrl, {
      headers: { Referer: 'https://iframe.mediadelivery.net/' },
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Thumbnail fetch failed (${response.status})`)
    }

    const bytes = await response.arrayBuffer()
    if (bytes.byteLength === 0) {
      throw new Error('Thumbnail is empty')
    }

    return {
      bytes,
      contentType: response.headers.get('content-type') || 'image/jpeg',
    }
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Thumbnail fetch timed out after ${THUMBNAIL_FETCH_TIMEOUT_MS}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const signatureCheck = verifyBunnyWebhookSignature(rawBody, req.headers)

    if (!signatureCheck.ok) {
      console.error(
        'Bunny webhook signature verification failed:',
        signatureCheck.reason
      )
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    let body: unknown
    try {
      body = JSON.parse(rawBody) as unknown
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const data = body as Record<string, unknown>
    const videoGuid = data.VideoGuid as string | undefined
    const status = data.Status as number | undefined

    if (!videoGuid || status === undefined) {
      return NextResponse.json({ error: 'Missing VideoGuid or Status' }, { status: 400 })
    }

    // Only act on Status 3 (Finished — fully encoded and available)
    if (status !== 3) {
      return NextResponse.json({ ok: true, action: 'ignored', status })
    }

    // Find the video by bunnyGuid
    const video = await prisma.video.findFirst({
      where: { bunnyGuid: videoGuid },
      select: {
        id: true,
        title: true,
        bunnyGuid: true,
        chapter: {
          select: {
            name: true,
            module: {
              select: {
                id: true,
                name: true,
                playlist: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!video) {
      // Video not in our DB — maybe from a different library or deleted
      return NextResponse.json({ ok: true, action: 'video_not_found' })
    }

    // Idempotency: only announce once
    const claim = await prisma.video.updateMany({
      where: { id: video.id, announcedAt: null },
      data: { announcedAt: new Date() },
    })

    if (claim.count === 0) {
      return NextResponse.json({ ok: true, action: 'already_announced' })
    }

    // Build announcement
    const channelId = process.env.DISCORD_ANNOUNCEMENTS_CHANNEL_ID
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL

    if (!channelId || !baseUrl) {
      console.error('Bunny webhook: Missing DISCORD_ANNOUNCEMENTS_CHANNEL_ID or NEXT_PUBLIC_APP_URL')
      // Rollback the claim so it can be retried
      await prisma.video.update({
        where: { id: video.id },
        data: { announcedAt: null },
      })
      return NextResponse.json({ error: 'Missing env config' }, { status: 500 })
    }

    const moduleId = video.chapter.module.id
    const playlistName = video.chapter.module.playlist?.name ?? null
    const moduleName = video.chapter.module.name
    const chapterName = video.chapter.name
    const courseForText = playlistName ?? moduleName
    const videoUrl = `${baseUrl}/mentorship/modul/${moduleId}?video=${video.id}`
    const thumbnailUrl = video.bunnyGuid
      ? buildBunnyThumbnailUrl(video.bunnyGuid)
      : null
    const announcementContent = [
      '@everyone',
      `Moin zusammen, ich habe soeben ein neues Video (**${video.title}**) veröffentlicht.`,
      `Ihr findet das Video in der **${courseForText}**.`,
      '',
      videoUrl,
      '',
      'Passt auf euch auf,',
      'Petar',
    ].join('\n')
    const embedDescription = [
      `Neue Lektion aus **${courseForText}**.`,
      'Der Direktlink steht direkt im Text ueber dieser Vorschau.',
    ].join('\n')

    let messageSent = false

    try {
      // Try with thumbnail attachment (Bunny hotlink protection requires Referer)
      try {
        if (!thumbnailUrl) {
          throw new Error('Thumbnail URL unavailable')
        }

        const thumbnail = await fetchThumbnailAttachment(thumbnailUrl)

        const fileName = 'thumbnail.jpg'

        const message = await sendDiscordChannelMessageWithAttachment({
          channelId,
          content: announcementContent,
          allowedMentions: { parse: ['everyone'] },
          embeds: [
            {
              title: `Neues Video: ${video.title}`,
              url: videoUrl,
              description: embedDescription,
              color: 0x24fc35,
              image: { url: `attachment://${fileName}` },
              fields: [
                ...(playlistName ? [{ name: 'Kurs', value: playlistName, inline: true }] : []),
                { name: 'Modul', value: moduleName, inline: true },
                { name: 'Kapitel', value: chapterName, inline: true },
              ],
              footer: {
                text: 'Price Action Trader Mentorship',
                icon_url: `${baseUrl}/images/pat-banner.jpeg`,
              },
            },
          ],
          file: {
            name: fileName,
            contentType: thumbnail.contentType,
            data: thumbnail.bytes,
          },
        })

        messageSent = true
        const messageId = getStringProp(message, 'id')
        const mentionEveryone = getBooleanProp(message, 'mention_everyone')

        if (mentionEveryone !== true) {
          console.warn('Bunny webhook: Discord announcement posted without mention_everyone ping.', {
            videoId: video.id,
            messageId,
            channelId,
          })
        }

        await prisma.video.update({
          where: { id: video.id },
          data: { announcementMessageId: messageId },
        })

        return NextResponse.json({
          ok: true,
          action: 'announced',
          messageId,
          thumbnail: 'attached',
          mentionEveryone: mentionEveryone === true,
        })
      } catch (thumbErr) {
        console.warn('Bunny webhook: Thumbnail failed, sending without:', thumbErr)

        // Fallback: no thumbnail
        const message = await sendDiscordChannelMessage({
          channelId,
          content: announcementContent,
          allowedMentions: { parse: ['everyone'] },
          embeds: [
            {
              title: `Neues Video: ${video.title}`,
              url: videoUrl,
              description: embedDescription,
              color: 0x2563eb,
              fields: [
                ...(playlistName ? [{ name: 'Kurs', value: playlistName, inline: true }] : []),
                { name: 'Modul', value: moduleName, inline: true },
                { name: 'Kapitel', value: chapterName, inline: true },
              ],
              footer: {
                text: 'Price Action Trader Mentorship',
                icon_url: `${baseUrl}/images/pat-banner.jpeg`,
              },
            },
          ],
        })

        messageSent = true
        const messageId = getStringProp(message, 'id')
        const mentionEveryone = getBooleanProp(message, 'mention_everyone')

        if (mentionEveryone !== true) {
          console.warn('Bunny webhook: Discord announcement posted without mention_everyone ping.', {
            videoId: video.id,
            messageId,
            channelId,
          })
        }

        await prisma.video.update({
          where: { id: video.id },
          data: { announcementMessageId: messageId },
        })

        return NextResponse.json({
          ok: true,
          action: 'announced',
          messageId,
          thumbnail: 'none',
          mentionEveryone: mentionEveryone === true,
        })
      }
    } catch (err) {
      // Rollback claim if message wasn't sent
      if (!messageSent) {
        try {
          await prisma.video.update({
            where: { id: video.id },
            data: { announcedAt: null },
          })
        } catch (rollbackErr) {
          console.error('Bunny webhook: Rollback failed:', rollbackErr)
        }
      }
      throw err
    }
  } catch (err) {
    console.error('Bunny webhook error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
