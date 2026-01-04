'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { AlertCircle, Download, RefreshCw } from 'lucide-react'

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
  timeline: Array<{ productId: string; productName: string; points: MonthPoint[] }>
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

function todayYmd() {
  return new Date().toISOString().slice(0, 10)
}

function startOfYearYmd() {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
  return d.toISOString().slice(0, 10)
}

function formatEur(value: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export default function AdminDashboardV2() {
  const [from, setFrom] = useState(startOfYearYmd())
  const [to, setTo] = useState(todayYmd())
  const [metrics, setMetrics] = useState<ApiResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedProductId, setSelectedProductId] = useState<string>('__all__')

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportProductIds, setExportProductIds] = useState<string[]>([])

  const load = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const qs = new URLSearchParams({ from, to })
      const res = await fetch(`/api/owner/metrics?${qs.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || `Fehler beim Laden (${res.status})`)
      }
      const data = (await res.json()) as ApiResponse
      setMetrics(data)

      // Wenn wir noch keine Auswahl haben, selecte "alle" und preselecte alle Produkte für Export.
      setExportProductIds((prev) => (prev.length > 0 ? prev : data.products.map((p) => p.productId)))
    } catch (e) {
      setMetrics(null)
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const products = useMemo(() => metrics?.products ?? [], [metrics])

  const productOptions = useMemo(() => {
    return [
      { id: '__all__', name: 'Alle Mentorships' },
      ...products.map((p) => ({ id: p.productId, name: p.productName })),
    ]
  }, [products])

  const filteredProducts = useMemo(() => {
    if (!metrics) return []
    if (selectedProductId === '__all__') return metrics.products
    return metrics.products.filter((p) => p.productId === selectedProductId)
  }, [metrics, selectedProductId])

  const totals = useMemo(() => {
    const list = filteredProducts
    return {
      activeOrTrialing: list.reduce((s, p) => s + p.activeOrTrialing, 0),
      paying: list.reduce((s, p) => s + p.paying, 0),
      trialing: list.reduce((s, p) => s + p.trialing, 0),
      cancelScheduled: list.reduce((s, p) => s + p.cancelScheduled, 0),
      periodGross: list.reduce((s, p) => s + p.periodGross, 0),
      periodNet: list.reduce((s, p) => s + p.periodNet, 0),
      expectedMonthlyGross: list.reduce((s, p) => s + p.expectedMonthlyGross, 0),
      expectedMonthlyNet: list.reduce((s, p) => s + p.expectedMonthlyNet, 0),
      expectedYearlyGross: list.reduce((s, p) => s + p.expectedYearlyGross, 0),
      expectedYearlyNet: list.reduce((s, p) => s + p.expectedYearlyNet, 0),
    }
  }, [filteredProducts])

  const selectedTimeline = useMemo(() => {
    if (!metrics) return null
    const list = metrics.timeline
    if (selectedProductId === '__all__') return null
    return list.find((t) => t.productId === selectedProductId) ?? null
  }, [metrics, selectedProductId])

  const filteredEvents = useMemo(() => {
    if (!metrics) return []
    const ev = metrics.recentEvents
    if (selectedProductId === '__all__') return ev
    return ev.filter((e) => e.productId === selectedProductId)
  }, [metrics, selectedProductId])

  const filteredUpcomingCancels = useMemo(() => {
    if (!metrics) return []
    const ev = metrics.upcomingCancellations
    if (selectedProductId === '__all__') return ev
    return ev.filter((e) => e.productId === selectedProductId)
  }, [metrics, selectedProductId])

  const toggleExportProduct = (productId: string) => {
    setExportProductIds((prev) =>
      prev.includes(productId) ? prev.filter((x) => x !== productId) : [...prev, productId]
    )
  }

  const downloadZip = async () => {
    try {
      setExporting(true)
      setExportError(null)

      const qs = new URLSearchParams({ from, to })
      for (const pid of exportProductIds) qs.append('productId', pid)

      const res = await fetch(`/api/owner/invoices/export?${qs.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || `Export fehlgeschlagen (${res.status})`)
      }

      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') || ''
      const m = cd.match(/filename="([^"]+)"/)
      const filename = m?.[1] ?? `invoices_${from}_${to}.zip`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Unbekannter Export-Fehler')
    } finally {
      setExporting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="py-16 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner className="h-10 w-10 mx-auto" />
          <p className="mt-4 text-gray-600">Admin-Daten werden geladen…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-10">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800">Dashboard konnte nicht geladen werden</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <div className="mt-4">
                  <Button onClick={load} variant="outline">
                    Erneut versuchen
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!metrics) return null

  return (
    <div className="py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">
            Zeitraum: <span className="font-medium">{metrics.period.from}</span> bis{' '}
            <span className="font-medium">{metrics.period.to}</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Von</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Bis</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={load} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Aktualisieren
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-2 sm:items-center">
        <label className="text-sm text-gray-600">Ansicht:</label>
        <select
          className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm"
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
        >
          {productOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Paying Kunden</p>
            <p className="text-2xl font-bold">{totals.paying}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Aktiv + Trial</p>
            <p className="text-2xl font-bold">{totals.activeOrTrialing}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Kündigungen geplant</p>
            <p className="text-2xl font-bold">{totals.cancelScheduled}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Umsatz im Zeitraum (brutto)</p>
            <p className="text-2xl font-bold">{formatEur(totals.periodGross)}</p>
            <p className="text-xs text-gray-500 mt-1">Netto: {formatEur(totals.periodNet)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-product cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        {filteredProducts.map((p) => (
          <Card key={p.productId}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{p.productName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Paying</p>
                  <p className="text-lg font-semibold">{p.paying}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Trial</p>
                  <p className="text-lg font-semibold">{p.trialing}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Kündigungen geplant</p>
                  <p className="text-lg font-semibold">{p.cancelScheduled}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Abgewandert (historisch)</p>
                  <p className="text-lg font-semibold">{p.churned}</p>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-sm font-medium">Forecast (aktueller Bestand)</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Monat brutto</p>
                    <p className="font-semibold">{formatEur(p.expectedMonthlyGross)}</p>
                    <p className="text-xs text-gray-500">Monat netto: {formatEur(p.expectedMonthlyNet)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Jahr brutto</p>
                    <p className="font-semibold">{formatEur(p.expectedYearlyGross)}</p>
                    <p className="text-xs text-gray-500">Jahr netto: {formatEur(p.expectedYearlyNet)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-sm font-medium">Umsatz im Zeitraum</p>
                <p className="mt-1 text-sm text-gray-700">
                  Brutto: <span className="font-semibold">{formatEur(p.periodGross)}</span> · Netto:{' '}
                  <span className="font-semibold">{formatEur(p.periodNet)}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Timeline */}
      {selectedTimeline && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Zu- und Abwanderung (Monatsübersicht)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left text-sm">Monat</th>
                    <th className="px-3 py-2 text-right text-sm">Anmeldungen</th>
                    <th className="px-3 py-2 text-right text-sm">Abwanderung</th>
                    <th className="px-3 py-2 text-right text-sm">Umsatz brutto</th>
                    <th className="px-3 py-2 text-right text-sm">Umsatz netto</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTimeline.points.map((pt) => (
                    <tr key={pt.month} className="border-t">
                      <td className="px-3 py-2 text-sm">{pt.month}</td>
                      <td className="px-3 py-2 text-sm text-right">{pt.signups}</td>
                      <td className="px-3 py-2 text-sm text-right">{pt.churns}</td>
                      <td className="px-3 py-2 text-sm text-right">{formatEur(pt.gross)}</td>
                      <td className="px-3 py-2 text-sm text-right">{formatEur(pt.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming cancellations */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Geplante Kündigungen (nächste)</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredUpcomingCancels.length === 0 ? (
            <p className="text-sm text-gray-600">Keine geplanten Kündigungen gefunden.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left text-sm">Datum</th>
                    <th className="px-3 py-2 text-left text-sm">E-Mail</th>
                    <th className="px-3 py-2 text-left text-sm">Land</th>
                    <th className="px-3 py-2 text-left text-sm">Mentorship</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUpcomingCancels.slice(0, 50).map((e) => (
                    <tr key={`${e.subscriptionId}:${e.at}`} className="border-t">
                      <td className="px-3 py-2 text-sm">{formatDateTime(e.at)}</td>
                      <td className="px-3 py-2 text-sm">{e.email ?? '—'}</td>
                      <td className="px-3 py-2 text-sm">{e.country ?? '—'}</td>
                      <td className="px-3 py-2 text-sm">{e.productName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent events */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Letzte Events (Anmeldung / Abwanderung)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left text-sm">Zeitpunkt</th>
                  <th className="px-3 py-2 text-left text-sm">Typ</th>
                  <th className="px-3 py-2 text-left text-sm">E-Mail</th>
                  <th className="px-3 py-2 text-left text-sm">Land</th>
                  <th className="px-3 py-2 text-left text-sm">Mentorship</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.slice(0, 100).map((e) => (
                  <tr key={`${e.subscriptionId}:${e.at}:${e.type}`} className="border-t">
                    <td className="px-3 py-2 text-sm">{formatDateTime(e.at)}</td>
                    <td className="px-3 py-2 text-sm">
                      {e.type === 'signup' ? 'Anmeldung' : e.type === 'churn' ? 'Abwanderung' : 'Kündigung'}
                    </td>
                    <td className="px-3 py-2 text-sm">{e.email ?? '—'}</td>
                    <td className="px-3 py-2 text-sm">{e.country ?? '—'}</td>
                    <td className="px-3 py-2 text-sm">{e.productName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* PDF export */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Rechnungen als ZIP exportieren (PDF)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Du kannst Rechnungen für einen Zeitraum als ZIP herunterladen. Wenn es zu viele Rechnungen sind, sagt dir
            Stripe „zu viele“ – dann nimmst du bitte einen kürzeren Zeitraum oder nutzt das lokale Export‑Script.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-medium">Mentorship auswählen</p>
              <div className="mt-3 space-y-2">
                {products.map((p) => (
                  <label key={p.productId} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={exportProductIds.includes(p.productId)}
                      onChange={() => toggleExportProduct(p.productId)}
                    />
                    <span>{p.productName}</span>
                  </label>
                ))}
                {products.length === 0 && <p className="text-sm text-gray-500">Keine Produkte gefunden.</p>}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-medium">Export</p>
              <p className="text-sm text-gray-600 mt-1">
                Zeitraum wird oben übernommen: <span className="font-medium">{from}</span> bis{' '}
                <span className="font-medium">{to}</span>
              </p>

              {exportError && (
                <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {exportError}
                </div>
              )}

              <div className="mt-4">
                <Button onClick={downloadZip} disabled={exporting} className="w-full">
                  {exporting ? (
                    <>
                      <LoadingSpinner className="mr-2 h-4 w-4" />
                      Export wird erstellt…
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      ZIP herunterladen
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


