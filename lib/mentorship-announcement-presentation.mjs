// A thumbnail attachment avoids Bunny hotlink protection in Discord previews.
// Fetch before claiming/sending: a missing thumbnail may retry, a POST may not.
export async function preparePresentation(video, videoUrl, fetcher = fetch) {
  if (!/^[a-f0-9-]{36}$/i.test(video.bunnyGuid)) throw new Error('VIDEO_GUID_INVALID')
  const thumbnailUrl = `https://vz-08bb86cc-ee1.b-cdn.net/${video.bunnyGuid}/thumbnail.jpg`
  let bytes
  try {
    const r = await fetcher(thumbnailUrl, {headers:{Referer:'https://iframe.mediadelivery.net/'}, cache:'no-store', redirect:'error', signal:AbortSignal.timeout(8000)})
    if (!r.ok || !r.headers.get('content-type')?.startsWith('image/jpeg') || Number(r.headers.get('content-length')) > 5*1024*1024) throw new Error('THUMBNAIL_NOT_READY')
    bytes = new Uint8Array(await r.arrayBuffer())
    if (bytes.length < 3 || bytes.length > 5*1024*1024 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) throw new Error('THUMBNAIL_NOT_READY')
  } catch { throw new Error('THUMBNAIL_NOT_READY') }
  // Metadata cannot introduce @here, extra @everyone, or user/role mentions.
  const label = value => String(value ?? '').replaceAll('@', '@\u200b').slice(0,240) || '—'
  const title = label(video.title), moduleName = label(video.chapter.module.name), chapter = label(video.chapter.name)
  const course = label(video.chapter.module.playlist?.name || video.chapter.module.name)
  const content = ['@everyone', 'Moin zusammen,', '', `die neue Aufnahme **${title}** ist jetzt verfügbar.`, `Ihr findet sie unter **${course} → ${moduleName} → ${chapter}**.`, '', videoUrl, '', 'Viel Spaß beim Anschauen!', 'Petar'].join('\n')
  const embed = {
    title:`Neues Video: ${title}`, url:videoUrl,
    description:`Neue Lektion aus **${course}**.\nDer Direktlink steht direkt im Text über dieser Vorschau.`,
    color:0x24fc35, image:{url:'attachment://thumbnail.jpg'},
    fields:[{name:'Kurs',value:course,inline:true},{name:'Modul',value:moduleName,inline:true},{name:'Kapitel',value:chapter,inline:true}],
    footer:{text:'Price Action Trader Mentorship',icon_url:'https://www.price-action-trader.de/images/pat-banner.jpeg'},
  }
  return {content, embed, thumbnail:new Blob([bytes],{type:'image/jpeg'})}
}

export function verifyPresentation(message, expected, channelId) {
  const embed = message.embeds?.find(e => e.url === expected.url)
  let image
  try { image = new URL(embed?.image?.url) } catch { throw new Error('DELIVERY_EMBED_READBACK_MISMATCH') }
  const fields = rows => JSON.stringify(rows?.map(({name,value,inline})=>({name,value,inline})))
  if (!embed || embed.title !== expected.title || embed.description !== expected.description || embed.color !== expected.color || fields(embed.fields) !== fields(expected.fields) || embed.footer?.text !== expected.footer.text || embed.footer?.icon_url !== expected.footer.icon_url || image.protocol !== 'https:' || !['cdn.discordapp.com','media.discordapp.net'].includes(image.hostname) || !image.pathname.startsWith(`/attachments/${channelId}/`) || !image.pathname.endsWith('/thumbnail.jpg')) throw new Error('DELIVERY_EMBED_READBACK_MISMATCH')
}
