import Image from 'next/image'
import Link from 'next/link'
import { ThemeSwitch } from '@/components/landing-v3/client/theme-switch'
import { CTA_LABEL, NAV_LINKS, SIGN_IN_URL, checkoutHref, ctaSource } from '@/components/landing-v3/content'

export function SiteHeader() {
  return (
    <header className="nav">
      <div className="wrap nav-in">
        <a className="brand" href="#top" aria-label="Price Action Trader, zum Seitenanfang">
          <span className="mark" aria-hidden="true">
            <Image src="/landing/logo.jpg" alt="" width={30} height={30} sizes="30px" />
          </span>
          <span className="word">Price Action Trader</span>
        </a>
        <nav className="links" aria-label="Seitenbereiche">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="nav-right">
          <ThemeSwitch />
          <Link className="login" href={SIGN_IN_URL} prefetch={false} data-signin={ctaSource('nav')}>
            Anmelden
          </Link>
          <a className="btn btn-inv" href={checkoutHref('nav')} data-cta={ctaSource('nav')}>
            {CTA_LABEL}
          </a>
        </div>
      </div>
    </header>
  )
}
