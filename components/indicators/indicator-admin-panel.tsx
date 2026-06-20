'use client'

import Image from 'next/image'
import { upload } from '@vercel/blob/client'
import { FormEvent, useMemo, useRef, useState, useTransition } from 'react'
import { ArrowsClockwise } from '@phosphor-icons/react/ArrowsClockwise'
import { Database } from '@phosphor-icons/react/Database'
import { ImageSquare } from '@phosphor-icons/react/ImageSquare'
import { Key } from '@phosphor-icons/react/Key'
import { Play } from '@phosphor-icons/react/Play'
import { UploadSimple } from '@phosphor-icons/react/UploadSimple'
import { WarningCircle } from '@phosphor-icons/react/WarningCircle'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type {
  AdminIndicatorOverview,
  Indicator,
  IndicatorPackage,
} from '@/lib/indicators/types'
import {
  clearTradingViewCookieAction,
  createIndicatorAction,
  createIndicatorPackageAction,
  importTradingViewIndicatorsAction,
  processTradingViewQueueAction,
  resetTradingViewAccountAction,
  saveTradingViewCookieAction,
  updateIndicatorAction,
  updateIndicatorImageAction,
  updateIndicatorPackageAction,
  type IndicatorActionResult,
} from '@/app/mentorship/indicators/actions'
import { IndicatorStatusPill } from '@/components/indicators/status-pill'

type Props = {
  overview: AdminIndicatorOverview
}

type FormAction = (formData: FormData) => Promise<IndicatorActionResult>

function Select({
  name,
  defaultValue,
  packages,
  includeEmpty = true,
}: {
  name: string
  defaultValue?: string | null
  packages: IndicatorPackage[]
  includeEmpty?: boolean
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ''}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {includeEmpty ? <option value="">Ohne Package</option> : null}
      {packages.map((pkg) => (
        <option key={pkg.id} value={pkg.id}>
          {pkg.name}
        </option>
      ))}
    </select>
  )
}

function CheckboxField({
  name,
  label,
  defaultChecked,
}: {
  name: string
  label: string
  defaultChecked?: boolean
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-gray-300"
      />
      <span>{label}</span>
    </label>
  )
}

function ActionMessage({ result }: { result: IndicatorActionResult | null }) {
  if (!result) return null

  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2 text-sm',
        result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'
      )}
    >
      {result.message}
    </div>
  )
}

