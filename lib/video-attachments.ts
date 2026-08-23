const ATTACHMENT_KEY_PREFIX = 'videoAttachments:'
const DOWNLOAD_PREFIX = '/api/download/attachment/'

export const MAX_VIDEO_ATTACHMENTS = 20

export type StoredVideoAttachment = {
  id: string
  filename: string
  pathname: string
  contentType: 'text/markdown'
  size: number
  sha256: string
  uploadedAt: string
}

export type VideoAttachment = {
  id: string
  filename: string
  contentType: 'text/markdown'
  size: number
  uploadedAt: string
  url: string
}

export function videoAttachmentSettingKey(videoId: string) {
  return `${ATTACHMENT_KEY_PREFIX}${videoId}`
}

export function parseVideoAttachmentSetting(
  value: unknown,
  videoId: string
): StoredVideoAttachment[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const candidate = item as Record<string, unknown>
    if (
      typeof candidate.id !== 'string' ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(candidate.id) ||
      typeof candidate.filename !== 'string' ||
      !candidate.filename.toLowerCase().endsWith('.md') ||
      typeof candidate.pathname !== 'string' ||
      !candidate.pathname.startsWith(`attachments/${videoId}/`) ||
      !candidate.pathname.toLowerCase().endsWith('.md') ||
      candidate.pathname.includes('..') ||
      candidate.pathname.includes('\\') ||
      candidate.pathname.includes('://') ||
      candidate.contentType !== 'text/markdown' ||
      typeof candidate.size !== 'number' ||
      !Number.isSafeInteger(candidate.size) ||
      candidate.size <= 0 ||
      typeof candidate.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(candidate.sha256) ||
      typeof candidate.uploadedAt !== 'string' ||
      Number.isNaN(Date.parse(candidate.uploadedAt))
    ) {
      return []
    }

    return [
      {
        id: candidate.id,
        filename: candidate.filename,
        pathname: candidate.pathname,
        contentType: candidate.contentType,
        size: candidate.size,
        sha256: candidate.sha256,
        uploadedAt: candidate.uploadedAt,
      } satisfies StoredVideoAttachment,
    ]
  })
}

export function toVideoAttachment(
  videoId: string,
  attachment: StoredVideoAttachment
): VideoAttachment {
  return {
    id: attachment.id,
    filename: attachment.filename,
    contentType: attachment.contentType,
    size: attachment.size,
    uploadedAt: attachment.uploadedAt,
    url: `${DOWNLOAD_PREFIX}${encodeURIComponent(videoId)}/${encodeURIComponent(
      attachment.id
    )}/${encodeURIComponent(attachment.filename)}`,
  }
}
