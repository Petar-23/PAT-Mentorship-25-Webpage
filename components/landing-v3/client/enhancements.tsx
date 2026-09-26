'use client'

import { useEffect } from 'react'
import { trackConversion } from '@/components/analytics/tracking'

/** Kopfzeile wird milchig, sobald die Seite scrollt (Sentinel oben im Wrapper). */
export function HeaderScrollState() {
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>('.pat-lf .nav')
    const sentinel = document.querySelector('.pat-lf .lf-sentinel')
    if (!nav || !sentinel || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver((entries) => {
      nav.toggleAttribute('data-scrolled', !(entries[0]?.isIntersecting ?? true))
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])
  return null
}

/**
 * Weiches Scrollen erst nach dem Laden (CSS: html:has(.pat-lf[data-js]:not([data-smooth]))). So springt ein Anker in der
 * Adresse sofort ans Ziel, und WarumMotion kann nach dem Anpinnen exakt nachjustieren. Danach laufen Menü-Anker weich.
 */
export function SmoothScrollAfterLoad() {
  useEffect(() => {
    const root = document.querySelector('.pat-lf')
    if (!root) return
    let frame = 0
    const enable = () => {
      frame = window.requestAnimationFrame(() => root.setAttribute('data-smooth', ''))
    }
    if (document.readyState === 'complete') enable()
    else window.addEventListener('load', enable, { once: true })
    return () => {
      window.removeEventListener('load', enable)
      window.cancelAnimationFrame(frame)
      root.removeAttribute('data-smooth')
    }
  }, [])
  return null
}

/** Architektenzeichnungen zeichnen sich, sobald sie ins Bild kommen. Bei reduzierter Bewegung sofort fertig. */
export function DrawOnView() {
  useEffect(() => {
    const plans = Array.from(document.querySelectorAll<SVGElement>('.pat-lf .plan.drawable'))
    if (!plans.length) return
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (calm || !('IntersectionObserver' in window)) {
      plans.forEach((plan) => plan.classList.add('on'))
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('on')
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.3 }
    )
    plans.forEach((plan) => observer.observe(plan))
    return () => observer.disconnect()
  }, [])
  return null
}

/**
 * Zählt Klicks auf die Kaufbuttons (cta_click) und auf "Anmelden" (sign_in_start) mit Quelle.
 * Der Tracking-Helfer sendet nur mit Einwilligung, sonst passiert nichts.
 */
export function CtaTracking() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const link = target.closest<HTMLElement>('.pat-lf [data-cta], .pat-lf [data-signin]')
      if (!link) return
      const cta = link.getAttribute('data-cta')
      if (cta) trackConversion.ctaClick(cta)
      const signIn = link.getAttribute('data-signin')
      if (signIn) trackConversion.signInStart(signIn)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])
  return null
}
