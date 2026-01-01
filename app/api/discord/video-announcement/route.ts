import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { sendDiscordChannelMessage, sendDiscordChannelMessageWithAttachment } from '@/lib/discord'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function getStringProp(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const v = record[key]
  return typeof v === 'string' ? v : null
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = await clerkClient()
    const memberships = await client.users.getOrganizationMembershipList({
      userId,
      limit: 100,
    })
    const isAdmin = memberships.data.some((m) => m.role === 'org:admin')
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const videoId = getStringProp(body, 'videoId')
    if (!videoId) {
      return NextResponse.json({ error: 'Missing videoId' }, { status: 400 })
    }

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        chapter: {
          include: {
            module: {
              include: {
                playlist: true,
              },
            },
          },
        },
      },
    })

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    if (!video.bunnyGuid) {
      return NextResponse.json(
        { error: 'Video has no bunnyGuid yet (still processing or not uploaded).' },
        { status: 400 }
      )
    }

    // Idempotency: "claim" das Announcement atomar, damit es nicht doppelt gepostet wird.
    // Wenn schon announcedAt gesetzt ist, war entweder schon ein Post da oder ein anderer Request ist gerade dran.
    const claimedAt = new Date()
    const claim = await prisma.video.updateMany({
      where: { id: video.id, announcedAt: null },
      data: { announcedAt: claimedAt },
    })

    if (claim.count === 0) {
      const existing = await prisma.video.findUnique({
        where: { id: video.id },
        select: { announcedAt: true, announcementMessageId: true },
      })

      return NextResponse.json({
        ok: true,
        alreadyAnnounced: true,
        announcedAt: existing?.announcedAt?.toISOString() ?? null,
        messageId: existing?.announcementMessageId ?? null,
      })
    }

    const channelId = requireEnv('DISCORD_ANNOUNCEMENTS_CHANNEL_ID')
    const baseUrl = requireEnv('NEXT_PUBLIC_APP_URL')

    const moduleId = video.chapter.module.id
    const playlistName = video.chapter.module.playlist?.name ?? null
    const moduleName = video.chapter.module.name
    const chapterName = video.chapter.name

    // Vorbereitung für Schritt 5: Deep-Link auf ein konkretes Video.
    const videoUrl = `${baseUrl}/mentorship/modul/${moduleId}?video=${video.id}`

    const thumbnailUrl = `https://vz-dc8da426-d71.b-cdn.net/${video.bunnyGuid}/thumbnail.jpg`

    const courseForText = playlistName ?? moduleName
    const contentLines = [
      '📹 **Neues Video verfügbar!**',
      '',
      `**${video.title}**`,
      `*${courseForText}*`,
      '',
      '👉 [Direkt zum Video klicken](' + videoUrl + ')',
      '',
      '───',
      '💡 *Tipp:* Klicke auf den Link oben oder nutze die Sidebar in der Mentorship-Übersicht.',
      '',
      '*Bleibt dran für mehr Trading-Wissen!* 🚀',
    ].filter((x): x is string => typeof x === 'string')

    let messageSent = false
    try {
      const content = contentLines.join('\n')

      // Hotlink-Protection: Die Bunny Thumbnail-URLs liefern oft 403 ohne passenden Referer.
      // Deshalb laden wir das Thumbnail serverseitig (mit Referer) und schicken es als Attachment,
      // damit Discord es sicher anzeigen kann.
      try {
        const thumbRes = await fetch(thumbnailUrl, {
          headers: { Referer: 'https://iframe.mediadelivery.net/' },
          cache: 'no-store',
        })

        if (!thumbRes.ok) {
          throw new Error(`Thumbnail fetch failed (${thumbRes.status})`)
        }

        const bytes = await thumbRes.arrayBuffer()
        if (bytes.byteLength === 0) {
          throw new Error('Thumbnail is empty')
        }

        const fileName = 'thumbnail.jpg'
        const embedImageUrl = `attachment://${fileName}`

        const message = await sendDiscordChannelMessageWithAttachment({
          channelId,
          content,
          allowedMentions: { parse: ['everyone'] },
          embeds: [
            {
              title: '🎬 ' + video.title,
              url: videoUrl,
              description: `Ein neues Video aus dem Modul **${moduleName}**`,
              color: 0x00ff00, // Grüne Farbe für Erfolg/Neu
              thumbnail: { url: embedImageUrl },
              image: { url: embedImageUrl },
              fields: [
                ...(playlistName ? [{ name: '📚 Kurs', value: playlistName, inline: true }] : []),
                { name: '📖 Modul', value: moduleName, inline: true },
                { name: '📄 Kapitel', value: chapterName, inline: true },
              ],
              footer: {
                text: 'Price Action Trader Mentorship',
                icon_url: 'https://your-domain.com/images/pat-logo.png' // Optional: Logo hinzufügen
              },
              timestamp: new Date().toISOString(),
            },
          ],
          file: {
            name: fileName,
            contentType: thumbRes.headers.get('content-type') || 'image/jpeg',
            data: bytes,
          },
        })

        messageSent = true

        const messageId = getStringProp(message, 'id')

        await prisma.video.update({
          where: { id: video.id },
          data: { announcementMessageId: messageId },
        })

        return NextResponse.json({ ok: true, messageId, thumbnail: 'attached' })
      } catch (thumbErr) {
        console.warn('Thumbnail attachment failed, falling back to no-thumbnail message:', thumbErr)

        const message = await sendDiscordChannelMessage({
          channelId,
          content,
          allowedMentions: { parse: ['everyone'] },
          embeds: [
            {
              title: '🎬 ' + video.title,
              url: videoUrl,
              description: `Ein neues Video aus dem Modul **${moduleName}**`,
              color: 0x00ff00, // Grüne Farbe für Erfolg/Neu
              fields: [
                ...(playlistName ? [{ name: '📚 Kurs', value: playlistName, inline: true }] : []),
                { name: '📖 Modul', value: moduleName, inline: true },
                { name: '📄 Kapitel', value: chapterName, inline: true },
              ],
              footer: {
                text: 'Price Action Trader Mentorship',
              },
              timestamp: new Date().toISOString(),
            },
          ],
        })

        messageSent = true

      const messageId = getStringProp(message, 'id')

      await prisma.video.update({
        where: { id: video.id },
        data: { announcementMessageId: messageId },
      })

        return NextResponse.json({ ok: true, messageId, thumbnail: 'none' })
      }
    } catch (err) {
      // Wenn wir noch nichts gepostet haben, "unclaim", damit ein späterer Retry möglich ist.
      if (!messageSent) {
        try {
          await prisma.video.update({
            where: { id: video.id },
            data: { announcedAt: null },
          })
        } catch (rollbackErr) {
          console.error('Failed to rollback announcedAt after announcement error:', rollbackErr)
        }
      }
      throw err
    }
  } catch (err) {
    console.error('Discord video announcement failed:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}


