'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { getIsAdmin } from '@/lib/authz'
import {
  claimIndicatorForUser,
  clearTradingViewCookie,
  createIndicator,
  createIndicatorPackage,
  importTradingViewIndicators,
  processTradingViewClaimInstantly,
  processTradingViewClaimQueue,
  resetTradingViewAccountBinding,
  saveTradingViewCookie,
  updateIndicator,
  updateIndicatorImage,
  updateIndicatorPackage,
} from '@/lib/indicators/store'

export type IndicatorActionResult = {
  ok: boolean
  message: string
}

function boolFromForm(value: FormDataEntryValue | null) {
  return value === 'on' || value === 'true' || value === '1'
}

function nullableStringFromForm(value: FormDataEntryValue | null) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length > 0 ? text : null
}

function numberFromForm(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number.parseInt(typeof value === 'string' ? value : '', 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

async function requireAdminAction() {
  const { userId, sessionClaims } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const isAdmin = await getIsAdmin(userId, sessionClaims)
  if (!isAdmin) throw new Error('Forbidden')

  return { userId }
}

function revalidateIndicators() {
  revalidatePath('/mentorship/indicators')
}

async function processClaimInstantly(input: {
  userId: string
  indicatorId: string
  fallbackMessage: string
}) {
  try {
    const claim = await processTradingViewClaimInstantly({
      userId: input.userId,
      indicatorId: input.indicatorId,
      workerId: 'member-claim-instant',
    })

    if (claim.status === 'granted') {
      return {
        ok: true,
        message: 'Deine TradingView-Freigabe wurde direkt aktiviert.',
      }
    }

    if (claim.blockedBySession) {
      return {
        ok: true,
        message:
          'Deine Anfrage ist gespeichert. Wir müssen die TradingView-Verbindung aktualisieren, danach wird automatisch erneut versucht.',
      }
    }

    if (claim.status === 'processing') {
      return {
        ok: true,
        message: 'Deine Anfrage ist gespeichert. Die TradingView-Freigabe wird gerade verarbeitet.',
      }
    }

    if (claim.status === 'failed') {
      return {
        ok: true,
        message:
          claim.errorMessage ??
          'TradingView konnte die Aktivierung noch nicht abschließen. Wir versuchen es automatisch erneut.',
      }
    }

    return {
      ok: true,
      message: claim.errorMessage ?? input.fallbackMessage,
    }
  } catch (error) {
    console.error('[tradingview-claims] Instant processing failed:', error)
    return {
      ok: true,
      message: input.fallbackMessage,
    }
  }
}

export async function claimIndicatorAction(input: {
  indicatorId: string
  tvUsername: string
}): Promise<IndicatorActionResult> {
  const { userId } = await auth()
  if (!userId) return { ok: false, message: 'Bitte melde dich erneut an.' }

  const result = await claimIndicatorForUser({
    userId,
    indicatorId: input.indicatorId,
    tvUsername: input.tvUsername,
  })

  if (result.ok && result.claimStatus !== 'granted') {
    const instantResult = await processClaimInstantly({
      userId,
      indicatorId: input.indicatorId,
      fallbackMessage: result.message,
    })
    revalidateIndicators()
    return instantResult
  }

  revalidateIndicators()
  return { ok: result.ok, message: result.message }
}

export async function saveTradingViewCookieAction(cookie: string): Promise<IndicatorActionResult> {
  const { userId } = await requireAdminAction()

  try {
    const result = await saveTradingViewCookie({ cookie, savedBy: userId })
    revalidateIndicators()
    return {
      ok: result.success,
      message: result.success ? 'TradingView-Cookie gespeichert und geprüft.' : result.message,
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Speichern fehlgeschlagen.' }
  }
}

export async function clearTradingViewCookieAction(): Promise<IndicatorActionResult> {
  await requireAdminAction()
  await clearTradingViewCookie()
  revalidateIndicators()
  return { ok: true, message: 'TradingView-Cookie entfernt.' }
}

export async function processTradingViewQueueAction(): Promise<IndicatorActionResult> {
  await requireAdminAction()

  const result = await processTradingViewClaimQueue({ limit: 25, workerId: 'admin-tab-manual' })
  revalidateIndicators()
  return { ok: !result.blockedBySession, message: result.message }
}

export async function importTradingViewIndicatorsAction(formData: FormData): Promise<IndicatorActionResult> {
  await requireAdminAction()

  try {
    const result = await importTradingViewIndicators(nullableStringFromForm(formData.get('packageId')))
    revalidateIndicators()
    return {
      ok: true,
      message: `${result.imported} importiert, ${result.skipped} übersprungen (${result.total} gefunden).`,
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Import fehlgeschlagen.' }
  }
}

export async function createIndicatorPackageAction(formData: FormData): Promise<IndicatorActionResult> {
  await requireAdminAction()

  try {
    await createIndicatorPackage({
      name: String(formData.get('name') ?? ''),
      description: String(formData.get('description') ?? ''),
      visible: boolFromForm(formData.get('visible')),
      sortOrder: numberFromForm(formData.get('sortOrder')),
    })
    revalidateIndicators()
    return { ok: true, message: 'Package erstellt.' }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Package konnte nicht erstellt werden.' }
  }
}

export async function updateIndicatorPackageAction(formData: FormData): Promise<IndicatorActionResult> {
  await requireAdminAction()

  try {
    const id = nullableStringFromForm(formData.get('id'))
    if (!id) throw new Error('Package ID fehlt.')

    await updateIndicatorPackage(id, {
      name: String(formData.get('name') ?? ''),
      description: String(formData.get('description') ?? ''),
      visible: boolFromForm(formData.get('visible')),
      sortOrder: numberFromForm(formData.get('sortOrder')),
    })
    revalidateIndicators()
    return { ok: true, message: 'Package gespeichert.' }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Package konnte nicht gespeichert werden.' }
  }
}

export async function createIndicatorAction(formData: FormData): Promise<IndicatorActionResult> {
  await requireAdminAction()

  try {
    await createIndicator({
      packageId: nullableStringFromForm(formData.get('packageId')),
      name: String(formData.get('name') ?? ''),
      shortDescription: String(formData.get('shortDescription') ?? ''),
      detailDescription: String(formData.get('detailDescription') ?? ''),
      usageGuide: String(formData.get('usageGuide') ?? ''),
      pineId: String(formData.get('pineId') ?? ''),
      ready: boolFromForm(formData.get('ready')),
      visible: boolFromForm(formData.get('visible')),
      sortOrder: numberFromForm(formData.get('sortOrder'), 99),
    })
    revalidateIndicators()
    return { ok: true, message: 'Indikator erstellt.' }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Indikator konnte nicht erstellt werden.' }
  }
}

export async function updateIndicatorAction(formData: FormData): Promise<IndicatorActionResult> {
  await requireAdminAction()

  try {
    const id = nullableStringFromForm(formData.get('id'))
    if (!id) throw new Error('Indikator ID fehlt.')

    await updateIndicator(id, {
      packageId: nullableStringFromForm(formData.get('packageId')),
      name: String(formData.get('name') ?? ''),
      shortDescription: String(formData.get('shortDescription') ?? ''),
      detailDescription: String(formData.get('detailDescription') ?? ''),
      usageGuide: String(formData.get('usageGuide') ?? ''),
      pineId: String(formData.get('pineId') ?? ''),
      ready: boolFromForm(formData.get('ready')),
      visible: boolFromForm(formData.get('visible')),
      sortOrder: numberFromForm(formData.get('sortOrder'), 99),
    })
    revalidateIndicators()
    return { ok: true, message: 'Indikator gespeichert.' }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Indikator konnte nicht gespeichert werden.' }
  }
}

export async function updateIndicatorImageAction(input: {
  id: string
  imageUrl: string | null
}): Promise<IndicatorActionResult> {
  await requireAdminAction()

  try {
    await updateIndicatorImage(input.id, input.imageUrl)
    revalidateIndicators()
    return { ok: true, message: input.imageUrl ? 'Preview-Bild gespeichert.' : 'Preview-Bild entfernt.' }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Bild konnte nicht gespeichert werden.' }
  }
}

export async function resetTradingViewAccountAction(userId: string): Promise<IndicatorActionResult> {
  await requireAdminAction()

  try {
    const result = await resetTradingViewAccountBinding(userId)
    revalidateIndicators()
    return {
      ok: true,
      message: result.removed
        ? `Verknüpfung entfernt. ${result.revoked} Revokes erfolgreich, ${result.failed} fehlgeschlagen.`
        : 'Keine TradingView-Verknüpfung gefunden.',
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Reset fehlgeschlagen.' }
  }
}
