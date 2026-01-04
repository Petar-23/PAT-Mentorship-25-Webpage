// src/components/ui/cookie-banner.tsx
'use client'

import React, { useEffect, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useCookieSettings } from "@/lib/cookie-settings"
import Link from "next/link"

interface CookieConsent {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

interface CookieSetting {
  id: keyof CookieConsent;
  title: string;
  description: string;
  required?: boolean;
}

const cookieSettings: CookieSetting[] = [
  {
    id: 'necessary',
    title: 'Notwendige Cookies',
    description: 'Diese Cookies sind für die Grundfunktionen der Website erforderlich.',
    required: true,
  },
  {
    id: 'analytics',
    title: 'Analyse Cookies',
    description: 'Helfen uns zu verstehen, wie Besucher mit der Website interagieren.',
  },
  {
    id: 'marketing',
    title: 'Marketing Cookies',
    description: 'Werden verwendet, um Besuchern relevante Werbung anzuzeigen.',
  },
]

const defaultConsent: CookieConsent = {
  necessary: true,
  analytics: false,
  marketing: false,
}

export function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const { isOpen, openSettings, closeSettings } = useCookieSettings()
  
  // Saved consent state
  const [savedConsent, setSavedConsent] = useState<CookieConsent>(defaultConsent)
  // Temporary state for the dialog
  const [tempConsent, setTempConsent] = useState<CookieConsent>(defaultConsent)

  useEffect(() => {
    // Check if consent was already given
    const storedConsent = localStorage.getItem('cookieConsent')
    if (!storedConsent) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Banner erst nach Client-Hydration anzeigen
      setShowBanner(true)
    } else {
      // Parse stored consent and update both states
      const parsedConsent = JSON.parse(storedConsent) as CookieConsent
      setSavedConsent(parsedConsent)
      setTempConsent(parsedConsent)
    }
  }, [])

  const openSettingsWithSync = () => {
    setTempConsent(savedConsent)
    openSettings()
  }

  const handleAcceptAll = () => {
    const fullConsent = {
      necessary: true,
      analytics: true,
      marketing: true,
    }
    saveConsent(fullConsent)
  }

  const handleAcceptSelected = () => {
    saveConsent(tempConsent)
  }

  const saveConsent = (consentData: CookieConsent) => {
    localStorage.setItem('cookieConsent', JSON.stringify(consentData))
    setSavedConsent(consentData)
    setTempConsent(consentData)
    setShowBanner(false)
    closeSettings()
  }

  const handleClose = () => {
    // Reset temp consent to saved values when closing
    setTempConsent(savedConsent)
    closeSettings()
  }

  return (
    <>
      {/* Simple Banner */}
      {showBanner && !isOpen && (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 p-4 z-50">
          <div className="container mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-white text-sm">
                Diese Website verwendet Cookies, um Ihre Erfahrung zu verbessern.{' '}
                <button 
                  onClick={openSettingsWithSync}
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  Details anzeigen
                </button>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={openSettingsWithSync}
                  className="bg-slate-800 text-white hover:bg-slate-700"
                >
                  Einstellungen
                </Button>
                <Button
                  onClick={handleAcceptAll}
                >
                  Alle akzeptieren
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Settings Dialog */}
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Cookie-Einstellungen</DialogTitle>
            <DialogDescription>
              Wählen Sie aus, welche Cookies Sie akzeptieren möchten. Ihre Auswahl
              können Sie jederzeit in den Datenschutzeinstellungen ändern.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {cookieSettings.map((setting) => (
              <div 
                key={setting.id}
                className="flex flex-row items-center justify-between rounded-lg border p-4"
              >
                <div className="space-y-0.5 pr-4">
                  <Label className="text-base">{setting.title}</Label>
                  <p className="text-sm text-muted-foreground">
                    {setting.description}
                  </p>
                </div>
                <Switch
                  checked={tempConsent[setting.id]}
                  disabled={setting.required}
                  onCheckedChange={(checked) => 
                    setTempConsent(prev => ({ ...prev, [setting.id]: checked }))
                  }
                  aria-label={`Toggle ${setting.title}`}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={handleClose}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleAcceptSelected}
            >
              Auswahl speichern
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground mt-4">
            Weitere Informationen finden Sie in unserer{' '}
            <Link href="/datenschutz" className="text-primary hover:underline">
              Datenschutzerklärung
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}