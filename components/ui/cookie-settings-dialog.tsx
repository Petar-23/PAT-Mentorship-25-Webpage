'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { CookieConsent } from '@/lib/cookie-consent'

interface CookieSetting {
  id: keyof CookieConsent;
  title: string;
  description: string;
  services: string;
  required?: boolean;
}

const cookieSettings: CookieSetting[] = [
  {
    id: 'necessary',
    title: 'Notwendig',
    description: 'Für Grundfunktionen wie Anmeldung und Sitzung sowie zum Speichern deiner Auswahl. Immer aktiv.',
    services: 'Clerk (Anmeldung), Speicherung deiner Cookie-Auswahl im Browser.',
    required: true,
  },
  {
    id: 'analytics',
    title: 'Analyse',
    description:
      'Hilft uns zu verstehen, welche Seiten genutzt werden und wo es hakt. Clarity erfasst dazu Klicks, Scrollen und Mausbewegungen als Sitzungsaufzeichnung.',
    services:
      'Google Analytics 4 (Google Ireland Ltd.), Cookies _ga und _ga_* bis 2 Jahre. Microsoft Clarity (Microsoft Ireland Operations Ltd.), Cookies _clck bis 1 Jahr und _clsk bis 1 Tag sowie Cookies von Microsoft auf clarity.ms (z. B. MUID und CLID bis 1 Jahr). Übermittlung in die USA möglich.',
  },
  {
    id: 'marketing',
    title: 'Marketing',
    description:
      'Misst, ob eine Anzeige zu einer Anmeldung oder einem Kauf geführt hat, und erlaubt personalisierte Werbung.',
    services:
      'Google Ads (Google Ireland Ltd.), Cookie _gcl_au bis 90 Tage sowie Cookies von Google auf eigenen Domains wie doubleclick.net. Übermittlung in die USA möglich.',
  },
]

type CookieSettingsDialogProps = {
  initialConsent: CookieConsent;
  open: boolean;
  onClose: () => void;
  onSave: (consent: CookieConsent) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

export function CookieSettingsDialog({
  initialConsent,
  open,
  onClose,
  onSave,
  onAcceptAll,
  onRejectAll,
}: CookieSettingsDialogProps) {
  const [tempConsent, setTempConsent] = useState(initialConsent)

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" closeLabel="Schließen">
        <DialogHeader>
          <DialogTitle>Cookie-Einstellungen</DialogTitle>
          <DialogDescription>
            Wähle aus, welche Dienste wir zusätzlich zu den notwendigen nutzen dürfen. Deine Einwilligung kannst
            du jederzeit mit Wirkung für die Zukunft widerrufen, hier oder über &bdquo;Cookie-Einstellungen&ldquo; im
            Footer und im Mitgliederbereich im Profilmenü.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {cookieSettings.map((setting) => (
            <div
              key={setting.id}
              className="flex flex-row items-start justify-between gap-4 rounded-lg border p-4"
            >
              <div className="space-y-1">
                <Label htmlFor={`cookie-consent-${setting.id}`} className="text-base">
                  {setting.title}
                </Label>
                <p className="text-sm text-muted-foreground">{setting.description}</p>
                <p className="text-xs text-muted-foreground">{setting.services}</p>
              </div>
              <Switch
                id={`cookie-consent-${setting.id}`}
                checked={tempConsent[setting.id]}
                disabled={setting.required}
                onCheckedChange={(checked) =>
                  setTempConsent((prev) => ({ ...prev, [setting.id]: checked }))
                }
                aria-label={`${setting.title} zulassen`}
              />
            </div>
          ))}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button type="button" variant="outline" onClick={onRejectAll}>
            Alle ablehnen
          </Button>
          <Button type="button" variant="outline" onClick={onAcceptAll}>
            Alle akzeptieren
          </Button>
          <Button type="button" onClick={() => onSave(tempConsent)}>
            Auswahl speichern
          </Button>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          Mehr dazu in unserer{' '}
          <Link href="/datenschutz" className="text-primary hover:underline">
            Datenschutzerklärung
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}
