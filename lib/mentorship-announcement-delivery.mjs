import { createHash } from 'node:crypto'
import { verifyTarget } from './mentorship-announcement-target.mjs'

export function deliveryKey(videoId, target) {
  return `mentorship-announcement:v1:${videoId}:${target.guildId}:${target.channelId}`
}

export async function deliverAnnouncement({ video, env, api, store, ready, now = () => new Date().toISOString() }) {
  const target = await verifyTarget(env, api)
  if (!video?.id || !video?.bunnyGuid || !video?.chapter?.module?.id) throw new Error('VIDEO_NOT_FOUND')
  const videoUrl = `https://www.price-action-trader.de/mentorship/modul/${video.chapter.module.id}?video=${video.id}`
  const key = deliveryKey(video.id, target)
  const previous = await store.get(key)
  async function readback(messageId) {
    const msg = await api(`/channels/${target.channelId}/messages/${messageId}`)
    if (msg.id !== messageId || msg.channel_id !== target.channelId || msg.author?.id !== target.botId || !msg.content?.includes(videoUrl) || msg.mention_everyone || msg.mention_roles?.length) throw new Error('DELIVERY_READBACK_MISMATCH')
    return msg
  }
  if (previous) {
    // Never repeat a send after an ambiguous network or DB result. Operators can
    // reconcile the recorded nonce/message ID without risking a second post.
    if (previous.state === 'sending') throw new Error('DELIVERY_IN_PROGRESS')
    if (previous.state !== 'sent' || !previous.messageId) throw new Error('DELIVERY_REQUIRES_RECONCILIATION')
    await readback(previous.messageId)
    return { ...previous, action: 'already_announced' }
  }
  // A legacy announcedAt says nothing about the destination. Preserve it as
  // evidence, but do not treat a message in PAT HQ as success in the Community.
  if (video.announcementMessageId) {
    let legacy
    try { legacy = await readback(video.announcementMessageId) } catch (e) {
      if (e.message !== 'DISCORD_HTTP_404') throw e
    }
    if (legacy) {
      const record = { state:'sent', videoId:video.id, guildId:target.guildId, channelId:target.channelId, messageId:legacy.id, deliveredAt:video.announcedAt || now(), verifiedAt:now(), migrated:true }
      if (!await store.claim(key,record)) throw new Error('DELIVERY_ALREADY_CLAIMED')
      return { ...record, action:'already_announced' }
    }
  }
  await ready(video.bunnyGuid)
  const record = { state:'sending', videoId:video.id, guildId:target.guildId, channelId:target.channelId, nonce:createHash('sha256').update(key).digest('hex').slice(0,24), startedAt:now(), previousMessageId:video.announcementMessageId || null }
  if (!await store.claim(key,record)) throw new Error('DELIVERY_ALREADY_CLAIMED')
  const course = video.chapter.module.playlist?.name || video.chapter.module.name
  const content = ['Moin zusammen,', '', `die neue Aufnahme **${video.title}** ist jetzt verfügbar.`, `Ihr findet sie unter **${course} → ${video.chapter.module.name} → ${video.chapter.name}**.`, '', videoUrl, '', 'Viel Spaß beim Anschauen!', 'Petar'].join('\n')
  let sent
  try {
    // No catch-and-send fallback: once POST begins, an error may mean delivered.
    sent = await api(`/channels/${target.channelId}/messages`, { method:'POST', body:JSON.stringify({ content, allowed_mentions:{parse:[]}, nonce:record.nonce, enforce_nonce:true }) })
    if (!sent?.id) throw new Error('DISCORD_RESPONSE_UNCERTAIN')
    await readback(sent.id)
    const delivered = { ...record, state:'sent', messageId:sent.id, deliveredAt:now(), verifiedAt:now() }
    await store.complete(key,delivered,video.id)
    return { ...delivered, action:'announced' }
  } catch (error) {
    // Keep a permanent, target-scoped audit/lock even if Discord or DB timed out.
    await store.uncertain(key,{ ...record, state:'uncertain', messageId:sent?.id || null, error: /^[A-Z_0-9]+$/.test(error.message) ? error.message : 'DELIVERY_FAILED', failedAt:now() }).catch(()=>{})
    throw new Error('DELIVERY_REQUIRES_RECONCILIATION')
  }
}
