export async function verify1080p(guid, fetcher=fetch) {
  if (!/^[a-f0-9-]{36}$/i.test(guid)) throw new Error('VIDEO_GUID_INVALID')
  const base=`https://vz-08bb86cc-ee1.b-cdn.net/${guid}/`
  async function request(url,range=false) {
    if(!url.startsWith(base))throw new Error('HLS_URL_OUTSIDE_VIDEO')
    const r=await fetcher(url,{headers:{Referer:'https://www.price-action-trader.de/',...(range?{Range:'bytes=0-1023'}:{})},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)})
    if(!r.ok)throw new Error('HLS_NOT_READY')
    return r
  }
  const master=await(await request(base+'playlist.m3u8')).text()
  const lines=master.split(/\r?\n/)
  const i=lines.findIndex(l=>l.startsWith('#EXT-X-STREAM-INF:') && /RESOLUTION=1920x1080(?:,|$)/.test(l))
  if(i<0 || !lines[i+1] || lines[i+1].startsWith('#'))throw new Error('HLS_1080P_NOT_READY')
  const variantUrl=new URL(lines[i+1],base).href
  const variant=await(await request(variantUrl)).text()
  if(!variant.startsWith('#EXTM3U') || !variant.includes('#EXT-X-ENDLIST'))throw new Error('HLS_1080P_INCOMPLETE')
  const segment=variant.split(/\r?\n/).find(l=>l && !l.startsWith('#'))
  if(!segment)throw new Error('HLS_SEGMENT_MISSING')
  const response=await request(new URL(segment,variantUrl).href,true)
  if(response.headers.get('content-type')?.includes('text/'))throw new Error('HLS_SEGMENT_INVALID')
  const reader=response.body?.getReader()
  if(!reader)throw new Error('HLS_SEGMENT_EMPTY')
  const first=await reader.read();await reader.cancel()
  if(!first.value?.length)throw new Error('HLS_SEGMENT_EMPTY')
  return {resolution:'1920x1080',segmentHttpStatus:response.status}
}
