import Link from 'next/link'
import { FooterCookieSettingsButton } from '@/components/layout/footer-cookie-settings-button'
import { CONTACT_EMAIL, RISK_NOTE, RISK_NOTE_EN } from '@/components/landing-v3/content'
import { LABELS } from '@/lib/vertrag-erklaerung.mjs'

const LEGAL_LINKS = [
  { href: '/impressum', label: 'Impressum' },
  { href: '/datenschutz', label: 'Datenschutz' },
  { href: '/AGB', label: 'AGB' },
  { href: '/Widerruf', label: 'Widerrufsbelehrung' },
] as const

// Englische Seiten (Prop-Firm-Rechner): Beschriftungen übersetzt, die Rechtstexte selbst gibt es nur auf Deutsch.
const LEGAL_LINKS_EN = [
  { href: '/impressum', label: 'Legal notice' },
  { href: '/datenschutz', label: 'Privacy policy' },
  { href: '/AGB', label: 'Terms' },
  { href: '/Widerruf', label: 'Right of withdrawal' },
] as const

const TEXT = {
  de: { legal: 'Rechtliches', cookies: 'Cookie-Einstellungen', contact: 'Kontakt', risk: RISK_NOTE, links: LEGAL_LINKS, note: null },
  en: {
    legal: 'Legal',
    cookies: 'Cookie settings',
    contact: 'Contact',
    risk: RISK_NOTE_EN,
    links: LEGAL_LINKS_EN,
    note: 'Legal pages and contract forms are in German.',
  },
} as const

export function SiteFooter({ sprache = 'de' }: { sprache?: 'de' | 'en' } = {}) {
  const t = TEXT[sprache]
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-in">
          <nav aria-label={t.legal}>
            {t.links.map((link) => (
              <Link key={link.href} href={link.href} prefetch={false} hrefLang={sprache === 'en' ? 'de' : undefined}>
                {link.label}
              </Link>
            ))}
            <FooterCookieSettingsButton variant="text" label={t.cookies} />
          </nav>
          {/* Kündigungsbutton (§ 312k BGB) und Widerrufsfunktion (§ 356a BGB): Beschriftung gesetzlich vorgegeben,
              gleiche Texte wie im globalen Footer, auch auf englischen Seiten (Verträge laufen auf Deutsch). ANWALTLICH PRÜFEN. */}
          <div className="foot-contract" lang={sprache === 'en' ? 'de' : undefined}>
            <Link href="/kuendigen" prefetch={false}>
              {LABELS.cancelEntry}
            </Link>
            <Link href="/widerrufen" prefetch={false}>
              {LABELS.withdrawEntry}
            </Link>
          </div>
        </div>
        <div className="foot-meta">
          <p>
            {t.contact}: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
          <p>{t.risk}</p>
          {t.note && <p>{t.note}</p>}
        </div>
      </div>
    </footer>
  )
}
