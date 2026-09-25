import type { Metadata } from 'next'
import { Card } from '@/components/ui/card'
import { WiderrufForm } from '@/components/vertrag/widerruf-form'

// Widerrufsfunktion nach § 356a BGB (seit 19.06.2026): öffentlich erreichbar, ohne Login
// (siehe middleware.ts), verlinkt aus jedem Footer mit "Vertrag widerrufen".
// ANWALTLICH PRÜFEN: Wortlaut und Ablauf dieser Seite vor dem Livegang freigeben lassen.

export const metadata: Metadata = {
  title: 'Vertrag widerrufen',
  description: 'Widerrufen Sie Ihren Vertrag mit PRICE ACTION TRADER online, ohne Anmeldung, mit sofortiger Eingangsbestätigung.',
  alternates: { canonical: '/widerrufen' },
}

export default function WiderrufenPage() {
  return (
    <div className="container mx-auto py-12 px-4">
      <Card className="max-w-3xl mx-auto bg-white">
        <div className="p-6 md:p-8">
          <WiderrufForm />
        </div>
      </Card>
    </div>
  )
}
