'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PFADE } from '@/components/prop-firm-rechner/pfade'
import { Button } from '@/components/ui/button'
import {
  ACCEPT_ALL_CONSENT,
  DEFAULT_CONSENT,
  OPEN_COOKIE_SETTINGS_EVENT,
  REJECT_ALL_CONSENT,
  type CookieConsent,
} from '@/lib/cookie-consent'
import { clearCookiesWithoutConsent, saveCookieConsent, useCookieConsent } from '@/lib/cookie-consent-client'

const CookieSettingsDialog = dynamic(
  () => import('@/components/ui/cookie-settings-dialog').then((mod) => mod.CookieSettingsDialog),
  { ssr: false }
)

const focusRing =
  'focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950'

// "Alle ablehnen" und "Alle akzeptieren" teilen sich bewusst exakt dieselbe Klasse: gleiche Größe, Farbe und Ebene.
const decisionButtonClass = `h-10 w-full px-5 sm:w-auto sm:min-w-[9.5rem] bg-slate-100 text-slate-950 shadow-none hover:bg-white ${focusRing}`

const settingsButtonClass = `col-span-2 h-10 w-full px-5 sm:col-span-1 sm:w-auto border-slate-700 bg-transparent text-white shadow-none hover:bg-slate-800 hover:text-white ${focusRing}`

// Kompakte Fassung (Rechner-Seiten): wieder dieselbe Klasse für beide Entscheidungen, 44 px hoch für den Daumen.
const compactDecisionClass = `h-11 w-full px-2 text-[12.5px] sm:w-auto sm:min-w-[8.5rem] sm:px-4 bg-slate-100 text-slate-950 shadow-none hover:bg-white ${focusRing}`
const compactSettingsClass = `h-11 w-full px-2 text-[12.5px] sm:w-auto sm:px-4 border-slate-700 bg-transparent text-white shadow-none hover:bg-slate-800 hover:text-white ${focusRing}`

/**
 * Texte der kompakten Fassung. Erste Ebene: Zwecke, Dienste, USA-Übermittlung, Widerruf. „Mehr“ zeigt den vollen Text
 * des großen Banners (gleicher Inhalt, auf der englischen Seite übersetzt). Wahl und Wirkung sind dieselben.
 */
const COMPACT_TEXT = {
  de: {
    title: 'Cookies',
    short:
      'Nur mit deiner Einwilligung: Analyse mit Google Analytics und Microsoft Clarity, Werbemessung und Personalisierung mit Google Ads. Daten können in die USA gehen. Jederzeit widerrufbar.',
    more: 'Mehr',
    less: 'Weniger',
    full:
      'Notwendige Cookies halten die Website am Laufen, etwa für die Anmeldung. Mit deiner Einwilligung nutzen wir zusätzlich Google Analytics und Microsoft Clarity zur Analyse sowie Google Ads, um den Erfolg unserer Werbung zu messen und Werbung zu personalisieren. Dabei können Daten in die USA übertragen werden. Du kannst deine Auswahl jederzeit ändern oder widerrufen: auf dieser Seite unten unter „Cookies“, sonst im Footer unter „Cookie-Einstellungen“ und im Mitgliederbereich im Profilmenü.',
    privacy: 'Datenschutzerklärung',
    imprint: 'Impressum',
    settings: 'Einstellungen',
    reject: 'Alle ablehnen',
    accept: 'Alle akzeptieren',
  },
  en: {
    title: 'Cookies',
    short:
      'Only with your consent: analytics with Google Analytics and Microsoft Clarity, ad measurement and personalisation with Google Ads. Data may be transferred to the USA. You can withdraw at any time.',
    more: 'More',
    less: 'Less',
    full:
      'Necessary cookies keep the website running, for example for signing in. With your consent we also use Google Analytics and Microsoft Clarity for analytics, and Google Ads to measure the success of our advertising and to personalise ads. Data may be transferred to the USA. You can change or withdraw your choice at any time: on this page at the bottom under “Cookies”, elsewhere in the footer under “Cookie-Einstellungen” and in the members area in the profile menu.',
    privacy: 'Privacy policy',
    imprint: 'Legal notice',
    settings: 'Settings',
    reject: 'Reject all',
    accept: 'Accept all',
  },
} as const

