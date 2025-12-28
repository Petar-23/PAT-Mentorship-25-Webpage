'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

type Props = {
  connected: boolean
}

export function DiscordLinkButton({ connected }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const handleConnect = useCallback(() => {
    if (pending) return
    setPending(true)

    // Wir warten einen Tick, damit React den Loading-State rendern kann.
    setTimeout(() => {
      window.location.href = '/api/discord/oauth/start'
    }, 0)
  }, [pending])

  const handleDisconnect = useCallback(async () => {
    if (pending) return
    setPending(true)

    try {
      await fetch('/api/discord/oauth/disconnect', {
        method: 'POST',
        headers: { accept: 'application/json' },
      })
      router.refresh()
    } finally {
      setPending(false)
    }
  }, [pending, router])

  const label = connected ? 'Account trennen' : 'Discord verbinden'
  const pendingLabel = connected ? 'Wird getrennt…' : 'Leite zu Discord weiter…'

  return (
    <Button
      type="button"
      onClick={connected ? handleDisconnect : handleConnect}
      disabled={pending}
      className="h-10 w-full px-3 bg-neutral-900 text-neutral-50 hover:bg-neutral-900/90 dark:bg-neutral-900 dark:text-neutral-50 dark:hover:bg-neutral-900/90"
    >
      {pending ? (
        <>
          <LoadingSpinner className="h-4 w-4" />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  )
}


