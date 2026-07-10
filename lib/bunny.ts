// lib/bunny.ts
import 'server-only'

import { createSignedBunnyEmbedUrl } from '@/lib/bunny-playback'

import crypto from 'crypto'

interface BunnyVideoList {
  items: unknown[] // Erweiterbar zu BunnyVideo[]
  totalItems: number
  currentPage: number
  itemsPerPage: number
}

export type BunnyVideoDetails = Record<string, unknown>

type BunnyConfig = {
  libraryId: string
  apiKey: string
  baseUrl: string
  headers: {
    AccessKey: string
    'Content-Type': string
  }
}

let bunnyConfig: BunnyConfig | null = null
const BUNNY_API_TIMEOUT_MS = 12_000
const BUNNY_THUMBNAIL_TIMEOUT_MS = 8_000
const pendingVideoDetails = new Map<string, Promise<BunnyVideoDetails>>()

export class BunnyApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`Bunny API error (${status})`)
  }
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

function getBunnyConfig(): BunnyConfig {
  if (!bunnyConfig) {
    const libraryId = process.env.BUNNY_LIBRARY_ID
    const apiKey = process.env.BUNNY_API_KEY

    if (!libraryId) {
      throw new Error('Missing BUNNY_LIBRARY_ID')
    }

    if (!apiKey) {
      throw new Error('Missing BUNNY_API_KEY')
    }

    bunnyConfig = {
      libraryId,
      apiKey,
      baseUrl: `https://video.bunnycdn.com/library/${libraryId}`,
      headers: {
        AccessKey: apiKey,
        'Content-Type': 'application/json',
      },
    }
  }

  return bunnyConfig
}

export function getBunnyLibraryId(): string {
  return getBunnyConfig().libraryId
}

export async function testConnection(): Promise<BunnyVideoList> {
  try {
    const { baseUrl, headers } = getBunnyConfig()
    const res = await fetchWithTimeout(
      `${baseUrl}/videos?page=1`,
      { headers },
      BUNNY_API_TIMEOUT_MS,
      'Bunny test connection'
    )
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
  const { baseUrl, headers } = getBunnyConfig()
  const body = { title, ...(description && { description }) }
  const res = await fetchWithTimeout(
    `${baseUrl}/videos`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    },
    BUNNY_API_TIMEOUT_MS,
    'Bunny create video'
  )
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
  const { libraryId, apiKey } = getBunnyConfig()
  const expireTimestamp = Math.floor(Date.now() / 1000) + expireMinutes * 60

  // Bunny TUS: SHA256(LibraryId + AccessKey + Expire + VideoId)
  const stringToHash = `${libraryId}${apiKey}${expireTimestamp}${videoGuid}`
  const signature = crypto.createHash('sha256').update(stringToHash).digest('hex')

  return {
    signature,
    expire: expireTimestamp.toString(),
  }
}

export async function listVideos(page = 1): Promise<BunnyVideoList> {
  const { baseUrl, headers } = getBunnyConfig()
  const res = await fetchWithTimeout(
    `${baseUrl}/video?page=${page}`,
    { headers },
    BUNNY_API_TIMEOUT_MS,
    'Bunny list videos'
  )
  if (!res.ok) throw new Error(`List videos failed: ${await res.text()}`)
  return await res.json() as BunnyVideoList
}

export async function listCollections(): Promise<BunnyVideoList> {
  const { baseUrl, headers } = getBunnyConfig()
  const res = await fetchWithTimeout(
    `${baseUrl}/collection`,
    { headers },
    BUNNY_API_TIMEOUT_MS,
    'Bunny list collections'
  )
  if (!res.ok) throw new Error(`List collections failed: ${await res.text()}`)
  return await res.json() as BunnyVideoList
}

export async function createCollection(name: string): Promise<{ guid: string }> {
  const { baseUrl, headers } = getBunnyConfig()
  const res = await fetchWithTimeout(
    `${baseUrl}/collection`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ name }),
    },
    BUNNY_API_TIMEOUT_MS,
    'Bunny create collection'
  )
  if (!res.ok) throw new Error(`Create collection failed: ${await res.text()}`)
  const data = await res.json()
  return { guid: data.guid }
}

export async function deleteVideo(videoGuid: string): Promise<void> {
  const { baseUrl, headers } = getBunnyConfig()
  const res = await fetchWithTimeout(
    `${baseUrl}/videos/${videoGuid}`,
    {
      method: 'DELETE',
      headers,
    },
    BUNNY_API_TIMEOUT_MS,
    'Bunny delete video'
  )
  if (!res.ok && res.status !== 404) {
    const text = await res.text()
    throw new Error(`Delete video failed: HTTP ${res.status} ${text}`)
  }
}

export async function getBunnyVideoDetails(videoGuid: string): Promise<BunnyVideoDetails> {
  const { baseUrl, libraryId, headers } = getBunnyConfig()
  const cacheKey = `${libraryId}:${videoGuid}`
  const pending = pendingVideoDetails.get(cacheKey)
  if (pending) return pending

  const promise = fetchWithTimeout(
    `${baseUrl}/videos/${videoGuid}`,
    {
      headers,
      cache: 'no-store',
    },
    BUNNY_API_TIMEOUT_MS,
    'Bunny video details'
  )
    .then(async (res) => {
      if (!res.ok) {
        throw new BunnyApiError(res.status, await res.text())
      }

      return (await res.json()) as BunnyVideoDetails
    })
    .finally(() => {
      pendingVideoDetails.delete(cacheKey)
    })

  pendingVideoDetails.set(cacheKey, promise)
  return promise
}

// Weitere: addVideoToCollection, createPlaylist, etc. können erweitert werden


export async function resolveBunnyThumbnailUrl(
  videoGuid: string,
  options: { libraryId?: string; referer?: string } = {}
): Promise<string | null> {
  const libraryId = options.libraryId || process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID || process.env.BUNNY_LIBRARY_ID
  if (!libraryId || !videoGuid) return null

  const res = await fetchWithTimeout(
    createSignedBunnyEmbedUrl({ videoGuid, libraryId }).url,
    {
      headers: {
        Referer: options.referer || process.env.NEXT_PUBLIC_APP_URL || 'https://www.price-action-trader.de/',
        'User-Agent': 'Mozilla/5.0 OpenClaw Bunny Thumbnail Resolver',
      },
      cache: 'no-store',
    },
    BUNNY_THUMBNAIL_TIMEOUT_MS,
    'Bunny thumbnail resolve'
  )

  if (!res.ok) return null
  const html = await res.text()
  const match = html.match(/https:\/\/[^"'\s>]+\/thumbnail\.jpg/)
  return match?.[0] || null
}
