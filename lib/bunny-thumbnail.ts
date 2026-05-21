export const CURRENT_BUNNY_THUMBNAIL_HOST = 'vz-08bb86cc-ee1.b-cdn.net'

export function buildBunnyThumbnailUrl(videoGuid: string): string {
  return `https://${CURRENT_BUNNY_THUMBNAIL_HOST}/${videoGuid}/thumbnail.jpg`
}

export function normalizeBunnyThumbnailUrl(
  thumbnailUrl: string | null | undefined,
  videoGuid: string | null | undefined
): string | null {
  if (thumbnailUrl) {
    try {
      const url = new URL(thumbnailUrl)
      const expectedPath = videoGuid ? `/${videoGuid}/thumbnail.jpg` : null
      const isBunnyThumbnail =
        url.protocol === 'https:' &&
        url.pathname.endsWith('/thumbnail.jpg') &&
        (!expectedPath || url.pathname === expectedPath)

      if (isBunnyThumbnail) {
        url.hostname = CURRENT_BUNNY_THUMBNAIL_HOST
        return url.toString()
      }

      return thumbnailUrl
    } catch {
      // Falls historisch ein ungueltiger String gespeichert wurde, auf den GUID-Fallback gehen.
    }
  }

  if (!videoGuid) return null
  return buildBunnyThumbnailUrl(videoGuid)
}
