import 'server-only'

import { stripe } from '@/lib/stripe'
import type Stripe from 'stripe'

export type MentorshipEventType = 'signup' | 'churn' | 'cancel_scheduled'

export type MentorshipEvent = {
  at: string
  type: MentorshipEventType
  productId: string
  productName: string
  customerId: string | null
  email: string | null
  country: string | null
  subscriptionId: string
}

export type ProductMetrics = {
  productId: string
  productName: string
  activeOrTrialing: number
  paying: number
  trialing: number
  cancelScheduled: number
  churned: number
  expectedMonthlyGross: number
  expectedMonthlyNet: number
  expectedYearlyGross: number
  expectedYearlyNet: number
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

export type MonthPoint = {
  month: string
  signups: number
  churns: number
  gross: number
  net: number
}

export type OwnerMetricsResponse = {
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

type ProductAgg = {
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
  periodGross: number
  periodNet: number
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

const TAX_RATES_BY_COUNTRY: Record<string, number> = {
  DE: 0.19,
  AT: 0.2,
  CH: 0,
}

const STRIPE_FALLBACK_LINE_ITEM_CONCURRENCY = 4
const STRIPE_PRICE_PREFETCH_CONCURRENCY = 6

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []

  const limit = Math.max(1, Math.min(concurrency, items.length))
  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index]!, index)
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()))
  return results
}

function getTaxRate(country: string | null | undefined): number {
  if (!country) return 0
  return TAX_RATES_BY_COUNTRY[country.toUpperCase()] ?? 0
}

