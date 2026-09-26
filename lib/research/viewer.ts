import 'server-only'

import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { cache } from 'react'

import { getIsAdmin } from '@/lib/authz'
import { getEmailFromSessionClaims, getFirstNameFromSessionClaims } from '@/lib/clerk-claims'
import {
  getResearchAccessState,
  unavailableResearchAccessState,
  withResearchAdminAccess,
  type ResearchAccessState,
} from '@/lib/research/access'
import { getResearchRequestContext } from '@/lib/research/request-context'

// Zentrale Frage "wer schaut gerade zu?" für alle Research-Seiten.
// Pro Request einmal berechnet (React cache) und in Layout, Seiten und
// Guards wiederverwendet. Seiten sind standardmäßig öffentlich; Mitglieder-
// Seiten rufen requireResearchMember(), Konto-Seiten requireResearchSignedIn().
//
// DB-Ausfall: getResearchViewer() wirft NICHT, wenn der Abo-Status nicht geladen
// werden kann, damit Layout und öffentliche Seiten (Home, Pricing, Terms)
// weiter rendern. Der Viewer gilt dann als Nicht-Mitglied (Admins behalten
// Zugang) mit `accessUnavailable: true`. Die require*-Guards bleiben fail
// closed und werfen ResearchAccessUnavailableError statt falsch umzuleiten.

export type ResearchViewer = {
  userId: string | null
  email: string | null
  firstName: string | null
  isAdmin: boolean
  access: ResearchAccessState | null
  isMember: boolean
  /**
   * true = Abo-Status konnte nicht geladen werden (DB-Fehler). `access` ist dann
   * ein fail-closed Ersatz ohne Abo-Daten (reason 'none'); nur Admins haben Zugang.
   */
  accessUnavailable: boolean
}

export type SignedInResearchViewer = ResearchViewer & { userId: string; access: ResearchAccessState }

export type ResearchMemberViewer = SignedInResearchViewer & { isMember: true }

/**
 * Vom Viewer geworfen, wenn eine Seite den Abo-Status braucht, er aber gerade
 * nicht geladen werden kann (DB-Fehler). Seiten können das abfangen und einen
 * "vorübergehend nicht verfügbar"-Zustand zeigen; sonst greift die Error-Boundary.
 */
export class ResearchAccessUnavailableError extends Error {
  readonly code = 'access_unavailable' as const

  constructor() {
    super('Research membership status is temporarily unavailable')
    this.name = 'ResearchAccessUnavailableError'
  }
}

export function isResearchAccessUnavailableError(error: unknown): error is ResearchAccessUnavailableError {
  return error instanceof ResearchAccessUnavailableError
}

function anonymousViewer(): ResearchViewer {
  return {
    userId: null,
    email: null,
    firstName: null,
    isAdmin: false,
    access: null,
    isMember: false,
    accessUnavailable: false,
  }
}