/** Auf den Rechner-Seiten sitzt das Banner klein oben, damit es Weiter und Zurück unten nie verdeckt. */
function CompactCookieBanner({
  lang,
  onSettings,
  onReject,
  onAccept,
}: {
  lang: 'de' | 'en'
  onSettings: () => void
  onReject: () => void
  onAccept: () => void
}) {
  const t = COMPACT_TEXT[lang]
  const [more, setMore] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Höhe als CSS-Variable: der Rechner rückt darunter, statt verdeckt zu werden (rechner.css, .pfr-app-innen).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    const set = () => root.style.setProperty('--pfr-banner-h', `${Math.ceil(el.getBoundingClientRect().height)}px`)
    set()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(set)
    observer?.observe(el)
    return () => {
      observer?.disconnect()
      root.style.removeProperty('--pfr-banner-h')
    }
  }, [])

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-text"
      lang={lang}
      data-cookie-banner="compact"
      className="fixed inset-x-0 top-0 z-50 max-h-[70dvh] overflow-y-auto border-b border-slate-800 bg-slate-950 px-4 pb-2.5 pt-[calc(10px+env(safe-area-inset-top,0px))] sm:px-8"
    >
      <div className="mx-auto flex max-w-[1080px] flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-6">
        <div id="cookie-banner-text" className="text-[12px] leading-[1.5] text-slate-300 lg:flex-1">
          <p>
            <span id="cookie-banner-title" className="font-semibold text-white">
              {t.title}:
            </span>{' '}
            {t.short}{' '}
            <button
              type="button"
              onClick={() => setMore((m) => !m)}
              aria-expanded={more}
              aria-controls="cookie-banner-more"
              className={`text-blue-300 underline hover:text-blue-200 ${focusRing}`}
            >
              {more ? t.less : t.more}
            </button>
            {' · '}
            <Link href="/datenschutz" className="text-blue-300 underline hover:text-blue-200" hrefLang="de">
              {t.privacy}
            </Link>
            {' · '}
            <Link href="/impressum" className="text-blue-300 underline hover:text-blue-200" hrefLang="de">
              {t.imprint}
            </Link>
          </p>
          <p id="cookie-banner-more" hidden={!more} className="mt-1.5">
            {t.full}
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-3">
          <Button type="button" onClick={onReject} className={compactDecisionClass}>
            {t.reject}
          </Button>
          <Button type="button" onClick={onAccept} className={compactDecisionClass}>
            {t.accept}
          </Button>
          <Button type="button" variant="outline" onClick={onSettings} className={compactSettingsClass}>
            {t.settings}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function CookieBanner() {
  const consent = useCookieConsent()
  const pathname = usePathname()
  const compactLang = pathname === PFADE.de ? 'de' : pathname === PFADE.en ? 'en' : null
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  // undefined: noch nicht gelesen (kein Aufblitzen), null: keine gültige Entscheidung.
  const showBanner = consent === null

  const openSettings = useCallback(() => {
    setIsSettingsOpen(true)
  }, [])

  useEffect(() => {
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings)
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings)
  }, [openSettings])

  useEffect(() => {
    // Reste von Tracking-Cookies ohne (gültige) Einwilligung entfernen, etwa nach einem Widerruf.
    clearCookiesWithoutConsent()
  }, [consent])

  const saveConsent = useCallback((consentData: CookieConsent) => {
    setIsSettingsOpen(false)
    const { needsReload } = saveCookieConsent(consentData)
    if (needsReload) {
      // Widerruf für bereits geladene Dienste: gtag.js und Clarity lassen sich nur durch Neuladen vollständig beenden.
      window.location.reload()
    }
  }, [])

  const handleAcceptAll = useCallback(() => {
    saveConsent(ACCEPT_ALL_CONSENT)
  }, [saveConsent])

  const handleRejectAll = useCallback(() => {
    saveConsent(REJECT_ALL_CONSENT)
  }, [saveConsent])

  const handleClose = useCallback(() => {
    setIsSettingsOpen(false)
  }, [])

  return (
    <>
      {showBanner && !isSettingsOpen && compactLang ? (
        <CompactCookieBanner lang={compactLang} onSettings={openSettings} onReject={handleRejectAll} onAccept={handleAcceptAll} />
      ) : null}

      {showBanner && !isSettingsOpen && !compactLang ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="cookie-banner-title"
          aria-describedby="cookie-banner-text"
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-slate-950 p-4"
        >
          <div className="container mx-auto px-0 sm:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl text-sm text-slate-300">
                <p id="cookie-banner-title" className="font-semibold text-white">
                  Cookies und Datenschutz
                </p>
                <p id="cookie-banner-text" className="mt-1">
                  Notwendige Cookies halten die Website am Laufen, etwa für die Anmeldung. Mit deiner Einwilligung
                  nutzen wir zusätzlich Google Analytics und Microsoft Clarity zur Analyse sowie Google Ads, um den
                  Erfolg unserer Werbung zu messen und Werbung zu personalisieren. Dabei können Daten in die USA
                  übertragen werden. Du kannst deine Auswahl jederzeit unter &bdquo;Cookie-Einstellungen&ldquo; ändern
                  oder widerrufen, im Footer und im Mitgliederbereich im Profilmenü.{' '}
                  <Link href="/datenschutz" className="text-blue-400 underline hover:text-blue-300">
                    Datenschutzerklärung
                  </Link>
                  {' · '}
                  <Link href="/impressum" className="text-blue-400 underline hover:text-blue-300">
                    Impressum
                  </Link>
                </p>
              </div>
              <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={openSettings}
                  className={`order-last sm:order-none ${settingsButtonClass}`}
                >
                  Einstellungen
                </Button>
                <Button type="button" onClick={handleRejectAll} className={decisionButtonClass}>
                  Alle ablehnen
                </Button>
                <Button type="button" onClick={handleAcceptAll} className={decisionButtonClass}>
                  Alle akzeptieren
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isSettingsOpen ? (
        <CookieSettingsDialog
          initialConsent={consent ?? DEFAULT_CONSENT}
          open={isSettingsOpen}
          onClose={handleClose}
          onSave={saveConsent}
          onAcceptAll={handleAcceptAll}
          onRejectAll={handleRejectAll}
        />
      ) : null}
    </>
  )
}
