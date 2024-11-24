'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { MatrixRain } from '@/components/ui/matrix-rain'

export default function NotFound() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      {/* Background Matrix */}
      <div className="fixed inset-0 opacity-95">
        <MatrixRain color="rgba(37, 99, 235, 0.2)" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center">
          <div className="text-4xl text-blue-400 font-light mb-8">
            404
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Seite nicht gefunden
          </h1>

          <p className="text-gray-600 mb-8">
            Die gesuchte Seite existiert leider nicht. 
            Möglicherweise wurde sie verschoben oder gelöscht.
          </p>

          <Link 
            href=".."
            className="block w-full bg-white rounded-xl border border-gray-200 p-3 mb-8 text-gray-900 max-auto"
          >
            <div className="flex items-center justify-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              <span>Zurück</span>
            </div>
          </Link>

          <p className="text-gray-600 text-sm">
            Benötigst du Hilfe? Schreibe uns eine{' '}
            <Link href="mailto:kontakt@price-action-trader.de" className="text-blue-600">
              E-Mail
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}