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
import { IndicatorUsageGuide } from '@/components/indicators/indicator-usage-guide'
import type {
  Indicator,
  IndicatorClaim,
  IndicatorClaimStatus,
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

type MemberIndicatorFilter = 'all' | 'claimable' | 'active' | 'queued' | 'needsAction'

const MEMBER_FILTERS: Array<{ value: MemberIndicatorFilter; label: string }> = [
  { value: 'all', label: 'Alle' },
  { value: 'claimable', label: 'Claimbar' },
  { value: 'active', label: 'Aktiv' },
  { value: 'queued', label: 'In Queue' },
  { value: 'needsAction', label: 'Prüfen' },
]

const QUEUED_CLAIM_STATUSES = new Set<IndicatorClaimStatus>(['pending', 'processing', 'needs_session'])

function isIndicatorClaimable(indicator: Indicator) {
  return indicator.ready && indicator.pineId.startsWith('PUB;')
}

function matchesMemberFilter(
  indicator: Indicator,
  claimState: IndicatorClaim | undefined,
  filter: MemberIndicatorFilter
) {
  const claimable = isIndicatorClaimable(indicator)

  if (filter === 'all') return true
  if (filter === 'claimable') return claimable && claimState?.status !== 'granted'
  if (filter === 'active') return claimState?.status === 'granted'
  if (filter === 'queued') return claimState ? QUEUED_CLAIM_STATUSES.has(claimState.status) : false
  if (filter === 'needsAction') return !claimable || claimState?.status === 'failed'

  return true
}

function AvailabilityPill({ claimable }: { claimable: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        claimable
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-amber-200 bg-amber-50 text-amber-800'
      )}
    >
      {claimable ? 'Claimbar' : 'In Vorbereitung'}
    </span>
  )
}

export function IndicatorMemberBoard({ packages, claims, tradingViewAccount }: Props) {
  const [tvUsername, setTvUsername] = useState(tradingViewAccount?.tvUsername ?? '')
  const [activeIndicatorId, setActiveIndicatorId] = useState<string | null>(null)
  const [result, setResult] = useState<IndicatorActionResult | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [packageFilter, setPackageFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<MemberIndicatorFilter>('all')
  const [isPending, startTransition] = useTransition()

  const claimsByIndicatorId = useMemo(() => {
    return new Map(claims.map((claim) => [claim.indicatorId, claim]))
  }, [claims])

  const totalIndicators = useMemo(
    () => packages.reduce((sum, pkg) => sum + pkg.indicators.length, 0),
    [packages]
  )

  const filteredPackages = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return packages
      .filter((pkg) => packageFilter === 'all' || pkg.id === packageFilter)
      .map((pkg) => ({
        ...pkg,
        indicators: pkg.indicators.filter((indicator) => {
          const claimState = claimsByIndicatorId.get(indicator.id)
          const searchableText = [
            pkg.name,
            indicator.name,
            indicator.slug,
            indicator.shortDescription,
            indicator.detailDescription,
          ]
            .join(' ')
            .toLowerCase()

          return (
            (!normalizedSearch || searchableText.includes(normalizedSearch)) &&
            matchesMemberFilter(indicator, claimState, statusFilter)
          )
        }),
      }))
      .filter((pkg) => pkg.indicators.length > 0)
  }, [claimsByIndicatorId, packageFilter, packages, searchTerm, statusFilter])

  const filteredIndicatorCount = useMemo(
    () => filteredPackages.reduce((sum, pkg) => sum + pkg.indicators.length, 0),
    [filteredPackages]
  )

  const hasIndicators = totalIndicators > 0
  const hasFilteredIndicators = filteredIndicatorCount > 0
  const lockedUsername = tradingViewAccount?.tvUsername ?? null
  const hasTvUsername = tvUsername.trim().length >= 2

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
        <>
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_240px]">
                <div className="space-y-2">
                  <Label htmlFor="indicator-search">Indikator suchen</Label>
                  <Input
                    id="indicator-search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="z. B. Raid Map"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="indicator-package-filter">Bereich</Label>
                  <select
                    id="indicator-package-filter"
                    value={packageFilter}
                    onChange={(event) => setPackageFilter(event.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="all">Alle Bereiche</option>
                    {packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {MEMBER_FILTERS.map((filter) => (
                  <Button
                    key={filter.value}
                    type="button"
                    size="sm"
                    variant={statusFilter === filter.value ? 'default' : 'outline'}
                    onClick={() => setStatusFilter(filter.value)}
                  >
                    {filter.label}
                  </Button>
                ))}
                <span className="ml-auto text-xs text-muted-foreground">
                  {filteredIndicatorCount}/{totalIndicators}
                </span>
              </div>
            </CardContent>
          </Card>

          {!hasFilteredIndicators ? (
            <Card>
              <CardHeader>
                <CardTitle>Keine Treffer</CardTitle>
                <CardDescription>
                  Passe Suche oder Filter an, um weitere Indikatoren zu sehen.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          {filteredPackages.map((pkg) => (
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
                  const claimable = isIndicatorClaimable(indicator)
                  const claimQueued = claimState ? QUEUED_CLAIM_STATUSES.has(claimState.status) : false
                  const canClaim = claimable && !claimQueued && claimState?.status !== 'granted'
                  const buttonLabel =
                    claimState?.status === 'granted'
                      ? 'Bereits aktiv'
                      : claimState?.status === 'processing'
                        ? 'Wird aktiviert'
                        : claimState?.status === 'pending'
                          ? 'In Queue'
                          : claimState?.status === 'needs_session'
                            ? 'Session wird aktualisiert'
                            : isBusy
                              ? 'Wird gespeichert...'
                              : !claimable
                                ? 'In Vorbereitung'
                                : !hasTvUsername
                                  ? 'TradingView Namen eintragen'
                                  : claimState?.status === 'failed'
                                    ? 'Erneut versuchen'
                                    : 'Indikator claimen'

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
                          {claimState ? (
                            <IndicatorStatusPill status={claimState.status} />
                          ) : (
                            <AvailabilityPill claimable={claimable} />
                          )}
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
                            <IndicatorUsageGuide content={indicator.usageGuide} className="mt-3" />
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
                          disabled={!canClaim || isBusy || !hasTvUsername}
                          onClick={() => claim(indicator.id)}
                        >
                          {buttonLabel}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
