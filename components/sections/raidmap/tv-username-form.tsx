'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { claimRaidMapAction } from '@/app/raid-map/account/actions'

export function TvUsernameForm({ initialUsername }: { initialUsername: string }) {
  const [username, setUsername] = useState(initialUsername)
  const [message, setMessage] = useState<string | null>(null)
  const [ok, setOk] = useState<boolean | null>(null)
  const [isPending, startTransition] = useTransition()

  const submit = () => {
    if (isPending) return
    setMessage(null)
    startTransition(async () => {
      const result = await claimRaidMapAction(username.trim())
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
          placeholder="Your TradingView username"
          aria-label="TradingView username"
          className="sm:max-w-xs"
        />
        <Button onClick={submit} disabled={isPending || username.trim().length < 2}>
          {isPending ? 'Requesting…' : 'Grant / update access'}
        </Button>
      </div>
      {message ? (
        <p role={ok ? 'status' : 'alert'} className={`mt-2 text-sm text-pretty ${ok ? 'text-gray-600' : 'text-red-600'}`}>
          {message}
        </p>
      ) : null}
    </div>
  )
}
