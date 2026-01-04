import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { stripe } from '@/lib/stripe'
import type Stripe from 'stripe'

const MAX_INVOICES_PER_EXPORT = 50

function parseYmdToUnixSeconds(ymd: string, opts?: { endOfDay?: boolean }): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) throw new Error(`Invalid date: ${ymd} (expected YYYY-MM-DD)`)
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const h = opts?.endOfDay ? 23 : 0
  const min = opts?.endOfDay ? 59 : 0
  const sec = opts?.endOfDay ? 59 : 0
  return Math.floor(Date.UTC(year, month - 1, day, h, min, sec) / 1000)
}

function sanitizeFilename(input: string): string {
  return input
    .replace(/[\/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
}

async function listAllInvoices(params: { gte: number; lte: number }): Promise<Stripe.Invoice[]> {
  const out: Stripe.Invoice[] = []
  let startingAfter: string | undefined

  while (true) {
    const page = await stripe.invoices.list({
      limit: 100,
      status: 'paid',
      created: { gte: params.gte, lte: params.lte },
      starting_after: startingAfter,
    })
    out.push(...page.data)
    if (!page.has_more) break
    startingAfter = page.data[page.data.length - 1]?.id
    if (!startingAfter) break
  }

  return out
}

async function listAllInvoiceLineItems(invoiceId: string): Promise<Stripe.InvoiceLineItem[]> {
  const out: Stripe.InvoiceLineItem[] = []
  let startingAfter: string | undefined

  while (true) {
    const page = await stripe.invoices.listLineItems(invoiceId, {
      limit: 100,
      starting_after: startingAfter,
    })
    out.push(...page.data)
    if (!page.has_more) break
    startingAfter = page.data[page.data.length - 1]?.id
    if (!startingAfter) break
  }

  return out
}

function extractProductIdsFromLineItems(lineItems: Stripe.InvoiceLineItem[]): Set<string> {
  const ids = new Set<string>()
  for (const line of lineItems) {
    const price = line.price
    if (!price || typeof price === 'string') continue
    const product = price.product
    if (typeof product === 'string') {
      ids.add(product)
    } else if (product?.id) {
      ids.add(product.id)
    }
  }
  return ids
}

async function downloadPdf(url: string): Promise<Uint8Array> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`PDF download failed: ${res.status} ${res.statusText} ${body}`.trim())
  }
  const buf = await res.arrayBuffer()
  return new Uint8Array(buf)
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = await clerkClient()
    const memberships = await client.users.getOrganizationMembershipList({
      userId,
      limit: 100,
    })
    const isAdmin = memberships.data.some((m) => m.role === 'org:admin')
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(req.url)
    const from = url.searchParams.get('from') // YYYY-MM-DD
    const to = url.searchParams.get('to') // YYYY-MM-DD
    const productIds = url.searchParams.getAll('productId').filter(Boolean)

    if (!from || !to) {
      return NextResponse.json({ error: 'Missing from/to (YYYY-MM-DD)' }, { status: 400 })
    }

    const gte = parseYmdToUnixSeconds(from)
    const lte = parseYmdToUnixSeconds(to, { endOfDay: true })

    const invoices = await listAllInvoices({ gte, lte })

    if (invoices.length === 0) {
      return NextResponse.json({ error: 'Keine Rechnungen im Zeitraum gefunden.' }, { status: 404 })
    }

    // Filter invoices by productId if requested
    const selected: Stripe.Invoice[] = []

    for (const inv of invoices) {
      if (productIds.length === 0) {
        selected.push(inv)
        continue
      }

      const lineItems = await listAllInvoiceLineItems(inv.id)
      const ids = extractProductIdsFromLineItems(lineItems)
      const matches = productIds.some((pid) => ids.has(pid))
      if (matches) selected.push(inv)
    }

    if (selected.length === 0) {
      return NextResponse.json(
        { error: 'Keine Rechnungen für die gewählten Mentorship-Produkte gefunden.' },
        { status: 404 }
      )
    }

    if (selected.length > MAX_INVOICES_PER_EXPORT) {
      return NextResponse.json(
        {
          error: `Zu viele Rechnungen (${selected.length}). Bitte Zeitraum einschränken (max. ${MAX_INVOICES_PER_EXPORT}) oder das lokale Export-Script nutzen.`,
        },
        { status: 413 }
      )
    }

    const zip = new JSZip()

    for (const inv of selected) {
      const full =
        inv.invoice_pdf != null ? inv : await stripe.invoices.retrieve(inv.id)
      const pdfUrl = full.invoice_pdf
      if (!pdfUrl) continue

      const createdDate = new Date((inv.created ?? 0) * 1000).toISOString().slice(0, 10)
      const invoiceNumber = sanitizeFilename(inv.number ?? inv.id)
      const email = sanitizeFilename(inv.customer_email ?? inv.customer_name ?? 'customer')

      const filename = `${createdDate}_${invoiceNumber}_${email}_${inv.id}.pdf`
      const bytes = await downloadPdf(pdfUrl)
      zip.file(filename, bytes)
    }

    const zipBytes = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })

    const exportName =
      productIds.length > 0 ? 'invoices_by_mentorship' : 'invoices_all'
    const outName = `${exportName}_${from}_${to}.zip`

    return new Response(zipBytes, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${outName}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('Error in owner/invoices export route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


