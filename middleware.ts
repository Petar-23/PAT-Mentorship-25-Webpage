// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { resolveResearchRoute } from '@/lib/research/routing.mjs'

const isAuthRequiredRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/courses(.*)',
  '/mentorship(.*)',
  '/owner(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  // PAT Research zuerst: Host-/Pfad-Routing aus lib/research/routing.mjs.
  // Für den Haupt-Host liefert es { type: 'next' }, dann läuft alles wie bisher.
  // Env-Werte explizit: NODE_ENV wird beim Build eingesetzt (Edge-Runtime).
  const researchRoute = resolveResearchRoute({
    host: req.headers.get('host'),
    pathname: req.nextUrl.pathname,
    search: req.nextUrl.search,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      RESEARCH_PUBLIC_HOST: process.env.RESEARCH_PUBLIC_HOST,
      RESEARCH_EXTRA_HOSTS: process.env.RESEARCH_EXTRA_HOSTS,
      RESEARCH_ALLOW_PATH_MODE: process.env.RESEARCH_ALLOW_PATH_MODE,
    },
  })
  if (researchRoute.type === 'redirect') {
    return NextResponse.redirect(new URL(researchRoute.location, req.url), researchRoute.status)
  }
  if (researchRoute.type === 'not_found') {
    return new NextResponse('Not found', { status: 404 })
  }
  if (researchRoute.type === 'rewrite') {
    const url = req.nextUrl.clone()
    url.pathname = researchRoute.pathname
    return NextResponse.rewrite(url)
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