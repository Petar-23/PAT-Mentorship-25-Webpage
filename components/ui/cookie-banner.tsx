'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
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

export function CookieBanner() {
  const consent = useCookieConsent()
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
      {showBanner && !isSettingsOpen ? (
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
