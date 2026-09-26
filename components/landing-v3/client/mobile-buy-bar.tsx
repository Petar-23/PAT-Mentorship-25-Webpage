'use client'

import { useEffect, useState } from 'react'
import { useCookieConsent } from '@/lib/cookie-consent-client'

type MobileBuyBarProps = {
  href: string
  source: string
  label: string
  note: string
  detail: string
}

/**
 * Mobile Kaufleiste (nur unter 900 px sichtbar, per CSS): erscheint nach dem Hero und verschwindet über Preis und Schluss.
 * Solange der Cookie-Banner offen ist, bleibt sie weg, damit sie ihn nicht überlagert und nicht von ihm verdeckt wird.
 */
export function MobileBuyBar({ href, source, label, note, detail }: MobileBuyBarProps) {
  const consent = useCookieConsent()
  const [pastHero, setPastHero] = useState(false)
  const [overBlock, setOverBlock] = useState(false)

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const hero = document.querySelector('.pat-lf .hero')
    const blocks = [document.getElementById('offer'), document.querySelector('.pat-lf .final')].filter(
      (el): el is Element => el !== null
    )
    const heroObserver = new IntersectionObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setPastHero(!(entry.isIntersecting || entry.boundingClientRect.top > 0))
    })
    if (hero) heroObserver.observe(hero)

    const seen = new Map<Element, boolean>()
    const blockObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) seen.set(entry.target, entry.isIntersecting)
      setOverBlock(Array.from(seen.values()).some(Boolean))
    })
    blocks.forEach((el) => blockObserver.observe(el))

    return () => {
      heroObserver.disconnect()
      blockObserver.disconnect()
    }
  }, [])

  // undefined: Einwilligung noch nicht gelesen, null: Banner ist offen.
  const bannerMayShow = consent === undefined || consent === null
  const on = pastHero && !overBlock && !bannerMayShow

  return (
    <div className="mbar" data-on={on ? '' : undefined} aria-hidden={on ? undefined : true}>
      <p className="assure">
        {note}
        <span>{detail}</span>
      </p>
      <a className="btn btn-accent" href={href} data-cta={source} tabIndex={on ? undefined : -1}>
        {label}
      </a>
    </div>
  )
}
