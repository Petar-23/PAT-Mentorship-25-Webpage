import Link from 'next/link'
import { FooterCookieSettingsButton } from '@/components/layout/footer-cookie-settings-button'
import { CONTACT_EMAIL, RISK_NOTE } from '@/components/landing-v3/content'
import { LABELS } from '@/lib/vertrag-erklaerung.mjs'

const LEGAL_LINKS = [
  { href: '/impressum', label: 'Impressum' },
  { href: '/datenschutz', label: 'Datenschutz' },
  { href: '/AGB', label: 'AGB' },
  { href: '/Widerruf', label: 'Widerrufsbelehrung' },
] as const

export function SiteFooter() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-in">
          <nav aria-label="Rechtliches">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href} prefetch={false}>
                {link.label}
              </Link>
            ))}
            <FooterCookieSettingsButton variant="text" />
          </nav>
          {/* Kündigungsbutton (§ 312k BGB) und Widerrufsfunktion (§ 356a BGB): Beschriftung gesetzlich vorgegeben,
              gleiche Texte wie im globalen Footer. ANWALTLICH PRÜFEN. */}
          <div className="foot-contract">
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
            Kontakt: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
          <p>{RISK_NOTE}</p>
        </div>
      </div>
    </footer>
  )
}
