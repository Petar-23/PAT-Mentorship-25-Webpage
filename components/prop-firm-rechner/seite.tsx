import '@/components/landing-v3/landing-v3.css'
import './rechner.css'
import { CtaTracking, HeaderScrollState } from '@/components/landing-v3/client/enhancements'
import { ThemeSwitch } from '@/components/landing-v3/client/theme-switch'
import { landingSans, landingSerif } from '@/components/landing-v3/fonts'
import { SiteFooter } from '@/components/landing-v3/sections/site-footer'
import { SiteHeader } from '@/components/landing-v3/sections/site-header'
import { THEME_BOOT_SCRIPT } from '@/components/landing-v3/theme-core'
import rohDaten from '@/lib/prop-firm/daten/regeln-2026-10-09.json'
import type { RegelDaten } from '@/lib/prop-firm/konten'
import { Hintergrund } from './hintergrund'
import { PFADE } from './pfade'
import { Wizard } from './wizard'
import { woerterbuch, type Sprache } from './texte'

const DATEN = rohDaten as unknown as RegelDaten

/** DE | EN oben rechts. Volle Seitenwechsel (kein Client-Routing), damit Farbschema und Wörterbuch frisch starten. */
function Sprachwahl({ sprache }: { sprache: Sprache }) {
  const t = woerterbuch(sprache)
  return (
    <nav className="sprachwahl" aria-label={t.seite.sprachwahl}>
      <a href={PFADE.de} hrefLang="de" lang="de" aria-label="Deutsch" aria-current={sprache === 'de' ? 'page' : undefined}>
        DE
      </a>
      <a href={PFADE.en} hrefLang="en" lang="en" aria-label="English" aria-current={sprache === 'en' ? 'page' : undefined}>
        EN
      </a>
    </nav>
  )
}

/**
 * Prop-Firm-Rechner als ganze Seite im Stil der Landing (.pat-lf: Schriften, Farben, Tag/Nacht nach Sonnenstand,
 * Kopf- und Fußzeile). Beide Sprachfassungen rendern diese eine Komponente, nur `sprache` unterscheidet sie.
 * Aufbau: kurzer Hero, Rechner mit zwei Rechenarten (rückwärts als Standard, vorwärts), jeweils Eingabe, Zusammenfassung und
 * Ergebnis direkt darunter, dann Ergebnisse, Angebot (DE eToro und Mentorship, EN Research-Newsletter), Methode und Quellen.
 */
export function RechnerSeite({ sprache }: { sprache: Sprache }) {
  const t = woerterbuch(sprache)
  const S = t.seite
  const anzahl = DATEN.konten.length
  return (
    // data-mode und data-js setzt das Inline-Skript vor dem ersten Paint, daher suppressHydrationWarning
    <div id="top" lang={sprache} className={`pat-lf pfr ${landingSans.variable} ${landingSerif.variable}`} suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      {/* blendet den globalen Footer aus (app/globals.css); die globale Navigation blendet navbar.tsx per Pfad aus */}
      <div hidden data-hide-root-footer="true" />
      <span className="lf-sentinel" aria-hidden="true" />
      <SiteHeader
        brandHref={S.markeHref}
        brandLabel={S.markeLabel}
        links={[]}
        right={
          <>
            <Sprachwahl sprache={sprache} />
            <ThemeSwitch sprache={sprache} />
            <a className="btn btn-inv" href={S.kopfKnopfHref} data-cta={`pfr-${sprache}-nav`}>
              {S.kopfKnopf}
            </a>
          </>
        }
      />
      <section className="hero pfr-hero" aria-labelledby="pfr-titel">
        <div className="wrap">
          <p className="kicker rise">{S.kicker}</p>
          <h1 id="pfr-titel">
            <span className="dim rise">{S.titelDim}</span>
            <span className="rise">{S.titel}</span>
          </h1>
          <p className="sub rise">{S.lead(anzahl)}</p>
        </div>
      </section>
      <Wizard sprache={sprache} />
      <Hintergrund daten={DATEN} sprache={sprache} />
      <SiteFooter sprache={sprache} />
      <HeaderScrollState />
      <CtaTracking />
    </div>
  )
}
