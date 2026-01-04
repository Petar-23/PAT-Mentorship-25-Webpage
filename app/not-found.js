'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const MatrixRainNoSSR = dynamic(
  () => import('@/components/ui/matrix-rain').then((m) => m.MatrixRain),
  { ssr: false }
)

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      {/* Background Matrix */}
      <div className="fixed inset-0 opacity-95">
        <MatrixRainNoSSR color="rgba(37, 99, 235, 0.2)" />
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
          <div className='flex justify-center mb-8'>
            <Link 
              href=".."
              className="inline-flex bg-white rounded-xl border border-gray-200 px-6 py-3 text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-center gap-2">
                <ArrowLeft className="w-4 h-4 mr-2" />
                <span>Zurück</span>
              </div>
            </Link>
          </div>
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