import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { once } from 'node:events'

import { parseArgs, uploadPdf, validatePdfFile } from './hermes-upload.mjs'

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pat-hermes-upload-test-'))
}

function writePdf(dir, name = 'slides.pdf') {
  const filePath = path.join(dir, name)
  fs.writeFileSync(filePath, '%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n')
  return filePath
}

test('parseArgs accepts an optional PDF path', () => {
  const args = parseArgs([
    '--type',
    'advanced_content',
    '--file',
    'lesson.mp4',
    '--pdf',
    'slides.pdf',
  ])

  assert.equal(args.type, 'advanced_content')
  assert.equal(args.file, 'lesson.mp4')
  assert.equal(args.pdf, 'slides.pdf')
})

test('validatePdfFile accepts PDFs and rejects files without a PDF signature', () => {
  const dir = makeTempDir()
  try {
    const validPdf = writePdf(dir)
    const validated = validatePdfFile(validPdf)
    assert.equal(validated.filePath, validPdf)
    assert.ok(validated.stats.size > 0)

    const invalidPdf = path.join(dir, 'fake.pdf')
    fs.writeFileSync(invalidPdf, 'not a pdf')
    assert.throws(() => validatePdfFile(invalidPdf), /Invalid PDF file/)

    const oversizedPdf = path.join(dir, 'oversized.pdf')
    fs.writeFileSync(oversizedPdf, '%PDF-')
    fs.truncateSync(oversizedPdf, 25 * 1024 * 1024 + 1)
    assert.throws(() => validatePdfFile(oversizedPdf), /between 1 byte and 25 MB/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('uploadPdf sends authenticated multipart data and returns the lesson PDF URL', async () => {
  const dir = makeTempDir()
  const pdfPath = writePdf(dir, 'NDOG & NWOG Slides.pdf')
  let requestData = null

  const server = http.createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    requestData = {
      method: req.method,
      url: req.url,
      authorization: req.headers.authorization,
      contentType: req.headers['content-type'],
      body: Buffer.concat(chunks),
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ pdfUrl: 'https://example.test/pdfs/video_123/slides.pdf' }))
  })

  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  try {
    const address = server.address()
    assert.ok(address && typeof address === 'object')
    const result = await uploadPdf(
      `http://127.0.0.1:${address.port}`,
      'agent-test-token',
      pdfPath,
      'video_123'
    )

    assert.equal(result.videoId, 'video_123')
    assert.equal(result.filename, 'NDOG & NWOG Slides.pdf')
    assert.equal(result.pdfUrl, 'https://example.test/pdfs/video_123/slides.pdf')
    assert.equal(requestData.method, 'POST')
    assert.equal(requestData.url, '/api/upload/pdf')
    assert.equal(requestData.authorization, 'Bearer agent-test-token')
    assert.match(requestData.contentType, /^multipart\/form-data; boundary=/)

    const body = requestData.body.toString('utf8')
    assert.match(body, /name="videoId"/)
    assert.match(body, /video_123/)
    assert.match(body, /filename="NDOG & NWOG Slides\.pdf"/)
    assert.match(body, /%PDF-1\.4/)
  } finally {
    server.close()
    await once(server, 'close')
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
