#!/usr/bin/env node

import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import process from 'process'
import { pathToFileURL } from 'url'
import * as tus from 'tus-js-client'

const DEFAULT_BASE_URL = 'https://www.price-action-trader.de'
const MAX_PDF_BYTES = 25 * 1024 * 1024

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key] != null) continue
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
  }
}

function printHelp() {
  console.log(`Hermes PAT video uploader

Usage:
  node scripts/hermes-upload.mjs --type daily_review --file "/Volumes/SSD/2026-06/review.mp4"
  node scripts/hermes-upload.mjs --type advanced_content --file lesson.mp4 --title "Liquidity Sweep Entry"
  node scripts/hermes-upload.mjs --type advanced_content --file lesson.mp4 --pdf slides.pdf

Options:
  --type daily_review|advanced_content  Required target workflow.
  --file <path>                         Required local video path.
  --pdf <path>                          Optional PDF slides; attached to the lesson (max 25 MB).
  --title <title>                       Optional; inferred from filename if omitted.
  --date YYYY-MM-DD                     Optional; inferred from filename or file mtime.
  --month YYYY-MM                       Optional; inferred from date.
  --playlist <name>                     Optional override.
  --module <name>                       Optional override, usually "Juni 2026".
  --chapter <name>                      Optional override, e.g. "KW 23" or "Lektionen".
  --description <text>                  Optional Bunny description.
  --base-url <url>                      Defaults to PAT_UPLOAD_BASE_URL or production.
  --token <token>                       Defaults to PAT_UPLOAD_TOKEN or AGENT_UPLOAD_TOKEN.
  --prepare-only                        Create/resolve platform target, but do not upload.
  --dry-run                             Resolve names only; creates nothing.
  --force-upload                        Upload even if idempotency says it was uploaded already.

Environment:
  PAT_UPLOAD_BASE_URL=https://www.price-action-trader.de
  PAT_UPLOAD_TOKEN=<same value as AGENT_UPLOAD_TOKEN on Vercel>
  Optional local env file: ~/.pat-hermes-upload.env
`)
}

export function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      args.help = true
      continue
    }
    if (arg === '--prepare-only') {
      args.prepareOnly = true
      continue
    }
    if (arg === '--dry-run') {
      args.dryRun = true
      continue
    }
    if (arg === '--force-upload') {
      args.forceUpload = true
      continue
    }
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`)
    const key = arg.slice(2)
    const value = argv[i + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`)
    args[key] = value
    i++
  }
  return args
}

function inferTitle(filePath) {
  return path
    .basename(filePath, path.extname(filePath))
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferDateFromText(input) {
  const iso = input.match(/(\d{4})[-_.](\d{2})[-_.](\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const european = input.match(/(\d{2})[-_.](\d{2})[-_.](\d{4})/)
  if (european) return `${european[3]}-${european[2]}-${european[1]}`

  return null
}

function dateFromMtime(filePath) {
  const mtime = fs.statSync(filePath).mtime
  return `${mtime.getFullYear()}-${String(mtime.getMonth() + 1).padStart(2, '0')}-${String(
    mtime.getDate()
  ).padStart(2, '0')}`
}

function monthFromDate(date) {
  return date.slice(0, 7)
}

function idempotencyKeyFor(filePath, stats, type) {
  return crypto
    .createHash('sha256')
    .update(`${type}:${path.resolve(filePath)}:${stats.size}:${stats.mtimeMs}`)
    .digest('hex')
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.mov') return 'video/quicktime'
  if (ext === '.m4v') return 'video/x-m4v'
  if (ext === '.webm') return 'video/webm'
  return 'video/mp4'
}

export function validatePdfFile(filePath) {
  const resolvedPath = path.resolve(String(filePath))
  if (!fs.existsSync(resolvedPath)) throw new Error(`PDF not found: ${resolvedPath}`)

  const stats = fs.statSync(resolvedPath)
  if (!stats.isFile()) throw new Error(`PDF is not a file: ${resolvedPath}`)
  if (path.extname(resolvedPath).toLowerCase() !== '.pdf') {
    throw new Error(`PDF must use the .pdf extension: ${resolvedPath}`)
  }
  if (stats.size <= 0 || stats.size > MAX_PDF_BYTES) {
    throw new Error('PDF must be between 1 byte and 25 MB')
  }

  const fd = fs.openSync(resolvedPath, 'r')
  try {
    const header = Buffer.alloc(5)
    const bytesRead = fs.readSync(fd, header, 0, header.length, 0)
    if (bytesRead !== header.length || header.toString('ascii') !== '%PDF-') {
      throw new Error(`Invalid PDF file: ${resolvedPath}`)
    }
  } finally {
    fs.closeSync(fd)
  }

  return { filePath: resolvedPath, stats }
}

export async function uploadPdf(baseUrl, token, pdfPath, videoId) {
  const { filePath } = validatePdfFile(pdfPath)
  const formData = new FormData()
  formData.append('videoId', String(videoId))
  formData.append(
    'pdf',
    new Blob([fs.readFileSync(filePath)], { type: 'application/pdf' }),
    path.basename(filePath)
  )

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/upload/pdf`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    throw new Error(`PDF upload failed (${res.status}): ${text}`)
  }
  if (!data?.pdfUrl) {
    throw new Error(`PDF upload returned no pdfUrl: ${text}`)
  }

  return { videoId, filename: path.basename(filePath), pdfUrl: data.pdfUrl }
}

async function postJson(baseUrl, token, payload) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/agent/uploads`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    throw new Error(`API request failed (${res.status}): ${text}`)
  }
  return data
}

function uploadTus(filePath, stats, prepared) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath)
    const upload = new tus.Upload(stream, {
      endpoint: prepared.upload.endpoint,
      uploadSize: stats.size,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      metadata: {
        filename: path.basename(filePath),
        filetype: contentTypeFor(filePath),
        title: prepared.video.title,
      },
      headers: {
        AuthorizationSignature: prepared.upload.signature,
        AuthorizationExpire: prepared.upload.expire,
        LibraryId: String(prepared.upload.libraryId),
        VideoId: String(prepared.upload.videoId),
      },
      onError: reject,
      onProgress(bytesUploaded, bytesTotal) {
        const percent = bytesTotal > 0 ? ((bytesUploaded / bytesTotal) * 100).toFixed(1) : '0.0'
        process.stdout.write(`\rUpload: ${percent}%`)
      },
      onSuccess() {
        process.stdout.write('\n')
        resolve(upload.url)
      },
    })
    upload.start()
  })
}

