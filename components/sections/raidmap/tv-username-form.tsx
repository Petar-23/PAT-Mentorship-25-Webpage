'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { claimRaidMapAction } from '@/app/raid-map/account/actions'
import type { RaidMapLang } from '@/lib/raidmap-config'

const copy = {
  en: {
    placeholder: 'Your TradingView username',
    ariaLabel: 'TradingView username',
    pending: 'Requesting…',
    submit: 'Grant / update access',
    hint: 'Changing your username moves access to the new account. The old account loses it.',
  },
  de: {
    placeholder: 'Dein TradingView-Username',
    ariaLabel: 'TradingView-Username',
    pending: 'Wird verarbeitet…',
    submit: 'Zugang freischalten / ändern',
    hint: 'Wenn du den Usernamen änderst, wird der Zugang auf den neuen Account übertragen und beim alten entfernt.',
  },
} as const

export function TvUsernameForm({ initialUsername, lang }: { initialUsername: string; lang: RaidMapLang }) {
  const [username, setUsername] = useState(initialUsername)
  const [message, setMessage] = useState<string | null>(null)
  const [ok, setOk] = useState<boolean | null>(null)
  const [isPending, startTransition] = useTransition()
  const t = copy[lang]

  const submit = () => {
    if (isPending) return
    setMessage(null)
    startTransition(async () => {
      const result = await claimRaidMapAction(username.trim(), lang)
      setOk(result.ok)
      setMessage(result.message)
    })
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t.placeholder}
          aria-label={t.ariaLabel}
          className="sm:max-w-xs"
        />
        <Button onClick={submit} disabled={isPending || username.trim().length < 2}>
          {isPending ? t.pending : t.submit}
        </Button>
      </div>
      <p className="mt-2 text-xs text-gray-500 text-pretty">
        {t.hint}
      </p>
      {message ? (
        <p role={ok ? 'status' : 'alert'} className={`mt-2 text-sm text-pretty ${ok ? 'text-gray-600' : 'text-red-600'}`}>
          {message}
        </p>
      ) : null}
    </div>
  )
}
