import type { Metadata } from 'next'
import { Card } from '@/components/ui/card'
import { KuendigungForm } from '@/components/vertrag/kuendigung-form'

// Kündigungsbutton nach § 312k BGB: öffentlich erreichbar, ohne Login (siehe middleware.ts),
// verlinkt aus jedem Footer mit "Verträge hier kündigen".
// ANWALTLICH PRÜFEN: Wortlaut und Ablauf dieser Seite vor dem Livegang freigeben lassen.

export const metadata: Metadata = {
  title: 'Vertrag kündigen',
  description: 'Kündigen Sie Ihren Vertrag mit PRICE ACTION TRADER online, ohne Anmeldung, mit sofortiger Eingangsbestätigung.',
  alternates: { canonical: '/kuendigen' },
}

export default function KuendigenPage() {
  return (
    <div className="container mx-auto py-12 px-4">
      <Card className="max-w-3xl mx-auto bg-white">
        <div className="p-6 md:p-8">
          <KuendigungForm />
        </div>
      </Card>
    </div>
  )
}