const EMAIL_PATTERN = /[^\s@<>"'`]+@[^\s@<>"'`]+\.[^\s@<>"'`]+/g
const CLERK_USER_ID_PATTERN = /\buser_[A-Za-z0-9]+/g

// Fehler für Logs ohne personenbezogene Daten (E-Mails, Clerk-User-IDs).
function describeErrorForLog(error: unknown) {
  if (!(error instanceof Error)) return { name: 'NonError' }
  const code = (error as { code?: unknown }).code
  return {
    name: error.name,
    code: typeof code === 'string' ? code : undefined,
    message: error.message
      .replace(EMAIL_PATTERN, '[email]')
      .replace(CLERK_USER_ID_PATTERN, 'user_[redacted]')
      .slice(0, 300),
  }
}

// Admin-Prüfung fällt bei Clerk-Fehlern auf "kein Admin" zurück (fail closed).
async function resolveIsAdmin(userId: string, sessionClaims: unknown) {
  try {
    return await getIsAdmin(userId, sessionClaims)
  } catch (error) {
    console.warn('Research viewer: admin check failed; treating as non-admin', {
      error: describeErrorForLog(error),
    })
    return false
  }
}

// Nur wenn die Session-Claims keine E-Mail enthalten (teurer Clerk-API-Call).
async function loadProfileFallback() {
  try {
    const user = await currentUser()
    if (!user) return null

    const email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)?.emailAddress ??
      null
    const firstName = user.firstName?.trim() || null

    return { email, firstName }
  } catch (error) {
    console.warn('Research viewer: currentUser() failed', { error: describeErrorForLog(error) })
    return null
  }
}

// Abo-Status laden; DB-Fehler (auch nach withPrismaRetry) → fail-closed Ersatz.
async function loadAccessState(userId: string): Promise<{ state: ResearchAccessState; unavailable: boolean }> {
  try {
    return { state: await getResearchAccessState(userId), unavailable: false }
  } catch (error) {
    console.error('Research viewer: subscription state unavailable; treating viewer as non-member', {
      error: describeErrorForLog(error),
    })
    return { state: unavailableResearchAccessState(), unavailable: true }
  }
}

export const getResearchViewer = cache(async (): Promise<ResearchViewer> => {
  // Layout und Seiten rendern parallel: Jede Seite, die den Viewer lädt, muss
  // vor Clerk auth() geprüft haben, dass Research hier ausgeliefert wird und die
  // Middleware lief (sonst wirft auth() → 500 statt 404). Pro Request gecacht.
  await getResearchRequestContext()
  const { userId, sessionClaims } = await auth()
  if (!userId) return anonymousViewer()

  let email = getEmailFromSessionClaims(sessionClaims)
  let firstName = getFirstNameFromSessionClaims(sessionClaims)

  const [isAdmin, subscription, fallbackProfile] = await Promise.all([
    resolveIsAdmin(userId, sessionClaims),
    loadAccessState(userId),
    email ? Promise.resolve(null) : loadProfileFallback(),
  ])
  const subscriptionAccess = subscription.state

  if (fallbackProfile) {
    email = fallbackProfile.email
    firstName = firstName ?? fallbackProfile.firstName
  }

  // Admins haben immer Zugang. Ausnahme: ein explizit gesetzter Dev-Test-Zustand
  // (RESEARCH_TEST_ACCESS) gewinnt, damit Admins lokal auch Nicht-Mitglied-
  // Flows durchspielen können.
  const access =
    isAdmin && subscriptionAccess.source !== 'test'
      ? withResearchAdminAccess(subscriptionAccess)
      : subscriptionAccess

  return {
    userId,
    email,
    firstName,
    isAdmin,
    access,
    isMember: access.hasAccess,
    accessUnavailable: subscription.unavailable,
  }
})

/**
 * Nur relative Pfade der Research-App ("/welcome?x=1"). Alles andere
 * (absolute URLs, "//host", Backslashes, Steuerzeichen) wird zu "/".
 */
export function normalizeResearchReturnPath(returnPath: string): string {
  if (typeof returnPath !== 'string') return '/'
  if (!returnPath.startsWith('/') || returnPath.startsWith('//')) return '/'
  if (/[\\\u0000-\u001f\u007f]/.test(returnPath)) return '/'
  return returnPath
}

/** `${basePath}/sign-in?redirect_url=…` mit Rücksprung auf den (base-präfixierten) Pfad. */
export function researchSignInPath(basePath: string, returnPath: string): string {
  const target = `${basePath}${normalizeResearchReturnPath(returnPath)}`
  return `${basePath}/sign-in?redirect_url=${encodeURIComponent(target)}`
}

function isSignedIn(viewer: ResearchViewer): viewer is SignedInResearchViewer {
  return viewer.userId !== null && viewer.access !== null
}

/**
 * Erzwingt Login. `returnPath` ist der logische Research-Pfad (ohne /research),
 * z. B. '/account'. Ausgeloggte werden zur Research-Anmeldung umgeleitet.
 *
 * Ist der Abo-Status gerade nicht ladbar, wirft die Funktion
 * ResearchAccessUnavailableError (Admins ausgenommen, ihr Zugang hängt nicht
 * an der DB) — sonst sähen zahlende Mitglieder "keine Mitgliedschaft".
 */
export async function requireResearchSignedIn(returnPath: string): Promise<SignedInResearchViewer> {
  const viewer = await getResearchViewer()
  if (isSignedIn(viewer)) {
    if (viewer.accessUnavailable && !viewer.isAdmin) throw new ResearchAccessUnavailableError()
    return viewer
  }

  const { basePath } = await getResearchRequestContext()
  redirect(researchSignInPath(basePath, returnPath))
}

/**
 * Erzwingt Login und Zugang (Abo, Kulanz oder Admin). Nicht-Mitglieder landen
 * auf der Pricing-Seite. Bei nicht ladbarem Abo-Status: ResearchAccessUnavailableError
 * (kein Zugang, aber auch keine irreführende Umleitung zu Pricing); Admins kommen durch.
 */
export async function requireResearchMember(returnPath: string): Promise<ResearchMemberViewer> {
  const viewer = await requireResearchSignedIn(returnPath)
  if (viewer.isMember) return { ...viewer, isMember: true }

  const { basePath } = await getResearchRequestContext()
  redirect(`${basePath}/pricing`)
}
