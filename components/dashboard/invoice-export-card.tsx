'use client'

import { useEffect, useRef, useState } from 'react'
import { Download } from '@phosphor-icons/react/Download'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

type ExportProduct = {
  productId: string
  productName: string
}

type InvoiceExportCardProps = {
  from: string
  to: string
  products: ExportProduct[]
}

export function InvoiceExportCard({ from, to, products }: InvoiceExportCardProps) {
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const exportAbortRef = useRef<AbortController | null>(null)
  const [exportProductIds, setExportProductIds] = useState<string[]>(() =>
    products.map((p) => p.productId)
  )

  useEffect(() => {
    return () => {
      exportAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    setExportProductIds((prev) => {
      if (prev.length === 0) return products.map((p) => p.productId)

      const validProductIds = new Set(products.map((p) => p.productId))
      const next = prev.filter((productId) => validProductIds.has(productId))
      return next.length === prev.length ? prev : next
    })
  }, [products])

  const toggleExportProduct = (productId: string) => {
    setExportProductIds((prev) =>
      prev.includes(productId) ? prev.filter((x) => x !== productId) : [...prev, productId]
    )
  }

  const downloadZip = async () => {
    exportAbortRef.current?.abort()
    const controller = new AbortController()
    exportAbortRef.current = controller

    try {
      setExporting(true)
      setExportError(null)

      const qs = new URLSearchParams({ from, to })
      for (const pid of exportProductIds) qs.append('productId', pid)

      const res = await fetch(`/api/owner/invoices/export?${qs.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      if (controller.signal.aborted) return

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        if (controller.signal.aborted) return
        throw new Error(data?.error || `Export fehlgeschlagen (${res.status})`)
      }

      const blob = await res.blob()
      if (controller.signal.aborted) return

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
      if (controller.signal.aborted) return
      setExportError(e instanceof Error ? e.message : 'Unbekannter Export-Fehler')
    } finally {
      if (exportAbortRef.current === controller) {
        exportAbortRef.current = null
      }
      if (!controller.signal.aborted) {
        setExporting(false)
      }
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">Rechnungen als ZIP exportieren (PDF)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Du kannst Rechnungen für einen Zeitraum als ZIP herunterladen. Wenn es zu viele Rechnungen sind, sagt dir
          Stripe „zu viele“ – dann nimmst du bitte einen kürzeren Zeitraum oder nutzt das lokale Export-Script.
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
                    Export wird erstellt...
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
  )
}
