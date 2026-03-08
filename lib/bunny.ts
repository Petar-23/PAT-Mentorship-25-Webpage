// lib/bunny.ts
import crypto from 'crypto'

interface BunnyVideoList {
  items: unknown[] // Erweiterbar zu BunnyVideo[]
  totalItems: number
  currentPage: number
  itemsPerPage: number
}

interface BunnyVideoList {
  items: unknown[] // Erweiterbar zu BunnyVideo[]
}

if (!process.env.BUNNY_LIBRARY_ID) {
  throw new Error('Missing BUNNY_LIBRARY_ID')
}

if (!process.env.BUNNY_API_KEY) {
  throw new Error('Missing BUNNY_API_KEY')
}

const LIBRARY_ID = process.env.BUNNY_LIBRARY_ID!
const API_KEY = process.env.BUNNY_API_KEY!
const BASE_URL = `https://video.bunnycdn.com/library/${LIBRARY_ID}`

const headers = {
  'AccessKey': API_KEY,
  'Content-Type': 'application/json',
}

export async function testConnection(): Promise<BunnyVideoList> {
  try {
    const res = await fetch(`${BASE_URL}/videos?page=1`, { headers })
    console.log('Status:', res.status) // Debug
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
  const expireTimestamp = Math.floor(Date.now() / 1000) + expireMinutes * 60

  // Bunny TUS: SHA256(LibraryId + AccessKey + Expire + VideoId)
  const stringToHash = `${LIBRARY_ID}${API_KEY}${expireTimestamp}${videoGuid}`
  const signature = crypto.createHash('sha256').update(stringToHash).digest('hex')

  return {
    signature,
    expire: expireTimestamp.toString(),
  }
}

export async function listVideos(page = 1): Promise<BunnyVideoList> {
  const res = await fetch(`${BASE_URL}/video?page=${page}`, { headers })
  if (!res.ok) throw new Error(`List videos failed: ${await res.text()}`)
  return await res.json() as BunnyVideoList
}

export async function listCollections(): Promise<BunnyVideoList> {
  const res = await fetch(`${BASE_URL}/collection`, { headers })
  if (!res.ok) throw new Error(`List collections failed: ${await res.text()}`)
  return await res.json() as BunnyVideoList
}

export async function createCollection(name: string): Promise<{ guid: string }> {
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
  const res = await fetch(`${BASE_URL}/videos/${videoGuid}`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok && res.status !== 404) {
    const text = await res.text()
    throw new Error(`Delete video failed: HTTP ${res.status} ${text}`)
  }
}

// Weitere: addVideoToCollection, createPlaylist, etc. können erweitert werden


export async function resolveBunnyThumbnailUrl(
  videoGuid: string,
  options: { libraryId?: string; referer?: string } = {}
): Promise<string | null> {
  const libraryId = options.libraryId || process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID || process.env.BUNNY_LIBRARY_ID
  if (!libraryId || !videoGuid) return null

  const res = await fetch(`https://iframe.mediadelivery.net/embed/${libraryId}/${videoGuid}`, {
    headers: {
      Referer: options.referer || process.env.NEXT_PUBLIC_APP_URL || 'https://www.price-action-trader.de/',
      'User-Agent': 'Mozilla/5.0 OpenClaw Bunny Thumbnail Resolver',
    },
    cache: 'no-store',
  })

  if (!res.ok) return null
  const html = await res.text()
  const match = html.match(/https:\/\/[^"'\s>]+\/thumbnail\.jpg/)
  return match?.[0] || null
}
