'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

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

type CookieSettingsDialogProps = {
  initialConsent: CookieConsent;
  open: boolean;
  onClose: () => void;
  onSave: (consent: CookieConsent) => void;
}

export function CookieSettingsDialog({
  initialConsent,
  open,
  onClose,
  onSave,
}: CookieSettingsDialogProps) {
  const [tempConsent, setTempConsent] = useState(initialConsent)

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
                  setTempConsent((prev) => ({ ...prev, [setting.id]: checked }))
                }
                aria-label={`Toggle ${setting.title}`}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={() => onSave(tempConsent)}>
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
  )
}
