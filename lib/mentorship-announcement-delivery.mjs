import { createHash } from 'node:crypto'
import { verifyTarget } from './mentorship-announcement-target.mjs'
import { preparePresentation, verifyPresentation } from './mentorship-announcement-presentation.mjs'

export function deliveryKey(videoId, target) {
  return `mentorship-announcement:v1:${videoId}:${target.guildId}:${target.channelId}`
}

export async function deliverAnnouncement({ video, env, api, store, ready, thumbnailFetcher = fetch, now = () => new Date().toISOString() }) {
  const target = await verifyTarget(env, api)
  if (!video?.id || !video?.bunnyGuid || !video?.chapter?.module?.id) throw new Error('VIDEO_NOT_FOUND')
  const videoUrl = `https://www.price-action-trader.de/mentorship/modul/${video.chapter.module.id}?video=${video.id}`
  const key = deliveryKey(video.id, target)
  const previous = await store.get(key)
  async function readback(messageId, mentionEveryone = false, embed) {
    const msg = await api(`/channels/${target.channelId}/messages/${messageId}`)
    if (msg.id !== messageId || msg.channel_id !== target.channelId || msg.author?.id !== target.botId || !msg.content?.includes(videoUrl) || Boolean(msg.mention_everyone) !== mentionEveryone || msg.mention_roles?.length || msg.mentions?.length) throw new Error('DELIVERY_READBACK_MISMATCH')
    if (mentionEveryone && (!msg.content.startsWith('@everyone\n') || /@everyone|@here|<@[!&]?\d+>/.test(msg.content.slice('@everyone\n'.length)))) throw new Error('DELIVERY_READBACK_MISMATCH')
    if (embed) verifyPresentation(msg, embed, target.channelId)
    return msg
  }
  if (previous) {
    // Never repeat a send after an ambiguous network or DB result. Operators can
    // reconcile the recorded nonce/message ID without risking a second post.
    if (previous.state === 'sending') throw new Error('DELIVERY_IN_PROGRESS')
    if (previous.state !== 'sent' || !previous.messageId) throw new Error('DELIVERY_REQUIRES_RECONCILIATION')
    // Missing policy means the original no-ping delivery. Never retrofit it.
    await readback(previous.messageId, previous.mentionEveryone === true, previous.embed)
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
  const presentation = await preparePresentation(video, videoUrl, thumbnailFetcher)
  const record = { state:'sending', mentionEveryone:true, embed:presentation.embed, videoId:video.id, guildId:target.guildId, channelId:target.channelId, nonce:createHash('sha256').update(key).digest('hex').slice(0,24), startedAt:now(), previousMessageId:video.announcementMessageId || null }
  if (!await store.claim(key,record)) throw new Error('DELIVERY_ALREADY_CLAIMED')
  const body = new FormData()
  body.append('payload_json', JSON.stringify({content:presentation.content, embeds:[presentation.embed], attachments:[{id:0,filename:'thumbnail.jpg'}], allowed_mentions:{parse:['everyone'],users:[],roles:[],replied_user:false}, nonce:record.nonce, enforce_nonce:true}))
  body.append('files[0]', presentation.thumbnail, 'thumbnail.jpg')
  let sent
  try {
    // No catch-and-send fallback: once POST begins, an error may mean delivered.
    sent = await api(`/channels/${target.channelId}/messages`, { method:'POST', body })
    if (!sent?.id) throw new Error('DISCORD_RESPONSE_UNCERTAIN')
    await readback(sent.id, true, presentation.embed)
    const delivered = { ...record, state:'sent', messageId:sent.id, deliveredAt:now(), verifiedAt:now() }
    await store.complete(key,delivered,video.id)
    return { ...delivered, action:'announced' }
  } catch (error) {
    // Keep a permanent, target-scoped audit/lock even if Discord or DB timed out.
    await store.uncertain(key,{ ...record, state:'uncertain', messageId:sent?.id || null, error: /^[A-Z_0-9]+$/.test(error.message) ? error.message : 'DELIVERY_FAILED', failedAt:now() }).catch(()=>{})
    throw new Error('DELIVERY_REQUIRES_RECONCILIATION')
  }
}
