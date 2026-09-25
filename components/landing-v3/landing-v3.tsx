import './landing-v3.css'
import { CtaTracking, DrawOnView, HeaderScrollState, SmoothScrollAfterLoad } from '@/components/landing-v3/client/enhancements'
import { LehrplanMotion } from '@/components/landing-v3/client/lehrplan-motion'
import { MobileBuyBar } from '@/components/landing-v3/client/mobile-buy-bar'
import { WarumMotion } from '@/components/landing-v3/client/warum-motion'
import { ASSURE, CTA_LABEL, checkoutHref, ctaSource } from '@/components/landing-v3/content'
import { landingSans, landingSerif } from '@/components/landing-v3/fonts'
import { Ablauf } from '@/components/landing-v3/sections/ablauf'
import { Bereich } from '@/components/landing-v3/sections/bereich'
import { Fragen } from '@/components/landing-v3/sections/fragen'
import { Hero } from '@/components/landing-v3/sections/hero'
import { Lehrplan } from '@/components/landing-v3/sections/lehrplan'
import { Petar } from '@/components/landing-v3/sections/petar'
import { Preis } from '@/components/landing-v3/sections/preis'
import { Proof } from '@/components/landing-v3/sections/proof'
import { Schluss } from '@/components/landing-v3/sections/schluss'
import { SiteFooter } from '@/components/landing-v3/sections/site-footer'
import { SiteHeader } from '@/components/landing-v3/sections/site-header'
import { Stimmen } from '@/components/landing-v3/sections/stimmen'
import { Warum } from '@/components/landing-v3/sections/warum'
import { THEME_BOOT_SCRIPT } from '@/components/landing-v3/theme-core'
import type { LandingReviews } from '@/components/landing-v3/types'

/**
 * Neue Landingpage (Ladenfront). Alles Styling hängt an .pat-lf, das Farbschema als data-mode am Wrapper,
 * damit nichts auf andere Seiten durchschlägt. Sektionen sind Server Components, Interaktion steckt in kleinen Client-Inseln.
 * Rendert innerhalb von <main id="main-content"> aus dem Root-Layout, daher hier kein eigenes <main>.
 */
export function LandingV3({ reviews }: { reviews: LandingReviews }) {
  return (
    // data-mode und data-js setzt das Inline-Skript vor dem ersten Paint, daher suppressHydrationWarning
    <div id="top" className={`pat-lf ${landingSans.variable} ${landingSerif.variable}`} suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      {/* blendet den globalen Footer aus (app/globals.css); die globale Navigation blendet navbar.tsx per Pfad aus */}
      <div hidden data-hide-root-footer="true" />
      <span className="lf-sentinel" aria-hidden="true" />
      <SiteHeader />
      <Hero />
      <Proof reviews={reviews} />
      <Warum />
      <Ablauf />
      <Lehrplan />
      <Bereich />
      <Stimmen reviews={reviews} />
      <Petar />
      <Preis />
      <Fragen />
      <Schluss />
      <SiteFooter />
      <MobileBuyBar href={checkoutHref('mbar')} source={ctaSource('mbar')} label={CTA_LABEL} note={ASSURE.title} detail={ASSURE.short} />
      <HeaderScrollState />
      <DrawOnView />
      <WarumMotion />
      <LehrplanMotion />
      <SmoothScrollAfterLoad />
      <CtaTracking />
    </div>
  )
}
