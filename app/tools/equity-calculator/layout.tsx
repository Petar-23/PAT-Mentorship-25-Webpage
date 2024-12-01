// src/app/tools/equity-calculator/layout.tsx
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Wachstumsrechner | PAT Mentorship 2025',
  description: 'Simuliere deine Handelsentwicklung mit Micro E-mini Futures. Berechne die optimale Kontraktgröße basierend auf deinem Kapital und verstehe, wann du deine Position vergrößern kannst - unter Berücksichtigung eines festen Stop-Loss und deiner Risikopräferenzen.',
  openGraph: {
    title: 'Wachstumsrechner | PAT Mentorship 2025',
    description: 'Simuliere deine Handelsentwicklung mit Micro E-mini Futures. Berechne die optimale Kontraktgröße basierend auf deinem Kapital und verstehe, wann du deine Position vergrößern kannst - unter Berücksichtigung eines festen Stop-Loss und deiner Risikopräferenzen.',
    type: 'website',
  },
}

export default function EquityCalculatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}