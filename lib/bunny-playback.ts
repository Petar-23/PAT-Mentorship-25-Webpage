import 'server-only'

import { createHash } from 'node:crypto'

const DEFAULT_PLAYBACK_TTL_SECONDS = 5 * 60
const MIN_PLAYBACK_TTL_SECONDS = 60
const MAX_PLAYBACK_TTL_SECONDS = 15 * 60
const BUNNY_GUID_PATTERN = /^[a-zA-Z0-9-]{6,100}$/

function requiredEnv(name: 'BUNNY_LIBRARY_ID' | 'BUNNY_EMBED_TOKEN_KEY') {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is not configured.`)
  }
  return value
}

function playbackTtlSeconds() {
  const configured = Number.parseInt(process.env.BUNNY_PLAYBACK_TOKEN_TTL_SECONDS ?? '', 10)
  if (!Number.isFinite(configured)) return DEFAULT_PLAYBACK_TTL_SECONDS
  return Math.min(Math.max(configured, MIN_PLAYBACK_TTL_SECONDS), MAX_PLAYBACK_TTL_SECONDS)
}

/**
 * Bunny Stream embed-view tokens are SHA-256(key + video id + unix expiry).
 * The key remains server-only and every URL expires quickly.
 */
export function createSignedBunnyEmbedUrl(input: {
  videoGuid: string
  autoplay?: boolean
  libraryId?: string
  now?: Date
}) {
  const videoGuid = input.videoGuid.trim()
  if (!BUNNY_GUID_PATTERN.test(videoGuid)) {
    throw new Error('Invalid Bunny video id.')
  }

  const libraryId = input.libraryId?.trim() || requiredEnv('BUNNY_LIBRARY_ID')
  const tokenKey = requiredEnv('BUNNY_EMBED_TOKEN_KEY')
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000)
  const expires = nowSeconds + playbackTtlSeconds()
  const token = createHash('sha256')
    .update(`${tokenKey}${videoGuid}${expires}`, 'utf8')
    .digest('hex')

  const url = new URL(
    `https://iframe.mediadelivery.net/embed/${encodeURIComponent(libraryId)}/${encodeURIComponent(videoGuid)}`
  )
  url.searchParams.set('token', token)
  url.searchParams.set('expires', String(expires))
  url.searchParams.set('autoplay', input.autoplay ? 'true' : 'false')

  return { url: url.toString(), expires }
}
