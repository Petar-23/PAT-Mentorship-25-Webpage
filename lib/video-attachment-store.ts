import { prisma } from '@/lib/prisma'
import {
  parseVideoAttachmentSetting,
  toVideoAttachment,
  videoAttachmentSettingKey,
  type VideoAttachment,
} from '@/lib/video-attachments'

export async function readVideoAttachmentMap(videoIds: string[]) {
  const uniqueVideoIds = Array.from(new Set(videoIds))
  const result = new Map<string, VideoAttachment[]>()
  for (const videoId of uniqueVideoIds) result.set(videoId, [])
  if (uniqueVideoIds.length === 0) return result

  const rows = await prisma.adminSetting.findMany({
    where: { key: { in: uniqueVideoIds.map(videoAttachmentSettingKey) } },
    select: { key: true, value: true },
  })
  const keyToVideoId = new Map(
    uniqueVideoIds.map((videoId) => [videoAttachmentSettingKey(videoId), videoId])
  )

  for (const row of rows) {
    const videoId = keyToVideoId.get(row.key)
    if (!videoId) continue
    result.set(
      videoId,
      parseVideoAttachmentSetting(row.value, videoId).map((attachment) =>
        toVideoAttachment(videoId, attachment)
      )
    )
  }

  return result
}