export function IndicatorAdminPanel({ overview }: Props) {
  const [result, setResult] = useState<IndicatorActionResult | null>(null)
  const [isPending, startTransition] = useTransition()
  const [uploadingIndicatorId, setUploadingIndicatorId] = useState<string | null>(null)
  const cookieFormRef = useRef<HTMLFormElement | null>(null)

  const allIndicators = useMemo(() => {
    return [
      ...overview.packages.flatMap((pkg) => pkg.indicators),
      ...overview.unassignedIndicators,
    ].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  }, [overview.packages, overview.unassignedIndicators])

  function submitForm(event: FormEvent<HTMLFormElement>, action: FormAction, resetOnSuccess = false) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)

    setResult(null)
    startTransition(async () => {
      const response = await action(formData)
      setResult(response)
      if (response.ok && resetOnSuccess) form.reset()
    })
  }

  function saveCookie(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const cookie = String(formData.get('cookie') ?? '')

    setResult(null)
    startTransition(async () => {
      const response = await saveTradingViewCookieAction(cookie)
      setResult(response)
      if (response.ok) cookieFormRef.current?.reset()
    })
  }

  function clearCookie() {
    setResult(null)
    startTransition(async () => {
      setResult(await clearTradingViewCookieAction())
    })
  }

  function processQueue() {
    setResult(null)
    startTransition(async () => {
      setResult(await processTradingViewQueueAction())
    })
  }

  async function uploadImage(indicator: Indicator, file: File | null) {
    if (!file) return
    setUploadingIndicatorId(indicator.id)
    setResult(null)

    try {
      const blob = await upload(`indicator-images/${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/indicator-image-upload',
      })
      const response = await updateIndicatorImageAction({ id: indicator.id, imageUrl: blob.url })
      setResult(response)
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : 'Bild-Upload fehlgeschlagen.',
      })
    } finally {
      setUploadingIndicatorId(null)
    }
  }

  function removeImage(indicatorId: string) {
    setResult(null)
    startTransition(async () => {
      setResult(await updateIndicatorImageAction({ id: indicatorId, imageUrl: null }))
    })
  }

  function resetAccount(userId: string) {
    setResult(null)
    startTransition(async () => {
      setResult(await resetTradingViewAccountAction(userId))
    })
  }

  const queue = overview.claimQueue

  return (
    <div className="space-y-6">
      <ActionMessage result={result} />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-balance">
              <Key className="h-4 w-4" />
              TradingView Cookie
            </CardTitle>
            <CardDescription className="text-pretty">
              Speichert die TradingView-Session direkt für diesen Indikatoren-Workflow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Status</span>
                <span className={cn('font-medium', queue.session.ok ? 'text-emerald-700' : 'text-orange-700')}>
                  {queue.session.ok ? 'Verbunden' : queue.session.configured ? 'Prüfen nötig' : 'Nicht gespeichert'}
                </span>
              </div>
              {overview.tradingViewSession.preview ? (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {overview.tradingViewSession.preview}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground text-pretty">{queue.session.message}</p>
            </div>

            <form ref={cookieFormRef} onSubmit={saveCookie} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="tradingview-cookie">Cookie oder sessionid</Label>
                <Textarea
                  id="tradingview-cookie"
                  name="cookie"
                  rows={4}
                  placeholder="sessionid=...; sessionid_sign=..."
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" disabled={isPending} className="w-full">
                  Speichern & testen
                </Button>
                <Button type="button" variant="outline" disabled={isPending} onClick={clearCookie}>
                  Entfernen
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-balance">
              <Database className="h-4 w-4" />
              Queue
            </CardTitle>
            <CardDescription>Claims manuell an TradingView senden.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Metric label="Pending" value={queue.pending} />
              <Metric label="Needs Session" value={queue.needsSession} />
              <Metric label="Granted" value={queue.granted} />
              <Metric label="Failed" value={queue.failed} />
            </div>
            <Button type="button" onClick={processQueue} disabled={isPending} className="w-full">
              <Play className="mr-2 h-4 w-4" />
              Queue verarbeiten
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-balance">
              <ArrowsClockwise className="h-4 w-4" />
              TradingView Import
            </CardTitle>
            <CardDescription>Eigene Pine Scripts importieren und danach sichtbar schalten.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(event) => submitForm(event, importTradingViewIndicatorsAction)}
            >
              <div className="space-y-2">
                <Label>Package</Label>
                <Select name="packageId" packages={overview.packages} />
              </div>
              <Button type="submit" disabled={isPending} className="w-full">
                Import starten
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Neues Package</CardTitle>
            <CardDescription>Gruppiert Indikatoren für die Member-Ansicht.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(event) => submitForm(event, createIndicatorPackageAction, true)}
            >
              <Input name="name" placeholder="Package Name" required />
              <Textarea name="description" placeholder="Kurze Beschreibung" rows={3} />
              <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                <CheckboxField name="visible" label="Sichtbar" defaultChecked />
                <Input name="sortOrder" type="number" defaultValue="0" />
              </div>
              <Button type="submit" disabled={isPending}>Package erstellen</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Neuer Indikator</CardTitle>
            <CardDescription>Manuell anlegen, falls kein Import genutzt wird.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(event) => submitForm(event, createIndicatorAction, true)}
            >
              <Select name="packageId" packages={overview.packages} />
              <Input name="name" placeholder="Indikator Name" required />
              <Input name="pineId" placeholder="PUB;..." />
              <Input name="shortDescription" placeholder="Kurzbeschreibung" />
              <Textarea name="detailDescription" placeholder="Beschreibung für Mentees" rows={3} />
              <Textarea
                name="usageGuide"
                placeholder="Markdown-Anleitung: Einstellungen, Werte, Interpretation"
                rows={5}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <CheckboxField name="ready" label="Claimbar" />
                <CheckboxField name="visible" label="Sichtbar" />
                <Input name="sortOrder" type="number" defaultValue="99" />
              </div>
              <Button type="submit" disabled={isPending}>Indikator erstellen</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-balance">Packages & Indikatoren</h2>
          <p className="text-sm text-muted-foreground text-pretty">
            Sichtbarkeit und Claimbarkeit werden getrennt gesteuert.
          </p>
        </div>

        {overview.packages.map((pkg) => (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            packages={overview.packages}
            allIndicators={pkg.indicators}
            isPending={isPending}
            uploadingIndicatorId={uploadingIndicatorId}
            submitForm={submitForm}
            uploadImage={uploadImage}
            removeImage={removeImage}
          />
        ))}

        {overview.unassignedIndicators.length > 0 ? (
          <PackageCard
            pkg={{
              id: '',
              slug: 'unassigned',
              name: 'Ohne Package',
              description: 'Noch keiner Gruppe zugeordnet.',
              sortOrder: 999,
              visible: false,
              indicators: overview.unassignedIndicators,
            }}
            packages={overview.packages}
            allIndicators={overview.unassignedIndicators}
            isPending={isPending}
            uploadingIndicatorId={uploadingIndicatorId}
            submitForm={submitForm}
            uploadImage={uploadImage}
            removeImage={removeImage}
            readonlyPackage
          />
        ) : null}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Account Locks</CardTitle>
          <CardDescription>TradingView-Usernames sind pro Mitglied eindeutig gesperrt.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {overview.tradingViewAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine TradingView-Verknüpfungen.</p>
          ) : (
            overview.tradingViewAccounts.map((account) => (
              <div key={account.userId} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">@{account.tvUsername}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {account.email ?? account.userId} · {account.grantedCount}/{account.claimCount} granted
                  </p>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                      Lock zurücksetzen
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>TradingView-Lock zurücksetzen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Alle Claims dieses Users werden als zurückgesetzt markiert. Wenn ein TradingView-Cookie gültig ist,
                        versucht PAT vorher die aktiven Freigaben zu entfernen.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction onClick={() => resetAccount(account.userId)}>
                        Zurücksetzen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Letzte Claims</CardTitle>
          <CardDescription>Status der jüngsten Queue-Einträge.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {queue.recentClaims.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Claims.</p>
          ) : (
            queue.recentClaims.map((claim) => (
              <div key={claim.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{claim.indicatorName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{claim.tvUsername} · {claim.userId}
                  </p>
                </div>
                <IndicatorStatusPill status={claim.status} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function PackageCard({
  pkg,
  packages,
  allIndicators,
  isPending,
  uploadingIndicatorId,
  submitForm,
  uploadImage,
  removeImage,
  readonlyPackage = false,
}: {
  pkg: IndicatorPackage
  packages: IndicatorPackage[]
  allIndicators: Indicator[]
  isPending: boolean
  uploadingIndicatorId: string | null
  submitForm: (event: FormEvent<HTMLFormElement>, action: FormAction, resetOnSuccess?: boolean) => void
  uploadImage: (indicator: Indicator, file: File | null) => Promise<void>
  removeImage: (indicatorId: string) => void
  readonlyPackage?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{pkg.name}</CardTitle>
        <CardDescription>{pkg.description || 'Keine Beschreibung.'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!readonlyPackage ? (
          <form
            className="grid gap-3 lg:grid-cols-[1fr_1fr_120px_120px_auto]"
            onSubmit={(event) => submitForm(event, updateIndicatorPackageAction)}
          >
            <input type="hidden" name="id" value={pkg.id} />
            <Input name="name" defaultValue={pkg.name} required />
            <Input name="description" defaultValue={pkg.description} placeholder="Beschreibung" />
            <Input name="sortOrder" type="number" defaultValue={pkg.sortOrder} />
            <CheckboxField name="visible" label="Sichtbar" defaultChecked={pkg.visible} />
            <Button type="submit" disabled={isPending}>Speichern</Button>
          </form>
        ) : null}

        <div className="space-y-3">
          {allIndicators.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Indikatoren in diesem Package.</p>
          ) : (
            allIndicators.map((indicator) => (
              <IndicatorEditor
                key={indicator.id}
                indicator={indicator}
                packages={packages}
                isPending={isPending}
                uploading={uploadingIndicatorId === indicator.id}
                submitForm={submitForm}
                uploadImage={uploadImage}
                removeImage={removeImage}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function IndicatorEditor({
  indicator,
  packages,
  isPending,
  uploading,
  submitForm,
  uploadImage,
  removeImage,
}: {
  indicator: Indicator
  packages: IndicatorPackage[]
  isPending: boolean
  uploading: boolean
  submitForm: (event: FormEvent<HTMLFormElement>, action: FormAction, resetOnSuccess?: boolean) => void
  uploadImage: (indicator: Indicator, file: File | null) => Promise<void>
  removeImage: (indicatorId: string) => void
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="grid gap-4 xl:grid-cols-[180px_1fr]">
        <div className="space-y-3">
          <div className="relative aspect-[16/10] overflow-hidden rounded-md border bg-muted/30">
            {indicator.imageUrl ? (
              <Image src={indicator.imageUrl} alt={indicator.name} fill sizes="180px" className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <ImageSquare className="h-8 w-8" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`image-${indicator.id}`} className="sr-only">
              Preview-Bild
            </Label>
            <Input
              id={`image-${indicator.id}`}
              type="file"
              accept="image/*"
              disabled={uploading || isPending}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null
                void uploadImage(indicator, file)
                event.currentTarget.value = ''
              }}
            />
            <div className="flex gap-2">
              <Label
                htmlFor={`image-${indicator.id}`}
                className={cn(
                  'inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                  (uploading || isPending) && 'pointer-events-none opacity-50'
                )}
              >
                <UploadSimple className="mr-2 h-4 w-4" />
                {uploading ? 'Upload...' : 'Bild'}
              </Label>
              {indicator.imageUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={uploading || isPending}
                  onClick={() => removeImage(indicator.id)}
                >
                  Entfernen
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <form className="space-y-3" onSubmit={(event) => submitForm(event, updateIndicatorAction)}>
          <input type="hidden" name="id" value={indicator.id} />

          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_120px]">
            <Input name="name" defaultValue={indicator.name} required />
            <Select name="packageId" packages={packages} defaultValue={indicator.packageId} />
            <Input name="sortOrder" type="number" defaultValue={indicator.sortOrder} />
          </div>

          <Input name="pineId" defaultValue={indicator.pineId} placeholder="PUB;..." />
          <Input name="shortDescription" defaultValue={indicator.shortDescription} placeholder="Kurzbeschreibung" />
          <Textarea name="detailDescription" defaultValue={indicator.detailDescription} rows={3} />
          <Textarea
            name="usageGuide"
            defaultValue={indicator.usageGuide}
            placeholder="Markdown-Anleitung: Einstellungen, Werte, Interpretation"
            rows={5}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <CheckboxField name="ready" label="Claimbar" defaultChecked={indicator.ready} />
              <CheckboxField name="visible" label="Sichtbar" defaultChecked={indicator.visible} />
              {!indicator.ready || !indicator.visible || !indicator.pineId ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  <WarningCircle className="h-3.5 w-3.5" />
                  Nicht claimbar
                </span>
              ) : null}
            </div>
            <Button type="submit" disabled={isPending || uploading}>
              Indikator speichern
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
