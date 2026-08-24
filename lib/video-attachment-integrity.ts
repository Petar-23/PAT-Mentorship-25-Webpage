import { createHash } from 'node:crypto'

export function verifyVideoAttachmentBytes(
  bytes: Uint8Array,
  expectedSize: number,
  expectedSha256: string
) {
  if (!Number.isSafeInteger(expectedSize) || expectedSize <= 0) return false
  if (!/^[a-f0-9]{64}$/.test(expectedSha256)) return false
  if (bytes.byteLength !== expectedSize) return false

  return createHash('sha256').update(bytes).digest('hex') === expectedSha256
}
