// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isProtectedRoute = createRouteMatcher(['/owner(.*)'])

export default clerkMiddleware(async (auth, req) => {
  const { has } = await auth()
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