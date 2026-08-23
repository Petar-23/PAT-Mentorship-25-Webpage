import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseVideoAttachmentSetting,
  toVideoAttachment,
  videoAttachmentSettingKey,
} from './video-attachments.ts'

const videoId = 'video-123'

test('builds a stable AdminSetting key', () => {
  assert.equal(videoAttachmentSettingKey(videoId), 'videoAttachments:video-123')
})

test('parses valid private markdown attachment metadata', () => {
  const parsed = parseVideoAttachmentSetting(
    [
      {
        id: 'attachment-1',
        filename: 'regelwerk.md',
        pathname: 'attachments/video-123/random-regelwerk.md',
        contentType: 'text/markdown',
        size: 42,
        sha256: 'a'.repeat(64),
        uploadedAt: '2026-08-23T12:00:00.000Z',
      },
    ],
    videoId
  )

  assert.equal(parsed.length, 1)
  assert.equal(
    toVideoAttachment(videoId, parsed[0]).url,
    '/api/download/attachment/video-123/attachment-1/regelwerk.md'
  )
})

test('rejects attachment metadata outside the video namespace', () => {
  const parsed = parseVideoAttachmentSetting(
    [
      {
        id: 'attachment-1',
        filename: 'regelwerk.md',
        pathname: 'attachments/another-video/random-regelwerk.md',
        contentType: 'text/markdown',
        size: 42,
        sha256: 'a'.repeat(64),
        uploadedAt: '2026-08-23T12:00:00.000Z',
      },
    ],
    videoId
  )

  assert.deepEqual(parsed, [])
})
