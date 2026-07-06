// src/components/ui/cookie-banner.tsx
'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

interface CookieConsent {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

const defaultConsent: CookieConsent = {
  necessary: true,
  analytics: false,
  marketing: false,
}

const CookieSettingsDialog = dynamic(
  () => import('@/components/ui/cookie-settings-dialog').then((mod) => mod.CookieSettingsDialog),
  { ssr: false }
)

function readStoredConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null

  try {
    const storedConsent = localStorage.getItem('cookieConsent')
    if (!storedConsent) return null

    const parsedConsent = JSON.parse(storedConsent) as Partial<CookieConsent>
    if (typeof parsedConsent.necessary !== 'boolean') return null

    return {
      necessary: true,
      analytics: parsedConsent.analytics === true,
      marketing: parsedConsent.marketing === true,
    }
  } catch {
    return null
  }
}

export function CookieBanner() {
  const [{ savedConsent, showBanner }, setConsentState] = useState(() => {
    const storedConsent = readStoredConsent()
    return {
      savedConsent: storedConsent ?? defaultConsent,
      showBanner: !storedConsent,
    }
  })
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const openSettings = useCallback(() => {
    setIsSettingsOpen(true)
  }, [])

  useEffect(() => {
    window.addEventListener('openCookieSettings', openSettings)
    return () => window.removeEventListener('openCookieSettings', openSettings)
  }, [openSettings])

  const saveConsent = useCallback((consentData: CookieConsent) => {
    localStorage.setItem('cookieConsent', JSON.stringify(consentData))
    setConsentState({
      savedConsent: consentData,
      showBanner: false,
    })
    setIsSettingsOpen(false)

    // Benachrichtige andere Komponenten (z.B. GTM) über die Consent-Änderung.
    window.dispatchEvent(new CustomEvent('cookieConsentChanged'))
  }, [])

  const handleAcceptAll = useCallback(() => {
    saveConsent({
      necessary: true,
      analytics: true,
      marketing: true,
    })
  }, [saveConsent])

  const handleClose = useCallback(() => {
    setIsSettingsOpen(false)
  }, [])

  return (
    <>
      {showBanner && !isSettingsOpen ? (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 p-4 z-50">
          <div className="container mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-white text-sm">
                Diese Website verwendet Cookies, um Ihre Erfahrung zu verbessern.{' '}
                <button
                  onClick={openSettings}
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  Details anzeigen
                </button>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={openSettings}
                  className="bg-slate-800 text-white hover:bg-slate-700"
                >
                  Einstellungen
                </Button>
                <Button onClick={handleAcceptAll}>
                  Alle akzeptieren
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isSettingsOpen ? (
        <CookieSettingsDialog
          initialConsent={savedConsent}
          open={isSettingsOpen}
          onClose={handleClose}
          onSave={saveConsent}
        />
      ) : null}
    </>
  )
}