function normalizeTaxBehavior(params: {
  taxBehavior: Stripe.Price.TaxBehavior | null
  currency: string | null | undefined
}): 'inclusive' | 'exclusive' {
  if (params.taxBehavior === 'inclusive' || params.taxBehavior === 'exclusive') {
    return params.taxBehavior
  }

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
} {
  if (!price || typeof price === 'string') {
    return { productId: null, productName: null }
  }

  const product = price.product
  const productId = typeof product === 'string' ? product : product?.id ?? null
  const productName =
    typeof product === 'string'
      ? null
      : product && 'name' in product
        ? (product.name as string)
        : null

  return { productId, productName }
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

function createEmptyProductAgg(params: {
  productId: string
  productName: string
  productActive: boolean | null
}): ProductAgg {
  return {
    productId: params.productId,
    productName: params.productName,
    productActive: params.productActive,
    activeOrTrialing: 0,
    paying: 0,
    trialing: 0,
    cancelScheduled: 0,
    churned: 0,
    expectedMonthlyGross: 0,
    expectedMonthlyNet: 0,
    periodGross: 0,
    periodNet: 0,
    country: new Map(),
  }
}

export function getDefaultOwnerMetricsRange(now = new Date()): { from: string; to: string } {
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
  return {
    from: defaultFrom.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  }
}

export async function getOwnerMetrics(params: {
  from?: string | null
  to?: string | null
} = {}): Promise<OwnerMetricsResponse> {
  const now = new Date()
  const defaults = getDefaultOwnerMetricsRange(now)
  const fromParam = params.from ?? null
  const toParam = params.to ?? null
  const fromDate = fromParam ? new Date(`${fromParam}T00:00:00.000Z`) : new Date(`${defaults.from}T00:00:00.000Z`)
  const toDate = toParam ? new Date(`${toParam}T23:59:59.999Z`) : now

  if (!Number.isFinite(fromDate.getTime()) || !Number.isFinite(toDate.getTime())) {
    throw new Error('Invalid from/to date')
  }

  const gte = parseYmdToUnixSeconds(fromParam ?? defaults.from)
  const lte = parseYmdToUnixSeconds(toParam ?? defaults.to, { endOfDay: true })

  const [subscriptions, invoices] = await Promise.all([
    listAllSubscriptions(),
    listAllInvoices({ gte, lte }),
  ])

  const productNameCache = new Map<string, string>()
  const productActiveCache = new Map<string, boolean | null>()
  const priceCache = new Map<string, Stripe.Price>()
  const subscriptionToProduct = new Map<string, { productId: string; productName: string }>()

  async function getProductInfo(productId: string): Promise<{ name: string; active: boolean | null }> {
    if (productNameCache.has(productId) && productActiveCache.has(productId)) {
      return {
        name: productNameCache.get(productId) ?? productId,
        active: productActiveCache.get(productId) ?? null,
      }
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
    priceCache.set(priceId, price)
    return price
  }

  const subscriptionPriceIds = Array.from(
    new Set(subscriptions.map((sub) => getPriceId(sub.items?.data?.[0]?.price)).filter(Boolean))
  ) as string[]
  await mapWithConcurrency(
    subscriptionPriceIds,
    STRIPE_PRICE_PREFETCH_CONCURRENCY,
    async (priceId) => {
      await getPriceWithProduct(priceId)
    }
  )

  const months = buildMonthRange(fromDate, toDate)
  const monthSet = new Set(months)
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

  const productAgg = new Map<string, ProductAgg>()
  const events: MentorshipEvent[] = []
  const upcomingCancellations: OwnerMetricsResponse['upcomingCancellations'] = []
  const nowMs = Date.now()

  for (const sub of subscriptions) {
    const item = sub.items?.data?.[0]
    const priceId = getPriceId(item?.price)
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
      productName =
        'name' in product && typeof product.name === 'string' && product.name.length > 0
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
    const endedAtUnix = sub.ended_at ?? sub.canceled_at ?? null
    const isChurned = status === 'canceled' || endedAtUnix != null
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
      agg = createEmptyProductAgg({ productId, productName, productActive })
      productAgg.set(productId, agg)
    } else {
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

    const createdAt = new Date(sub.created * 1000)
    const createdMonth = formatMonth(createdAt)
    if (monthSet.has(createdMonth)) {
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
      if (monthSet.has(endedMonth)) {
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

    if (isCurrent && cancelScheduled && cancelEffectiveUnix != null) {
      const cancelAt = new Date(cancelEffectiveUnix * 1000)
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

  const invoicesNeedingLineItems = invoices.filter((inv) => {
    const subscriptionId = typeof inv.subscription === 'string' ? inv.subscription : null
    return !subscriptionId || !subscriptionToProduct.has(subscriptionId)
  })
  const invoiceFallbackProductById = new Map<string, { productId: string; productName: string | null }>()

  await mapWithConcurrency(
    invoicesNeedingLineItems,
    STRIPE_FALLBACK_LINE_ITEM_CONCURRENCY,
    async (inv) => {
      const lineItems = await listAllInvoiceLineItems(inv.id)
      const firstWithPrice = lineItems.find((l) => l.price != null)
      const priceInfo = getProductFromPrice(firstWithPrice?.price as any)
      if (priceInfo.productId) {
        invoiceFallbackProductById.set(inv.id, {
          productId: priceInfo.productId,
          productName: priceInfo.productName,
        })
      }
    }
  )

  for (const inv of invoices) {
    const invoiceCreated = new Date((inv.created ?? 0) * 1000)
    const month = formatMonth(invoiceCreated)
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

    if (!productId) {
      const fallbackProduct = invoiceFallbackProductById.get(inv.id)
      if (!fallbackProduct) continue
      productId = fallbackProduct.productId
      productName = fallbackProduct.productName ?? productNameCache.get(productId) ?? productId
    }

    const info = await getProductInfo(productId)
    const resolvedName = productName ?? info.name
    productNameCache.set(productId, resolvedName)

    let agg = productAgg.get(productId)
    if (!agg) {
      agg = createEmptyProductAgg({
        productId,
        productName: resolvedName,
        productActive: info.active,
      })
      productAgg.set(productId, agg)
    } else if (agg.productName === agg.productId && resolvedName !== agg.productId) {
      agg.productName = resolvedName
      if (agg.productActive == null && info.active != null) {
        agg.productActive = info.active
      }
    }

    if (monthSet.has(month)) {
      const point = ensureTimeline(productId, resolvedName).points.get(month)
      if (point) {
        point.gross += toEur(inv.total)
        point.net += pickRevenueNet(inv)
      }
    }

    agg.periodGross += toEur(inv.total)
    agg.periodNet += pickRevenueNet(inv)
  }

  const products: ProductMetrics[] = Array.from(productAgg.values())
    .map((p) => {
      const countryBreakdown = Array.from(p.country.values()).sort((a, b) =>
        a.country.localeCompare(b.country)
      )

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
        periodGross: p.periodGross,
        periodNet: p.periodNet,
        countryBreakdown,
      }
    })
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

  return {
    period: {
      from: fromDate.toISOString().slice(0, 10),
      to: toDate.toISOString().slice(0, 10),
    },
    products,
    timeline,
    recentEvents: events
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 200),
    upcomingCancellations: upcomingCancellations
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
      .slice(0, 200),
  }
}