async function main() {
  loadEnvFile(path.join(os.homedir(), '.pat-hermes-upload.env'))
  loadEnvFile(path.join(process.cwd(), '.env.hermes-upload.local'))

  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  const type = args.type
  if (type !== 'daily_review' && type !== 'advanced_content') {
    throw new Error('--type must be daily_review or advanced_content')
  }
  if (!args.file) throw new Error('--file is required')

  const filePath = path.resolve(String(args.file))
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`)
  const stats = fs.statSync(filePath)
  if (!stats.isFile()) throw new Error(`Not a file: ${filePath}`)
  const pdfPath = args.pdf ? validatePdfFile(args.pdf).filePath : null

  const baseUrl = args['base-url'] || process.env.PAT_UPLOAD_BASE_URL || DEFAULT_BASE_URL
  const token = args.token || process.env.PAT_UPLOAD_TOKEN || process.env.AGENT_UPLOAD_TOKEN
  if (!token) throw new Error('Missing PAT_UPLOAD_TOKEN or --token')

  const title = args.title || inferTitle(filePath)
  const date = args.date || inferDateFromText(path.basename(filePath)) || dateFromMtime(filePath)
  const month = args.month || monthFromDate(date)
  const idempotencyKey = args['idempotency-key'] || idempotencyKeyFor(filePath, stats, type)

  const prepared = await postJson(baseUrl, token, {
    action: 'prepare',
    type,
    title,
    date,
    month,
    filename: path.basename(filePath),
    playlistName: args.playlist,
    moduleName: args.module,
    chapterName: args.chapter,
    description: args.description,
    idempotencyKey,
    dryRun: Boolean(args.dryRun),
  })

  console.log(JSON.stringify({
    target: prepared.target,
    video: prepared.video ?? null,
    reused: prepared.reused ?? false,
    uploadedAt: prepared.uploadedAt ?? null,
    dryRun: prepared.dryRun ?? false,
  }, null, 2))

  if (args.dryRun || args.prepareOnly) return

  if (prepared.uploadedAt && !args.forceUpload) {
    console.log('Already marked uploaded. Use --force-upload to upload again to the same Bunny video.')
  } else {
    await uploadTus(filePath, stats, prepared)
    const finalized = await postJson(baseUrl, token, {
      action: 'finalize',
      idempotencyKey,
      videoId: prepared.video.id,
      bunnyGuid: prepared.video.bunnyGuid,
    })
    console.log(JSON.stringify({ finalized, links: prepared.links }, null, 2))
  }

  if (pdfPath) {
    const pdf = await uploadPdf(baseUrl, token, pdfPath, prepared.video.id)
    console.log(JSON.stringify({ pdf }, null, 2))
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
