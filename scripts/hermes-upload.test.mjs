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

test('uploadPdf sends authenticated JSON metadata, uploads the full PDF directly, and attaches it only after completion', async () => {
  const dir = makeTempDir()
  const pdfPath = writePdf(dir, 'NYPM - Protokoll.pdf')
  fs.truncateSync(pdfPath, 5_739_687)
  const requests = []
  const pathname = 'pdfs/video_123/test.pdf'
  let uploadedBytes = null

  const server = http.createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = Buffer.concat(chunks)
    requests.push({ method: req.method, url: req.url, authorization: req.headers.authorization, contentType: req.headers['content-type'], body: JSON.parse(body), bytes: body.length })
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(requests.length === 1
      ? { pathname, token: 'scoped-client-token', filename: 'NYPM - Protokoll.pdf', expectedPdfUrl: '/previous.pdf' }
      : { pdfUrl: '/api/download/pdf/video_123/NYPM.pdf' }))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const result = await uploadPdf(`http://127.0.0.1:${server.address().port}`, 'agent-test-token', pdfPath, 'video_123', async (path, file, options) => {
      assert.equal(path, pathname)
      assert.equal(options.access, 'private')
      assert.equal(options.multipart, true)
      assert.equal(options.token, 'scoped-client-token')
      assert.equal(requests.length, 1)
      uploadedBytes = Buffer.from(await file.arrayBuffer())
    })
    assert.equal(result.filename, 'NYPM - Protokoll.pdf')
    assert.equal(result.pdfUrl, '/api/download/pdf/video_123/NYPM.pdf')
    assert.equal(requests.length, 2)
    for (const request of requests) {
      assert.equal(request.method, 'POST')
      assert.equal(request.url, '/api/upload/pdf')
      assert.equal(request.authorization, 'Bearer agent-test-token')
      assert.equal(request.contentType, 'application/json')
      assert.ok(request.bytes < 1024)
    }
    assert.equal(requests[0].body.action, 'prepare')
    assert.equal(requests[0].body.size, 5_739_687)
    assert.equal(requests[1].body.action, 'complete')
    assert.equal(requests[1].body.expectedPdfUrl, '/previous.pdf')
    assert.deepEqual(uploadedBytes, fs.readFileSync(pdfPath))
  } finally {
    server.close()
    await once(server, 'close')
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
