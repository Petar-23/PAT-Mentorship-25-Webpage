import '@/components/landing-v3/landing-v3.css'
import './rechner.css'
import { CtaTracking } from '@/components/landing-v3/client/enhancements'
import { landingSans, landingSerif } from '@/components/landing-v3/fonts'
import { THEME_BOOT_SCRIPT } from '@/components/landing-v3/theme-core'
import type { Sprache } from './texte'
import { Wizard } from './wizard'

/**
 * Prop-Firm-Rechner als Bildschirm-App im Stil der Landing (.pat-lf: Schriften, Farben, Tag/Nacht nach Sonnenstand).
 * Genau ein Bildschirm hoch, kein Seiten-Scroll; Methode, Quellen und Rechtliches öffnen als Blatt im Rechner.
 * Beide Sprachfassungen rendern diese eine Komponente, nur `sprache` unterscheidet sie.
 */
export function RechnerSeite({ sprache }: { sprache: Sprache }) {
  return (
    // data-mode und data-js setzt das Inline-Skript vor dem ersten Paint, daher suppressHydrationWarning
    <div id="top" lang={sprache} className={`pat-lf pfr pfr-app ${landingSans.variable} ${landingSerif.variable}`} suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      {/* blendet den globalen Footer aus (app/globals.css); die globale Navigation blendet navbar.tsx per Pfad aus */}
      <div hidden data-hide-root-footer="true" />
      <Wizard sprache={sprache} />
      <CtaTracking />
    </div>
  )
}
