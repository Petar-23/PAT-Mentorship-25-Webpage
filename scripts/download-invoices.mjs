#!/usr/bin/env node
/**
 * Stripe invoice PDF downloader (for accounting exports).
 *
 * Typical usage (Test Mode):
 *   npm run invoices:download -- --from 2026-01-01 --to 2026-01-31 --label M26=price_... --label M25=price_...
 *
 * Notes:
 * - Uses STRIPE_SECRET_KEY from environment.
 * - Downloads PDFs via Stripe API: GET /v1/invoices/{id}/pdf (no public invoice links needed).
 * - If you pass --label mappings, invoices are grouped into subfolders by Price ID match.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import Stripe from 'stripe'

function usageAndExit(code = 0) {
  // Keep this intentionally short and copy/paste friendly.
  console.log(`
Usage:
  npm run invoices:download -- --from YYYY-MM-DD --to YYYY-MM-DD [--out exports/invoices] [--label NAME=price_...] [--label NAME=price_1,price_2] [--overwrite]

Examples:
  npm run invoices:download -- --from 2026-01-01 --to 2026-01-31 --label M26=price_1Slf4... --label M25=price_1Abc...
  npm run invoices:download -- --from 2026-01-01 --to 2026-01-31 --out exports/invoices-jan-2026 --overwrite

Required env:
  STRIPE_SECRET_KEY (sk_test_... or sk_live_...)

Tip:
  For Live invoices, run with a Live STRIPE_SECRET_KEY (do NOT commit it).
`.trim())
  process.exit(code)
}

function parseArgs(argv) {
  const flags = new Map()
  const labels = []

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]

    if (a === '--help' || a === '-h') {
      flags.set('--help', true)
      continue
    }

    if (a === '--label') {
      const v = argv[i + 1]
      if (!v || v.startsWith('--')) {
        throw new Error('Missing value for --label (expected NAME=price_...)')
      }
      labels.push(v)
      i++
      continue
    }

    if (a.startsWith('--label=')) {
      labels.push(a.slice('--label='.length))
      continue
    }

    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq !== -1) {
        flags.set(a.slice(0, eq), a.slice(eq + 1))
        continue
      }
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        flags.set(a, next)
        i++
      } else {
        flags.set(a, true)
      }
    }
  }

  return { flags, labels }
}

async function loadEnvFileIfPresent(envFilePath) {
  if (!envFilePath) return
  try {
    const text = await fs.readFile(envFilePath, 'utf8')
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const idx = line.indexOf('=')
      if (idx <= 0) continue
      const key = line.slice(0, idx).trim()
      let value = line.slice(idx + 1).trim()
      // Strip simple quotes.
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  } catch {
    // Ignore missing file.
  }
}

function parseDateToUnixSeconds(dateStr, opts) {
  // Expect YYYY-MM-DD in UTC.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!m) throw new Error(`Invalid date: ${dateStr} (expected YYYY-MM-DD)`)
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])

  const hours = opts?.endOfDay ? 23 : 0
  const minutes = opts?.endOfDay ? 59 : 0
  const seconds = opts?.endOfDay ? 59 : 0

  const d = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds))
  return Math.floor(d.getTime() / 1000)
}

function sanitizeFilename(input) {
  const s = String(input ?? '')
  // Replace characters that are problematic on macOS/Windows.
  return s
    .replace(/[\/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseLabelSpecs(labelSpecs) {
  // label spec format: NAME=price_...[,price_...]
  const result = []
  for (const spec of labelSpecs) {
    const idx = spec.indexOf('=')
    if (idx <= 0) {
      throw new Error(`Invalid --label "${spec}" (expected NAME=price_...)`)
    }
    const name = spec.slice(0, idx).trim()
    const rawIds = spec.slice(idx + 1).trim()
    const ids = rawIds
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)

    if (!name) throw new Error(`Invalid --label "${spec}" (empty name)`)
    if (ids.length === 0) throw new Error(`Invalid --label "${spec}" (no price IDs)`)
    for (const id of ids) {
      if (!id.startsWith('price_')) {
        throw new Error(
          `Invalid --label "${spec}" (only price_... IDs supported, got "${id}")`
        )
      }
    }

    result.push({ name, priceIds: new Set(ids) })
  }
  return result
}

function extractPriceIdsFromLineItems(lineItems) {
  const ids = new Set()
  for (const line of lineItems ?? []) {
    const price = line?.price
    if (!price) continue
    if (typeof price === 'string') {
      if (price.startsWith('price_')) ids.add(price)
      continue
    }
    if (typeof price?.id === 'string' && price.id.startsWith('price_')) {
      ids.add(price.id)
    }
  }
  return ids
}

async function listAllInvoices(stripe, params) {
  const data = []
  let startingAfter = undefined
  while (true) {
    const page = await stripe.invoices.list({
      limit: 100,
      created: params.created,
      starting_after: startingAfter,
    })
    data.push(...page.data)
    if (!page.has_more) break
    startingAfter = page.data[page.data.length - 1]?.id
    if (!startingAfter) break
  }
  return data
}

async function listAllInvoiceLineItems(stripe, invoiceId) {
  const all = []
  let startingAfter = undefined
  while (true) {
    const page = await stripe.invoices.listLineItems(invoiceId, {
      limit: 100,
      starting_after: startingAfter,
    })
    all.push(...page.data)
    if (!page.has_more) break
    startingAfter = page.data[page.data.length - 1]?.id
    if (!startingAfter) break
  }
  return all
}

function pickGroup(labelRules, invoicePriceIds) {
  if (!labelRules || labelRules.length === 0) return 'all'
  for (const rule of labelRules) {
    for (const id of invoicePriceIds) {
      if (rule.priceIds.has(id)) return rule.name
    }
  }
  return 'other'
}

async function downloadInvoicePdfToFile({ invoicePdfUrl, invoiceId, targetPath }) {
  if (!invoicePdfUrl || typeof invoicePdfUrl !== 'string') {
    throw new Error(
      `Invoice ${invoiceId} has no invoice_pdf URL (it might be draft/unfinalized).`
    )
  }

  // Stripe provides a hosted PDF URL (`invoice_pdf`) on the invoice object.
  // There is no API endpoint like /v1/invoices/{id}/pdf.
  const res = await fetch(invoicePdfUrl)

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `Failed to download PDF for ${invoiceId}: HTTP ${res.status} ${res.statusText} ${body}`.trim()
    )
  }

  const buf = Buffer.from(await res.arrayBuffer())
  await fs.writeFile(targetPath, buf)
}

async function main() {
  const { flags, labels } = parseArgs(process.argv.slice(2))
  if (flags.get('--help')) usageAndExit(0)

  const envFile = String(flags.get('--env-file') ?? '.env.local')
  await loadEnvFileIfPresent(envFile)

  const from = flags.get('--from')
  const to = flags.get('--to')
  if (!from || !to) {
    console.error('Error: --from and --to are required.')
    usageAndExit(1)
  }

  const outDir = String(flags.get('--out') ?? 'exports/invoices')
  const overwrite = flags.get('--overwrite') === true || flags.get('--overwrite') === 'true'

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    console.error('Error: Missing STRIPE_SECRET_KEY environment variable.')
    console.error(
      'Fix: Put STRIPE_SECRET_KEY into .env.local (Test) or pass it via environment (Live).'
    )
    process.exit(1)
  }

  const labelRules = parseLabelSpecs(labels)

  const gte = parseDateToUnixSeconds(String(from))
  const lte = parseDateToUnixSeconds(String(to), { endOfDay: true })

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-10-28.acacia',
    typescript: false,
  })

  await fs.mkdir(outDir, { recursive: true })

  console.log(`Listing invoices between ${from} and ${to}...`)
  const invoices = await listAllInvoices(stripe, { created: { gte, lte } })
  console.log(`Found ${invoices.length} invoices.`)

  const manifest = []
  let downloaded = 0
  let skipped = 0

  for (const inv of invoices) {
    // Only export finalized invoices (Stripe always has a PDF for finalized invoices).
    const status = inv.status
    if (status === 'draft' || status === 'void') {
      skipped++
      continue
    }

    let priceIds = new Set()
    if (labelRules.length > 0) {
      const lineItems = await listAllInvoiceLineItems(stripe, inv.id)
      priceIds = extractPriceIdsFromLineItems(lineItems)
    }

    const group = pickGroup(labelRules, priceIds)
    const groupDir = path.join(outDir, sanitizeFilename(group))
    await fs.mkdir(groupDir, { recursive: true })

    const createdDate = new Date((inv.created ?? 0) * 1000)
    const ymd = createdDate.toISOString().slice(0, 10)
    const invoiceNumber = sanitizeFilename(inv.number ?? inv.id)
    const customerLabel = sanitizeFilename(inv.customer_email ?? inv.customer_name ?? 'customer')

    const filename = `${ymd}_${invoiceNumber}_${customerLabel}_${inv.id}.pdf`
    const targetPath = path.join(groupDir, filename)

    try {
      if (!overwrite) {
        try {
          await fs.access(targetPath)
          // File exists -> skip
          skipped++
          continue
        } catch {
          // ok
        }
      }

      // Prefer the PDF URL from the list call; if it's missing, retrieve the invoice once.
      let invoicePdfUrl = inv.invoice_pdf
      if (!invoicePdfUrl) {
        const fresh = await stripe.invoices.retrieve(inv.id)
        invoicePdfUrl = fresh.invoice_pdf
      }

      await downloadInvoicePdfToFile({
        invoiceId: inv.id,
        invoicePdfUrl,
        targetPath,
      })

      downloaded++
      manifest.push({
        invoiceId: inv.id,
        number: inv.number ?? null,
        created: inv.created ?? null,
        status: inv.status ?? null,
        currency: inv.currency ?? null,
        total: inv.total ?? null,
        customer_email: inv.customer_email ?? null,
        customer_name: inv.customer_name ?? null,
        group,
        file: path.relative(process.cwd(), targetPath),
      })
      console.log(`Downloaded ${inv.id} → ${path.relative(process.cwd(), targetPath)}`)
    } catch (err) {
      console.error(`Failed ${inv.id}:`, err)
      skipped++
    }
  }

  const manifestPath = path.join(outDir, 'manifest.json')
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')

  console.log('---')
  console.log(`Done. Downloaded: ${downloaded}, skipped: ${skipped}`)
  console.log(`Output: ${path.resolve(outDir)}`)
  console.log(`Manifest: ${path.resolve(manifestPath)}`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})


