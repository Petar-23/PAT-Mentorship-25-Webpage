// lib/bunny.ts
import crypto from 'crypto'

interface BunnyVideoList {
  items: unknown[]
  totalItems: number
  currentPage: number
  itemsPerPage: number
}

// Lazy helpers — avoid throwing at module-evaluation time (breaks Next.js static build)
function getBunnyConfig() {
  const LIBRARY_ID = process.env.BUNNY_LIBRARY_ID
  const API_KEY = process.env.BUNNY_API_KEY
  if (!LIBRARY_ID) throw new Error('Missing BUNNY_LIBRARY_ID')
  if (!API_KEY) throw new Error('Missing BUNNY_API_KEY')
  return {
    LIBRARY_ID,
    API_KEY,
    BASE_URL: `https://video.bunnycdn.com/library/${LIBRARY_ID}`,
    headers: { 'AccessKey': API_KEY, 'Content-Type': 'application/json' } as Record<string, string>,
  }
}

export async function testConnection(): Promise<BunnyVideoList> {
  const { BASE_URL, headers } = getBunnyConfig()
  try {
    const res = await fetch(`${BASE_URL}/videos?page=1`, { headers })
    console.log('Status:', res.status)
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`HTTP ${res.status}: ${text}`)
    }
    return await res.json() as BunnyVideoList
  } catch (error: unknown) {
    console.error('Bunny test failed:', error)
    throw error
  }
}

export async function createVideo(title: string, description = ''): Promise<{ guid: string }> {
  const { BASE_URL, headers } = getBunnyConfig()
  const body = { title, ...(description && { description }) }
  const res = await fetch(`${BASE_URL}/videos`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Create video failed: HTTP ${res.status} ${text}`)
  }
  const data = await res.json() as { guid: string }
  return { guid: data.guid }
}

export async function generateTusSignature(
  videoGuid: string,
  expireMinutes = 60
): Promise<{ signature: string; expire: string }> {
  const { LIBRARY_ID, API_KEY } = getBunnyConfig()
  const expireTimestamp = Math.floor(Date.now() / 1000) + expireMinutes * 60
  const stringToHash = `${LIBRARY_ID}${API_KEY}${expireTimestamp}${videoGuid}`
  const signature = crypto.createHash('sha256').update(stringToHash).digest('hex')
  return {
    signature,
    expire: expireTimestamp.toString(),
  }
}

export async function listVideos(page = 1): Promise<BunnyVideoList> {
  const { BASE_URL, headers } = getBunnyConfig()
  const res = await fetch(`${BASE_URL}/video?page=${page}`, { headers })
  if (!res.ok) throw new Error(`List videos failed: ${await res.text()}`)
  return await res.json() as BunnyVideoList
}

export async function listCollections(): Promise<BunnyVideoList> {
  const { BASE_URL, headers } = getBunnyConfig()
  const res = await fetch(`${BASE_URL}/collection`, { headers })
  if (!res.ok) throw new Error(`List collections failed: ${await res.text()}`)
  return await res.json() as BunnyVideoList
}

export async function createCollection(name: string): Promise<{ guid: string }> {
  const { BASE_URL, headers } = getBunnyConfig()
  const res = await fetch(`${BASE_URL}/collection`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(`Create collection failed: ${await res.text()}`)
  const data = await res.json()
  return { guid: data.guid }
}

export async function deleteVideo(videoGuid: string): Promise<void> {
  const { BASE_URL, headers } = getBunnyConfig()
  const res = await fetch(`${BASE_URL}/videos/${videoGuid}`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok && res.status !== 404) {
    const text = await res.text()
    throw new Error(`Delete video failed: HTTP ${res.status} ${text}`)
  }
}
