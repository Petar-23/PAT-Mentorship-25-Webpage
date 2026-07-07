'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RAIDMAP_CONFIG, type RaidMapLang } from '@/lib/raidmap-config'

const copy = {
  en: {
    title: 'Welcome aboard! 🎉',
    description: 'Your 7-day free trial is running. Here is where you find the indicator on TradingView:',
    steps: [
      'We are granting access to the TradingView username you entered at checkout (usually done within the hour).',
      'On TradingView, open “Indicators” and pick “Invite-only” in the left sidebar — PAT Raid Map appears there.',
      'Manage your username, subscription and invoices anytime in your account area.',
    ],
    accountCta: 'Open my account area',
    docsCta: 'Read the docs',
    imageAlt: 'TradingView indicators dialog with the Invite-only section highlighted',
  },
  de: {
    title: 'Willkommen an Bord! 🎉',
    description: 'Dein 7-Tage-Test läuft. Hier findest du den Indikator auf TradingView:',
    steps: [
      'Wir schalten den TradingView-Usernamen frei, den du im Checkout angegeben hast (meist innerhalb einer Stunde).',
      'Öffne auf TradingView „Indicators“ und wähle links „Invite-only“ — dort erscheint die PAT Raid Map.',
      'Username, Abo und Rechnungen verwaltest du jederzeit in deinem Account-Bereich.',
    ],
    accountCta: 'Zu meinem Account-Bereich',
    docsCta: 'Doku lesen',
    imageAlt: 'TradingView-Indikatoren-Dialog mit hervorgehobenem Invite-only-Bereich',
  },
} as const

export function RaidMapSuccessDialog({ lang, hasGuideImage }: { lang: RaidMapLang; hasGuideImage: boolean }) {
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const t = copy[lang]

  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      setOpen(true)
    }
  }, [searchParams])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t.title}</DialogTitle>
          <DialogDescription className="text-pretty">{t.description}</DialogDescription>
        </DialogHeader>

        {hasGuideImage ? (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <Image
              src={RAIDMAP_CONFIG.guideImagePath}
              alt={t.imageAlt}
              width={1630}
              height={1316}
              sizes="(max-width: 768px) 100vw, 640px"
              className="w-full h-auto"
            />
          </div>
        ) : null}

        <ol className="space-y-2 list-decimal pl-5 text-sm text-gray-600">
          {t.steps.map((step) => (
            <li key={step} className="text-pretty">{step}</li>
          ))}
        </ol>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button asChild>
            <Link href={RAIDMAP_CONFIG.accountPath}>{t.accountCta}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={lang === 'en' ? RAIDMAP_CONFIG.docsPathEn : RAIDMAP_CONFIG.docsPathDe}>{t.docsCta}</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
