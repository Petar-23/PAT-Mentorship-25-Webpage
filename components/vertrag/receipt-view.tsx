'use client'

import { Fragment, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { receiptToText } from '@/lib/vertrag-erklaerung.mjs'
import type { DeclarationResult } from '@/components/vertrag/form-parts'

// Bestätigungsseite nach dem Absenden. § 312k Abs. 3 BGB: Der Verbraucher muss die Erklärung
// mit Datum und Uhrzeit dauerhaft speichern können. Deshalb Drucken/PDF und Textdatei.
// Die Seite ist für alle Fälle gleich aufgebaut: eigene Angaben, Eingangs-ID, Datum und Uhrzeit und
// ein fester Hinweis. Vertragsende und Mitgliedsstatus stehen nur in der E-Mail an die hinterlegte
// Adresse, damit niemand über fremde E-Mail-Adressen etwas über Mitglieder erfährt.
// ANWALTLICH PRÜFEN: Wortlaut der Bestätigung.

export function ReceiptView({ result }: { result: DeclarationResult }) {
  const { receipt } = result
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    window.scrollTo({ top: 0 })
    headingRef.current?.focus()
  }, [])

  const saveAsFile = () => {
    const blob = new Blob([receiptToText(receipt)], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${receipt.type === 'kuendigung' ? 'Kuendigung' : 'Widerruf'}-${receipt.id}.txt`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-bold mb-4 focus:outline-none">
        {receipt.type === 'kuendigung' ? 'Ihre Kündigung ist eingegangen' : 'Ihr Widerruf ist eingegangen'}
      </h1>
      <p className="text-gray-600 mb-8">
        Bitte speichern oder drucken Sie diese Bestätigung für Ihre Unterlagen.
      </p>

      <section aria-labelledby="receipt-title" className="rounded-lg border border-gray-200 p-5 md:p-6 mb-6">
        <h2 id="receipt-title" className="text-xl font-semibold mb-4">
          {receipt.title}
        </h2>
        <p className="font-medium text-gray-900">{receipt.statement}</p>
        <p className="text-sm text-gray-600 mb-6">{receipt.submittedVia}</p>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:gap-y-3">
          {receipt.lines.map((line) => (
            <Fragment key={line.label}>
              <dt className="text-gray-600">{line.label}</dt>
              <dd className="mb-3 whitespace-pre-wrap break-words text-gray-900 sm:mb-0">{line.value}</dd>
            </Fragment>
          ))}
        </dl>
        <p className="mt-6 font-semibold text-gray-900">{receipt.notice}</p>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row print:hidden">
        <Button type="button" size="lg" onClick={() => window.print()}>
          Drucken oder als PDF speichern
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={saveAsFile}>
          Als Textdatei speichern
        </Button>
      </div>
    </div>
  )
}
