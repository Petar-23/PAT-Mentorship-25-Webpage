import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { verifyVideoAttachmentBytes } from './video-attachment-integrity.ts'

const bytes = new TextEncoder().encode('# PAT LDN Model\n\nRegelwerk')
const sha256 = createHash('sha256').update(bytes).digest('hex')

test('accepts an attachment with the exact recorded size and checksum', () => {
  assert.equal(verifyVideoAttachmentBytes(bytes, bytes.byteLength, sha256), true)
})

test('rejects the zero-length response that caused empty downloads', () => {
  assert.equal(verifyVideoAttachmentBytes(new Uint8Array(), bytes.byteLength, sha256), false)
})

test('rejects content with a mismatched checksum', () => {
  const altered = new TextEncoder().encode('# PAT LDN Model\n\nManipuliert')
  assert.equal(verifyVideoAttachmentBytes(altered, altered.byteLength, sha256), false)
})
