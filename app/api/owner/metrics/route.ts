import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import type Stripe from 'stripe'

type MentorshipEventType = 'signup' | 'churn' | 'cancel_scheduled'

type MentorshipEvent = {
  at: string
  type: MentorshipEventType
  productId: string
  productName: string
  customerId: string | null
  email: string | null
  country: string | null
  subscriptionId: string
}

type ProductMetrics = {
  productId: string
  productName: string

  // Subscribers
  activeOrTrialing: number
  paying: number
  trialing: number
  cancelScheduled: number
  churned: number

  // Expected revenue (based on current active/trialing subs)
  expectedMonthlyGross: number
  expectedMonthlyNet: number
  expectedYearlyGross: number
  expectedYearlyNet: number

  // Actual revenue in selected period (based on invoices)
  periodGross: number
  periodNet: number

  countryBreakdown: Array<{
    country: string
    activeOrTrialing: number
    paying: number
    expectedMonthlyGross: number
    expectedMonthlyNet: number
  }>
}

type MonthPoint = {
  month: string // YYYY-MM
  signups: number
  churns: number
  gross: number
  net: number
}

type ApiResponse = {
  period: { from: string; to: string }
  products: ProductMetrics[]
  timeline: Array<{
    productId: string
    productName: string
    points: MonthPoint[]
  }>
  recentEvents: MentorshipEvent[]
  upcomingCancellations: Array<{
    at: string
    productId: string
    productName: string
    email: string | null
    country: string | null
    subscriptionId: string
  }>
}

const TAX_RATES_BY_COUNTRY: Record<string, number> = {
  DE: 0.19,
  AT: 0.2,
  CH: 0,
}

function getTaxRate(country: string | null | undefined): number {
  if (!country) return 0
  const code = country.toUpperCase()
  return TAX_RATES_BY_COUNTRY[code] ?? 0
}

function normalizeTaxBehavior(params: {
  taxBehavior: Stripe.Price.TaxBehavior | null
  currency: string | null | undefined
}): 'inclusive' | 'exclusive' {
  if (params.taxBehavior === 'inclusive' || params.taxBehavior === 'exclusive') {
    return params.taxBehavior
  }

  // Stripe kann `tax_behavior` auch als "unspecified" zurückgeben.
  // In eurem Setup ist die Steuer bei allen Währungen außer USD/CAD im angezeigten Preis enthalten.
  // Deshalb behandeln wir "unspecified" wie "inclusive" (außer USD/CAD).
  const cur = (params.currency ?? '').toUpperCase()
  if (cur === 'USD' || cur === 'CAD') return 'exclusive'
  return 'inclusive'
}

function toEur(amountInCents: number | null | undefined): number {
  return (amountInCents ?? 0) / 100
}

function formatMonth(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

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

function buildMonthRange(from: Date, to: Date): string[] {
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1))
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1))
  const months: string[] = []
  let cursor = start
  while (cursor <= end) {
    months.push(formatMonth(cursor))
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  }
  return months
}

function getPriceId(price: Stripe.Price | string | null | undefined): string | null {
  if (!price) return null
  if (typeof price === 'string') return price
  return price.id ?? null
}

