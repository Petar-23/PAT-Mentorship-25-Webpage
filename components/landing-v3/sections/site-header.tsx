import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ThemeSwitch } from '@/components/landing-v3/client/theme-switch'
import { CTA_LABEL, NAV_LINKS, SIGN_IN_URL, checkoutHref, ctaSource } from '@/components/landing-v3/content'

/**
 * Kopfzeile der Landing. Ohne Props genau wie auf der Startseite.
 * Andere Seiten im selben Stil (Prop-Firm-Rechner) setzen Ziel und Beschriftung der Marke, eigene Bereichslinks
 * und ersetzen den rechten Teil (Sprachwahl, Farbschema, eigener Knopf).
 */
export function SiteHeader({
  brandHref = '#top',
  brandLabel = 'Price Action Trader, zum Seitenanfang',
  links = NAV_LINKS,
  linksLabel = 'Seitenbereiche',
  right,
}: {
  brandHref?: string
  brandLabel?: string
  links?: ReadonlyArray<{ href: string; label: string }>
  linksLabel?: string
  right?: ReactNode
} = {}) {
  return (
    <header className="nav">
      <div className="wrap nav-in">
        <a className="brand" href={brandHref} aria-label={brandLabel}>
          <span className="mark" aria-hidden="true">
            <Image src="/landing/logo.jpg" alt="" width={30} height={30} sizes="30px" />
          </span>
          <span className="word">Price Action Trader</span>
        </a>
        {links.length > 0 && (
          <nav className="links" aria-label={linksLabel}>
            {links.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        )}
        <div className="nav-right">
          {right ?? (
            <>
              <ThemeSwitch />
              <Link className="login" href={SIGN_IN_URL} prefetch={false} data-signin={ctaSource('nav')}>
                Anmelden
              </Link>
              <a className="btn btn-inv" href={checkoutHref('nav')} data-cta={ctaSource('nav')}>
                {CTA_LABEL}
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
