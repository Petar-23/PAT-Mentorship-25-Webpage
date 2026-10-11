// src/app/tools/equity-calculator/layout.tsx
import { Metadata } from 'next'

export const metadata: Metadata = {
  // Ohne "| PAT Mentorship 2026": Das Root-Template hängt "| PAT Mentorship" ohnehin an.
  title: 'Wachstumsrechner für Micro E-mini Futures',
  description: 'Simuliere deine Handelsentwicklung mit Micro E-mini Futures. Berechne die optimale Kontraktgröße basierend auf deinem Kapital und verstehe, wann du deine Position vergrößern kannst - unter Berücksichtigung eines festen Stop-Loss und deiner Risikopräferenzen.',
  openGraph: {
    title: 'Wachstumsrechner für Micro E-mini Futures | PAT Mentorship',
    description: 'Simuliere deine Handelsentwicklung mit Micro E-mini Futures. Berechne die optimale Kontraktgröße basierend auf deinem Kapital und verstehe, wann du deine Position vergrößern kannst - unter Berücksichtigung eines festen Stop-Loss und deiner Risikopräferenzen.',
    type: 'website',
    url: '/tools/equity-calculator',
  },
  alternates: { canonical: '/tools/equity-calculator' },
}

export default function EquityCalculatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}