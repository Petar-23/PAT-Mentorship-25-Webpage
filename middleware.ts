// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isProtectedRoute = createRouteMatcher(['/owner(.*)'])
const isAuthRequiredRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/courses(.*)',
  '/mentorship(.*)',
  '/owner(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  const { userId, has } = await auth()

  // UX: Wenn jemand ohne Login einen Deep-Link (z.B. aus Discord) öffnet,
  // leiten wir auf /sign-in weiter, aber behalten die ursprüngliche URL,
  // damit Clerk nach dem Login wieder genau dorthin zurück navigieren kann.
  if (isAuthRequiredRoute(req) && !userId) {
    const returnBackUrl = `${req.nextUrl.pathname}${req.nextUrl.search}`
    const signInUrl = new URL('/sign-in', req.url)
    signInUrl.searchParams.set('redirect_url', returnBackUrl)
    return NextResponse.redirect(signInUrl)
  }

  // Restrict admin routes to users with specific permissions
  if (
    (isProtectedRoute(req) && !has({ permission: 'org:admin:access' }))
  ) {
    // Add logic to run if the user does not have the required permissions
    console.log(has)
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