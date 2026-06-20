'use client'

import Image from 'next/image'
import { useMemo, useState, useTransition } from 'react'
import { ArrowRight } from '@phosphor-icons/react/ArrowRight'
import { CheckCircle } from '@phosphor-icons/react/CheckCircle'
import { WarningCircle } from '@phosphor-icons/react/WarningCircle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type {
  IndicatorClaim,
  IndicatorPackage,
  TradingViewAccountBinding,
} from '@/lib/indicators/types'
import { claimIndicatorAction, type IndicatorActionResult } from '@/app/mentorship/indicators/actions'
import { IndicatorStatusPill } from '@/components/indicators/status-pill'

type Props = {
  packages: IndicatorPackage[]
  claims: IndicatorClaim[]
  tradingViewAccount: TradingViewAccountBinding | null
}

export function IndicatorMemberBoard({ packages, claims, tradingViewAccount }: Props) {
  const [tvUsername, setTvUsername] = useState(tradingViewAccount?.tvUsername ?? '')
  const [activeIndicatorId, setActiveIndicatorId] = useState<string | null>(null)
  const [result, setResult] = useState<IndicatorActionResult | null>(null)
  const [isPending, startTransition] = useTransition()

  const claimsByIndicatorId = useMemo(() => {
    return new Map(claims.map((claim) => [claim.indicatorId, claim]))
  }, [claims])

  const hasIndicators = packages.some((pkg) => pkg.indicators.length > 0)
  const lockedUsername = tradingViewAccount?.tvUsername ?? null

  function claim(indicatorId: string) {
    setResult(null)
    setActiveIndicatorId(indicatorId)
    startTransition(async () => {
      const response = await claimIndicatorAction({ indicatorId, tvUsername })
      setResult(response)
      setActiveIndicatorId(null)
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-balance">TradingView Account</CardTitle>
          <CardDescription className="text-pretty">
            Dein Benutzername wird beim ersten Claim fest mit deinem Member-Account verbunden.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="tv-username">TradingView Benutzername</Label>
              <Input
                id="tv-username"
                value={tvUsername}
                onChange={(event) => setTvUsername(event.target.value)}
                placeholder="z. B. petar_trading"
                disabled={Boolean(lockedUsername)}
              />
            </div>

            {lockedUsername ? (
              <div className="inline-flex h-10 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm text-emerald-800">
                <CheckCircle className="h-4 w-4" />
                @{lockedUsername}
              </div>
            ) : null}
          </div>

          {result ? (
            <div
              className={cn(
                'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
                result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'
              )}
            >
              {result.ok ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <WarningCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              <span className="text-pretty">{result.message}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {!hasIndicators ? (
        <Card>
          <CardHeader>
            <CardTitle>Noch keine Indikatoren</CardTitle>
            <CardDescription>
              Sobald Indikatoren freigegeben wurden, erscheinen sie hier zum Claim.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        packages.map((pkg) => (
          <section key={pkg.id} className="space-y-3">
            <div>
              <h2 className="text-xl font-semibold text-balance">{pkg.name}</h2>
              {pkg.description ? (
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground text-pretty">{pkg.description}</p>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pkg.indicators.map((indicator) => {
                const claimState = claimsByIndicatorId.get(indicator.id)
                const isBusy = isPending && activeIndicatorId === indicator.id
                const canClaim = indicator.ready && indicator.pineId && claimState?.status !== 'granted'

                return (
                  <Card key={indicator.id} className="overflow-hidden">
                    {indicator.imageUrl ? (
                      <div className="relative aspect-[16/9] bg-muted">
                        <Image
                          src={indicator.imageUrl}
                          alt={indicator.name}
                          fill
                          sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 90vw"
                          className="object-cover"
                        />
                      </div>
                    ) : null}

                    <CardHeader className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="text-base text-balance">{indicator.name}</CardTitle>
                        {claimState ? <IndicatorStatusPill status={claimState.status} /> : null}
                      </div>
                      {indicator.shortDescription ? (
                        <CardDescription className="text-pretty">{indicator.shortDescription}</CardDescription>
                      ) : null}
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {indicator.detailDescription ? (
                        <p className="text-sm text-muted-foreground text-pretty">{indicator.detailDescription}</p>
                      ) : null}

                      {indicator.usageGuide ? (
                        <details className="group rounded-md border bg-muted/20 px-3 py-2">
                          <summary className="cursor-pointer select-none text-sm font-medium">
                            Anleitung
                          </summary>
                          <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground text-pretty">
                            {indicator.usageGuide}
                          </div>
                        </details>
                      ) : null}

                      {claimState?.errorMessage ? (
                        <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground text-pretty">
                          {claimState.errorMessage}
                        </p>
                      ) : null}

                      <Button
                        type="button"
                        className="w-full"
                        variant={claimState?.status === 'granted' ? 'secondary' : 'default'}
                        disabled={!canClaim || isBusy || tvUsername.trim().length < 2}
                        onClick={() => claim(indicator.id)}
                      >
                        {claimState?.status === 'granted'
                          ? 'Bereits aktiv'
                          : isBusy
                            ? 'Wird gespeichert...'
                            : 'Indikator claimen'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