async function listAllSubscriptions(): Promise<Stripe.Subscription[]> {
  const out: Stripe.Subscription[] = []
  let startingAfter: string | undefined

  while (true) {
    const page = await stripe.subscriptions.list({
      limit: 100,
      status: 'all',
      starting_after: startingAfter,
      // Stripe erlaubt max. 4 Expand-Level – deshalb nur bis zur Price expanden (nicht bis product).
      expand: ['data.customer', 'data.items.data.price'],
    })

    out.push(...page.data)
    if (!page.has_more) break
    startingAfter = page.data[page.data.length - 1]?.id
    if (!startingAfter) break
  }

  return out
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

function getCustomerCountry(customer: Stripe.Customer | Stripe.DeletedCustomer | string | null): string | null {
  if (!customer || typeof customer === 'string') return null
  if ('deleted' in customer && customer.deleted) return null
  return customer.address?.country ?? null
}

function getCustomerEmail(customer: Stripe.Customer | Stripe.DeletedCustomer | string | null): string | null {
  if (!customer || typeof customer === 'string') return null
  if ('deleted' in customer && customer.deleted) return null
  return customer.email ?? null
}

function getProductFromPrice(price: Stripe.Price | string | null | undefined): {
  productId: string | null
  productName: string | null
  taxBehavior: Stripe.Price.TaxBehavior | null
  unitAmount: number | null
} {
  if (!price || typeof price === 'string') {
    return { productId: null, productName: null, taxBehavior: null, unitAmount: null }
  }

  const product = price.product
  const productId = typeof product === 'string' ? product : product?.id ?? null
  const productName =
    typeof product === 'string'
      ? null
      : product && 'name' in product
        ? (product.name as string)
        : null

  return {
    productId,
    productName,
    taxBehavior: price.tax_behavior ?? null,
    unitAmount: price.unit_amount ?? null,
  }
}

function computeExpectedMonthly(params: {
  unitAmount: number
  taxBehavior: Stripe.Price.TaxBehavior | null
  taxRate: number
  currency: string | null | undefined
}): { gross: number; net: number } {
  const amount = params.unitAmount / 100
  const rate = params.taxRate

  const taxBehavior = normalizeTaxBehavior({
    taxBehavior: params.taxBehavior,
    currency: params.currency,
  })

  if (taxBehavior === 'inclusive') {
    const gross = amount
    const net = rate > 0 ? gross / (1 + rate) : gross
    return { gross, net }
  }

  // exclusive
  const net = amount
  const gross = net * (1 + rate)
  return { gross, net }
}

function pickRevenueNet(inv: Stripe.Invoice): number {
  if (inv.total_excluding_tax != null) return toEur(inv.total_excluding_tax)
  if (inv.subtotal_excluding_tax != null) return toEur(inv.subtotal_excluding_tax)
  if (inv.tax != null) return toEur((inv.total ?? 0) - inv.tax)
  return toEur(inv.total)
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
    const fromParam = url.searchParams.get('from') // YYYY-MM-DD
    const toParam = url.searchParams.get('to') // YYYY-MM-DD

    const now = new Date()
    const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)) // Jan 1 UTC
    const fromDate = fromParam ? new Date(`${fromParam}T00:00:00.000Z`) : defaultFrom
    const toDate = toParam ? new Date(`${toParam}T23:59:59.999Z`) : now

    if (!Number.isFinite(fromDate.getTime()) || !Number.isFinite(toDate.getTime())) {
      return NextResponse.json({ error: 'Invalid from/to date' }, { status: 400 })
    }

    const gte = parseYmdToUnixSeconds(
      fromParam ?? fromDate.toISOString().slice(0, 10)
    )
    const lte = parseYmdToUnixSeconds(toParam ?? toDate.toISOString().slice(0, 10), {
      endOfDay: true,
    })

    const [subscriptions, invoices] = await Promise.all([
      listAllSubscriptions(),
      listAllInvoices({ gte, lte }),
    ])

    const productNameCache = new Map<string, string>()
    const productActiveCache = new Map<string, boolean | null>()
    const priceCache = new Map<string, Stripe.Price>()
    const subscriptionToProduct = new Map<string, { productId: string; productName: string }>()

    async function getProductInfo(
      productId: string
    ): Promise<{ name: string; active: boolean | null }> {
      const cachedName = productNameCache.get(productId)
      const cachedActive = productActiveCache.get(productId)
      if (cachedName && cachedActive != null) {
        return { name: cachedName, active: cachedActive }
      }

      try {
        const product = await stripe.products.retrieve(productId)
        if (typeof product === 'string') {
          productNameCache.set(productId, productId)
          productActiveCache.set(productId, null)
          return { name: productId, active: null }
        }
        if ('deleted' in product && product.deleted) {
          productNameCache.set(productId, productId)
          productActiveCache.set(productId, false)
          return { name: productId, active: false }
        }

        const name = product.name || productId
        const active = typeof product.active === 'boolean' ? product.active : null
        productNameCache.set(productId, name)
        productActiveCache.set(productId, active)
        return { name, active }
      } catch (err) {
        console.warn('Failed to retrieve Stripe product:', productId, err)
        productNameCache.set(productId, productId)
        productActiveCache.set(productId, null)
        return { name: productId, active: null }
      }
    }

    async function getPriceWithProduct(priceId: string): Promise<Stripe.Price> {
      const cached = priceCache.get(priceId)
      if (cached) return cached

      const price = await stripe.prices.retrieve(priceId, { expand: ['product'] })
      // Stripe kann theoretisch auch "deleted" zurückgeben; wir speichern trotzdem.
      priceCache.set(priceId, price)
      return price
    }

    // Prepare month range for timeline (based on requested period)
    const months = buildMonthRange(fromDate, toDate)
    const timelineByProduct = new Map<
      string,
      { productId: string; productName: string; points: Map<string, MonthPoint> }
    >()

    function ensureTimeline(productId: string, productName: string) {
      const existing = timelineByProduct.get(productId)
      if (existing) return existing

      const points = new Map<string, MonthPoint>()
      for (const m of months) {
        points.set(m, { month: m, signups: 0, churns: 0, gross: 0, net: 0 })
      }
      const entry = { productId, productName, points }
      timelineByProduct.set(productId, entry)
      return entry
    }

    // Aggregate subscription-based metrics
    const productAgg = new Map<
      string,
      {
        productId: string
        productName: string
        productActive: boolean | null
        activeOrTrialing: number
        paying: number
        trialing: number
        cancelScheduled: number
        churned: number
        expectedMonthlyGross: number
        expectedMonthlyNet: number
        country: Map<
          string,
          {
            country: string
            activeOrTrialing: number
            paying: number
            expectedMonthlyGross: number
            expectedMonthlyNet: number
          }
        >
      }
    >()

    const events: MentorshipEvent[] = []
    const upcomingCancellations: ApiResponse['upcomingCancellations'] = []
    const nowMs = Date.now()

    for (const sub of subscriptions) {
      const item = sub.items?.data?.[0]
      const rawPrice = item?.price
      const priceId = getPriceId(rawPrice)
      if (!priceId) continue

      const fullPrice = await getPriceWithProduct(priceId)
      const priceTaxBehavior = fullPrice.tax_behavior ?? null
      const priceUnitAmount = fullPrice.unit_amount ?? null

      const product = fullPrice.product
      const productId = typeof product === 'string' ? product : product?.id ?? null
      if (!productId) continue

      let productName: string
      let productActive: boolean | null = null
      if (typeof product === 'string') {
        const info = await getProductInfo(productId)
        productName = info.name
        productActive = info.active
      } else {
        productName = 'name' in product && typeof product.name === 'string' && product.name.length > 0
          ? product.name
          : productId
        productActive = 'active' in product && typeof product.active === 'boolean' ? product.active : null
        productNameCache.set(productId, productName)
        productActiveCache.set(productId, productActive)
      }

      subscriptionToProduct.set(sub.id, { productId, productName })

      const status = sub.status
      const isTrialing = status === 'trialing'
      const isPaying = status === 'active'
      const isActiveOrTrialing = isPaying || isTrialing

      // Treat as churned if Stripe already ended it.
      const endedAtUnix = sub.ended_at ?? sub.canceled_at ?? null
      const isChurned = status === 'canceled' || endedAtUnix != null

      // Consider it "active" only while current period end is in the future (if present).
      const periodStillActive =
        sub.current_period_end != null ? sub.current_period_end * 1000 > nowMs : true

      const isCurrent = isActiveOrTrialing && periodStillActive
      const cancelScheduled = Boolean(sub.cancel_at_period_end) || sub.cancel_at != null
      const cancelEffectiveUnix = sub.cancel_at ?? sub.current_period_end ?? null

      const customerCountry = getCustomerCountry(sub.customer as any)
      const customerEmail = getCustomerEmail(sub.customer as any)
      const customerId =
        typeof sub.customer === 'string'
          ? sub.customer
          : sub.customer && 'id' in sub.customer
            ? sub.customer.id
            : null

      let agg = productAgg.get(productId)
      if (!agg) {
        agg = {
          productId,
          productName,
          productActive,
          activeOrTrialing: 0,
          paying: 0,
          trialing: 0,
          cancelScheduled: 0,
          churned: 0,
          expectedMonthlyGross: 0,
          expectedMonthlyNet: 0,
          country: new Map(),
        }
        productAgg.set(productId, agg)
      } else {
        // Falls wir später mehr Infos bekommen, aktualisieren wir Name/Active.
        if (agg.productName === agg.productId && productName !== agg.productId) {
          agg.productName = productName
        }
        if (agg.productActive == null && productActive != null) {
          agg.productActive = productActive
        }
      }

      if (isCurrent) {
        agg.activeOrTrialing += 1
        if (isPaying) agg.paying += 1
        if (isTrialing) agg.trialing += 1
        if (cancelScheduled) agg.cancelScheduled += 1

        const rate = getTaxRate(customerCountry)
        if (priceUnitAmount != null) {
          const expected = computeExpectedMonthly({
            unitAmount: priceUnitAmount,
            taxBehavior: priceTaxBehavior,
            taxRate: rate,
            currency: fullPrice.currency,
          })
          agg.expectedMonthlyGross += expected.gross
          agg.expectedMonthlyNet += expected.net

          const countryKey = (customerCountry ?? '—').toUpperCase()
          const c =
            agg.country.get(countryKey) ??
            {
              country: countryKey,
              activeOrTrialing: 0,
              paying: 0,
              expectedMonthlyGross: 0,
              expectedMonthlyNet: 0,
            }
          c.activeOrTrialing += 1
          if (isPaying) c.paying += 1
          c.expectedMonthlyGross += expected.gross
          c.expectedMonthlyNet += expected.net
          agg.country.set(countryKey, c)
        }
      }

      if (isChurned) {
        agg.churned += 1
      }

      // Timeline + events
      const createdAt = new Date(sub.created * 1000)
      const createdMonth = formatMonth(createdAt)
      if (months.includes(createdMonth)) {
        ensureTimeline(productId, productName).points.get(createdMonth)!.signups += 1
        events.push({
          at: createdAt.toISOString(),
          type: 'signup',
          productId,
          productName,
          customerId,
          email: customerEmail,
          country: customerCountry,
          subscriptionId: sub.id,
        })
      }

      if (endedAtUnix != null) {
        const endedAt = new Date(endedAtUnix * 1000)
        const endedMonth = formatMonth(endedAt)
        if (months.includes(endedMonth)) {
          ensureTimeline(productId, productName).points.get(endedMonth)!.churns += 1
          events.push({
            at: endedAt.toISOString(),
            type: 'churn',
            productId,
            productName,
            customerId,
            email: customerEmail,
            country: customerCountry,
            subscriptionId: sub.id,
          })
        }
      }

      // Upcoming cancellations (optisch nachvollziehbar)
      if (isCurrent && cancelScheduled && cancelEffectiveUnix != null) {
        const cancelAt = new Date(cancelEffectiveUnix * 1000)
        // Nur zukünftige/aktuelle Kündigungen in einer eigenen Liste (max. Übersicht)
        if (cancelAt.getTime() >= nowMs) {
          upcomingCancellations.push({
            at: cancelAt.toISOString(),
            productId,
            productName,
            email: customerEmail,
            country: customerCountry,
            subscriptionId: sub.id,
          })
        }
      }
    }

    // Aggregate invoice-based revenue into products + timeline
    for (const inv of invoices) {
      const invoiceCreated = new Date((inv.created ?? 0) * 1000)
      const month = formatMonth(invoiceCreated)

      // Prefer mapping via subscription (viel schneller als pro Invoice die LineItems zu laden).
      let productId: string | null = null
      let productName: string | null = null

      const subscriptionId = typeof inv.subscription === 'string' ? inv.subscription : null
      if (subscriptionId) {
        const mapped = subscriptionToProduct.get(subscriptionId)
        if (mapped) {
          productId = mapped.productId
          productName = mapped.productName
        }
      }

      // Fallback: Determine product via first line item price (für non-subscription invoices)
      if (!productId) {
        const lineItems = await listAllInvoiceLineItems(inv.id)
        const firstWithPrice = lineItems.find((l) => l.price != null)
        const priceInfo = getProductFromPrice(firstWithPrice?.price as any)
        if (!priceInfo.productId) continue
        productId = priceInfo.productId
        productName = priceInfo.productName ?? productNameCache.get(productId) ?? productId
      }

      if (!productId) continue
      const info = await getProductInfo(productId)
      const resolvedName = productName ?? info.name
      productNameCache.set(productId, resolvedName)

      // Ensure aggregator exists even if there are no current subs
      let agg = productAgg.get(productId)
      if (!agg) {
        agg = {
          productId,
          productName: resolvedName,
          productActive: info.active,
          activeOrTrialing: 0,
          paying: 0,
          trialing: 0,
          cancelScheduled: 0,
          churned: 0,
          expectedMonthlyGross: 0,
          expectedMonthlyNet: 0,
          country: new Map(),
        }
        productAgg.set(productId, agg)
      } else if (agg.productName === agg.productId && resolvedName !== agg.productId) {
        // falls zuvor nur die ID als Name drin stand, aktualisieren wir für UI.
        agg.productName = resolvedName
        if (agg.productActive == null && info.active != null) {
          agg.productActive = info.active
        }
      }

      // Revenue (period totals will be attached later in ProductMetrics)
      // Timeline revenue buckets
      if (months.includes(month)) {
        const point = ensureTimeline(productId, resolvedName).points.get(month)
        if (point) {
          point.gross += toEur(inv.total)
          point.net += pickRevenueNet(inv)
        }
      }

      // Store period revenue temporarily on a map (sum over invoices)
      ;(agg as any).__periodGross = ((agg as any).__periodGross ?? 0) + toEur(inv.total)
      ;(agg as any).__periodNet = ((agg as any).__periodNet ?? 0) + pickRevenueNet(inv)
    }

    // Build final arrays
    const products: ProductMetrics[] = Array.from(productAgg.values())
      .map((p) => {
        const countryBreakdown = Array.from(p.country.values()).sort((a, b) =>
          a.country.localeCompare(b.country)
        )
        const periodGross = Number((p as any).__periodGross ?? 0)
        const periodNet = Number((p as any).__periodNet ?? 0)

        return {
          productId: p.productId,
          productName: p.productName,
          activeOrTrialing: p.activeOrTrialing,
          paying: p.paying,
          trialing: p.trialing,
          cancelScheduled: p.cancelScheduled,
          churned: p.churned,
          expectedMonthlyGross: p.expectedMonthlyGross,
          expectedMonthlyNet: p.expectedMonthlyNet,
          expectedYearlyGross: p.expectedMonthlyGross * 12,
          expectedYearlyNet: p.expectedMonthlyNet * 12,
          periodGross,
          periodNet,
          countryBreakdown,
        }
      })
      // UX: keine toten/archivierten Alt-Produkte anzeigen (Dropdown & Export bleiben sauber)
      .filter((p) => {
        const agg = productAgg.get(p.productId)
        const isArchived = agg?.productActive === false
        const hasRelevance = p.activeOrTrialing > 0 || p.periodGross > 0 || p.cancelScheduled > 0
        return !isArchived && hasRelevance
      })
      .sort((a, b) => b.activeOrTrialing - a.activeOrTrialing)

    const timeline = Array.from(timelineByProduct.values())
      .map((t) => ({
        productId: t.productId,
        productName: t.productName,
        points: months.map((m) => t.points.get(m)!).filter(Boolean),
      }))
      .sort((a, b) => a.productName.localeCompare(b.productName))

    const recentEvents = events
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 200)

    const res = NextResponse.json({
      period: {
        from: fromDate.toISOString().slice(0, 10),
        to: toDate.toISOString().slice(0, 10),
      },
      products,
      timeline,
      recentEvents,
      upcomingCancellations: upcomingCancellations
        .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
        .slice(0, 200),
    } satisfies ApiResponse)

    res.headers.set('Cache-Control', 'no-store, max-age=0')
    return res
  } catch (error) {
    console.error('Error in owner/metrics route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


