import 'server-only'

import { cache } from 'react'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import {
  isResearchServedOnHost,
  researchHref,
  resolveResearchRequestContext,
  type ResearchBasePath,
  type ResearchRequestContext,
} from '@/lib/research/routing.mjs'

// Basis-Pfad und Origin der aktuellen Research-Anfrage.
// Grundlage ist immer der Host-Header (so wie ihn die Middleware sieht), nie
// request.url: Nach dem Middleware-Rewrite zeigt die URL auf den internen Pfad.
//   research.price-action-trader.de → basePath '',          origin https://research…
//   <preview>/research/…, localhost → basePath '/research', origin der Preview/localhost

export type { ResearchBasePath, ResearchRequestContext }

// Setzt clerkMiddleware auf jede Anfrage, die sie verarbeitet hat (auch bei
// Rewrites auf denselben Origin); Clerk selbst erkennt die Middleware daran
// (@clerk/backend constants.Headers.AuthStatus). Fehlt er, hat der Matcher die
// Middleware übersprungen und Clerk `auth()` würde werfen (→ 500).
const CLERK_AUTH_STATUS_HEADER = 'x-clerk-auth-status'

/**
 * Für Server-Komponenten und Server-Actions (liest `headers()`), pro Request gecacht.
 *
 * Ruft notFound() auf, wenn diese Anfrage kein Research ausliefern darf (Production
 * auf dem Haupt-Host, Kill-Switch) oder nicht durch die Middleware gelaufen ist.
 * Normalerweise entscheidet das schon die Middleware, ihr Matcher überspringt aber
 * Pfade mit Datei-Endung (/research/x.css, /research/sign-in/a.png), die sonst in
 * den Catch-all-Routen landen. Das Research-Layout und getResearchViewer() awaiten
 * diese Funktion deshalb vor allem anderen (insbesondere vor Clerk `auth()`).
 */
export const getResearchRequestContext = cache(async (): Promise<ResearchRequestContext> => {
  const headerList = await headers()
  const host = headerList.get('host')
  if (!isResearchServedOnHost(host, process.env)) notFound()
  if (!headerList.get(CLERK_AUTH_STATUS_HEADER)) notFound()
  return resolveResearchRequestContext({
    host,
    forwardedProto: headerList.get('x-forwarded-proto'),
    env: process.env,
  })
})

/** Absolute URL zu einem logischen Research-Pfad, z. B. für Stripe-Rücksprünge oder Mails. */
export function researchAbsoluteUrl(
  ctx: Pick<ResearchRequestContext, 'basePath' | 'origin'>,
  path: string
): string {
  return `${ctx.origin}${researchHref(ctx.basePath, path)}`
}

/**
 * Für Route-Handler unter /api/research/*: false ⇒ mit 404 antworten.
 * Zweite Linie hinter der Middleware (Production: nur auf dem Research-Host,
 * Kill-Switch: nirgends).
 */
export function isResearchServedForRequest(request: Request): boolean {
  return isResearchServedOnHost(request.headers.get('host'), process.env)
}

/** Für Route-Handler: Kontext aus dem Host-Header der Anfrage. */
export function researchRequestContextFromRequest(request: Request): ResearchRequestContext {
  return resolveResearchRequestContext({
    host: request.headers.get('host'),
    forwardedProto: request.headers.get('x-forwarded-proto'),
    env: process.env,
  })
}

export function researchBasePathFromRequest(request: Request): ResearchBasePath {
  return researchRequestContextFromRequest(request).basePath
}

export function researchOriginFromRequest(request: Request): string {
  return researchRequestContextFromRequest(request).origin
}
