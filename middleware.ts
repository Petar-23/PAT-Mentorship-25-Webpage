// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { legalPathRedirect } from '@/lib/legal-path-aliases.mjs'

const isAuthRequiredRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/courses(.*)',
  '/mentorship(.*)',
  '/owner(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  // /agb, /widerruf und andere Schreibweisen dauerhaft auf /AGB bzw. /Widerruf.
  // Nicht in next.config.ts, weil Next dort ohne Groß-/Kleinschreibung vergleicht (Schleife).
  const legalTarget = legalPathRedirect(req.nextUrl.pathname)
  if (legalTarget) {
    const legalUrl = req.nextUrl.clone()
    legalUrl.pathname = legalTarget
    return NextResponse.redirect(legalUrl, 308)
  }

  const { userId } = await auth()

  // UX: Wenn jemand ohne Login einen Deep-Link (z.B. aus Discord) öffnet,
  // leiten wir auf /sign-in weiter, aber behalten die ursprüngliche URL,
  // damit Clerk nach dem Login wieder genau dorthin zurück navigieren kann.
  if (isAuthRequiredRoute(req) && !userId) {
    const returnBackUrl = `${req.nextUrl.pathname}${req.nextUrl.search}`
    const signInUrl = new URL('/sign-in', req.url)
    signInUrl.searchParams.set('redirect_url', returnBackUrl)
    return NextResponse.redirect(signInUrl)
  }

})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}