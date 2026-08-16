// src/components/ui/cookie-banner.tsx
'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useCookieConsent } from '@/hooks/use-cookie-consent'
import {
  saveCookieConsent,
  subscribeCookieSettingsRequest,
  type CookieConsent,
} from '@/lib/cookie-settings'

const CookieSettingsDialog = dynamic(
  () => import('@/components/ui/cookie-settings-dialog').then((mod) => mod.CookieSettingsDialog),
  { ssr: false }
)

export function CookieBanner() {
  const { consent, hasSavedConsent } = useCookieConsent()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const openSettings = useCallback(() => {
    setIsSettingsOpen(true)
  }, [])

  useEffect(() => {
    return subscribeCookieSettingsRequest(openSettings)
  }, [openSettings])

  const saveConsent = useCallback((consentData: CookieConsent) => {
    saveCookieConsent(consentData)
    setIsSettingsOpen(false)
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
      {!hasSavedConsent && !isSettingsOpen ? (
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
          initialConsent={consent}
          open={isSettingsOpen}
          onClose={handleClose}
          onSave={saveConsent}
        />
      ) : null}
    </>
  )
}
