'use client'

import { useUser } from '@clerk/nextjs'
import { UserButton, SignInButton } from '@clerk/nextjs'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { CreditCard } from '@phosphor-icons/react/CreditCard'
import { Gauge } from '@phosphor-icons/react/Gauge'
import { GearSix as Settings } from '@phosphor-icons/react/GearSix'
import { House as Home } from '@phosphor-icons/react/House'
import { List as Menu } from '@phosphor-icons/react/List'
import { Notebook } from '@phosphor-icons/react/Notebook'
import { PencilLine as PenLine } from '@phosphor-icons/react/PencilLine'
import { X } from '@phosphor-icons/react/X'
import { useEffect, useRef, useState } from 'react'
import { MENTORSHIP_CONFIG } from '@/lib/config'
import { RAIDMAP_CONFIG } from '@/lib/raidmap-config'

type MentorshipStatus = {
  accessible: boolean
  startDate: string
  hasSubscription: boolean
}

const MENTORSHIP_STATUS_CACHE_TTL_MS = 60_000
type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (id: number) => void
}

function getMentorshipStatusCacheKey(userId: string) {
  return `mentorship-nav-status:${userId}`
}

function formatMentorshipStartDate(value?: string) {
  if (!value) return MENTORSHIP_CONFIG.startDateFormatted

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return MENTORSHIP_CONFIG.startDateFormatted

  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function readCachedMentorshipStatus(userId: string): MentorshipStatus | null {
  try {
    const raw = window.sessionStorage.getItem(getMentorshipStatusCacheKey(userId))
    if (!raw) return null

    const cached = JSON.parse(raw) as { savedAt?: unknown; data?: unknown }
    if (typeof cached.savedAt !== 'number' || Date.now() - cached.savedAt > MENTORSHIP_STATUS_CACHE_TTL_MS) {
      return null
    }

    const data = cached.data as Partial<MentorshipStatus> | undefined
    if (
      typeof data?.accessible !== 'boolean' ||
      typeof data.startDate !== 'string' ||
      typeof data.hasSubscription !== 'boolean'
    ) {
      return null
    }

    return data as MentorshipStatus
  } catch {
    return null
  }
}

function cacheMentorshipStatus(userId: string, data: MentorshipStatus) {
  try {
    window.sessionStorage.setItem(
      getMentorshipStatusCacheKey(userId),
      JSON.stringify({ savedAt: Date.now(), data })
    )
  } catch {
    // sessionStorage may be unavailable in private contexts; the API fallback still works.
  }
}

export function Navbar() {
  const { user, isSignedIn } = useUser()
  const [isOpen, setIsOpen] = useState(false)
  const [mentorshipStatus, setMentorshipStatus] = useState<MentorshipStatus | null>(null)
  const pathname = usePathname()
  const postCheckoutRef = useRef(false)

  const isMentorship = pathname?.startsWith('/mentorship')
  const isDashboard = pathname === '/dashboard'
  const isRaidMap = pathname?.startsWith('/raid-map')
  const isRaidMapAccount =
    pathname === RAIDMAP_CONFIG.accountPath || pathname === RAIDMAP_CONFIG.accountPathDe
  const isRaidMapGerman =
    pathname === RAIDMAP_CONFIG.salesPathDe ||
    pathname === RAIDMAP_CONFIG.docsPathDe ||
    pathname === RAIDMAP_CONFIG.accountPathDe
  const raidMapAccountPath = isRaidMapGerman
    ? RAIDMAP_CONFIG.accountPathDe
    : RAIDMAP_CONFIG.accountPath
  const raidMapAccountLabel = isRaidMapGerman ? 'Mein Raid Map Account' : 'My Raid Map account'
  const isAdmin = user?.organizationMemberships?.some(
    membership => membership.role === 'org:admin'
  )
  const userId = user?.id ?? null
  const mentorshipStartLabel = formatMentorshipStartDate(mentorshipStatus?.startDate)

  // Lade Mentorship-Status beim ersten Laden
  useEffect(() => {
    if (!isSignedIn || !userId || isMentorship || isAdmin) {
      setMentorshipStatus(null)
      postCheckoutRef.current = false
      return
    }

    // Wenn wir aus Stripe zurückkommen, kann es ein paar Sekunden dauern bis Webhooks/DB aktuell sind.
    // Deshalb pollen wir kurz, damit der Mentorship-Button ohne Refresh sofort erscheint.
    const isCheckoutSuccess =
      isDashboard && new URLSearchParams(window.location.search).get('success') === 'true'
    if (isCheckoutSuccess) {
      postCheckoutRef.current = true
    }

    if (!postCheckoutRef.current) {
      const cached = readCachedMentorshipStatus(userId)
      if (cached) {
        setMentorshipStatus(cached)
        return
      }
    }

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let idleId: number | null = null
    let fallbackIdleId: ReturnType<typeof setTimeout> | null = null
    const abortController = new AbortController()
    let attempts = 0
    const maxAttempts = postCheckoutRef.current ? 12 : 1 // ~18s bei 1.5s Delay

    const load = async () => {
      attempts += 1
      try {
        const res = await fetch('/api/mentorship-status', {
          cache: 'no-store',
          signal: abortController.signal,
        })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(
            `mentorship-status failed (${res.status}): ${text || res.statusText}`
          )
        }

        const data = await res.json()

        if (cancelled) return
        const nextStatus = data as MentorshipStatus
        setMentorshipStatus(nextStatus)
        cacheMentorshipStatus(userId, nextStatus)

        // Sobald das Abo aktiv ist, stoppen wir und deaktivieren den Post-Checkout-Modus.
        if (nextStatus.hasSubscription) {
          postCheckoutRef.current = false
          return
        }

        if (postCheckoutRef.current && attempts < maxAttempts) {
          timeoutId = setTimeout(load, 1500)
          return
        }

        // Timeout erreicht -> nicht endlos pollen.
        postCheckoutRef.current = false
      } catch (err) {
        if (cancelled || abortController.signal.aborted) return
        console.error('Failed to load mentorship status:', err)

        if (postCheckoutRef.current && attempts < maxAttempts) {
          timeoutId = setTimeout(load, 1500)
        } else {
          postCheckoutRef.current = false
        }
      }
    }

    const scheduleLoad = () => {
      if (postCheckoutRef.current) {
        void load()
        return
      }

      const idleWindow = window as IdleWindow
      if (idleWindow.requestIdleCallback) {
        idleId = idleWindow.requestIdleCallback(() => {
          idleId = null
          void load()
        }, { timeout: 1200 })
        return
      }

      fallbackIdleId = setTimeout(() => {
        fallbackIdleId = null
        void load()
      }, 250)
    }

    scheduleLoad()

    return () => {
      cancelled = true
      abortController.abort()
      if (timeoutId) clearTimeout(timeoutId)
      if (idleId != null) {
        const idleWindow = window as IdleWindow
        idleWindow.cancelIdleCallback?.(idleId)
      }
      if (fallbackIdleId) clearTimeout(fallbackIdleId)
    }
  }, [isAdmin, isDashboard, isSignedIn, isMentorship, userId])

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  return (
    <>
      <header className="sticky top-0 bg-white z-50">
        <div className={isMentorship ? 'w-full px-4' : 'container mx-auto px-4'}>
          <nav className="h-16 flex items-center justify-between">
            {/* Logo */}
            <Link 
              href="/" 
              className="flex items-center gap-3 group hover:opacity-90 transition-opacity"
            >
              <Image
                src="/images/hero/PAT-logo.png"
                alt="PAT Mentorship Logo"
                width={32}
                height={32}
                className="h-8 w-8 rounded-lg"
                sizes="32px"
              />
              <span className="text-xl font-semibold hidden sm:inline">
                PRICE ACTION TRADER
              </span>
              <span className="text-xl font-semibold sm:hidden">
                PAT
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-4">
              {isSignedIn ? (
                <div className="flex items-center gap-3">
                  {!isMentorship ? (
                    <>
                      {isRaidMap && !isRaidMapAccount ? (
                        <Button asChild variant="outline" className="flex items-center gap-2">
                          <Link href={raidMapAccountPath} prefetch={false}>
                            <CreditCard className="h-4 w-4" />
                            <span>{raidMapAccountLabel}</span>
                          </Link>
                        </Button>
                      ) : null}

                      {isAdmin || mentorshipStatus?.hasSubscription ? (
                        mentorshipStatus && !mentorshipStatus.accessible && !isAdmin ? (
                          <Button
                            variant="outline"
                            className="flex items-center gap-3 bg-gray-900 hover:bg-gray-800 text-gray-300 border-gray-700 cursor-not-allowed px-3 py-1 leading-tight"
                            disabled
                            title={`Mentorship startet ab ${mentorshipStartLabel}`}
                          >
                            <Notebook className="h-5 w-5" />
                            <div className="flex flex-col items-start gap-0">
                              <span className="text-sm">Mentorship</span>
                              <span className="text-[10px] text-gray-400 mb-1">Start {mentorshipStartLabel}</span>
                            </div>
                          </Button>
                        ) : (
                          <Button asChild className="flex items-center gap-2">
                            <Link href="/mentorship" prefetch={false}>
                              <Notebook className="h-4 w-4" />
                              <span>Mentorship</span>
                            </Link>
                          </Button>
                        )
                      ) : null}

                      <Button asChild variant="outline" className="flex items-center gap-2">
                        <Link href={isDashboard ? '/' : '/dashboard'} prefetch={false}>
                          {isDashboard ? (
                            <>
                              <Home className="h-4 w-4" />
                              <span>Home</span>
                            </>
                          ) : (
                            <>
                              <Gauge className="h-4 w-4" />
                              <span>Dashboard</span>
                            </>
                          )}
                        </Link>
                      </Button>
                    </>
                  ) : null}

                  {isAdmin && (
                    <Button asChild variant="outline" className="flex items-center gap-2">
                      <Link href="/owner/blog" prefetch={false}>
                        <PenLine className="h-4 w-4" />
                        <span>Blog</span>
                      </Link>
                    </Button>
                  )}
                  {isAdmin && (
                    <Button asChild variant="outline" className="flex items-center gap-2">
                      <Link href="/owner" prefetch={false}>
                        <Settings className="h-4 w-4" />
                        <span>Admin</span>
                      </Link>
                    </Button>
                  )}
                  {!isMentorship ? (
                    <UserButton
                      afterSignOutUrl="/"
                      appearance={{
                        elements: {
                          avatarBox: 'w-8 h-8',
                        },
                      }}
                    />
                  ) : null}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {isRaidMap && !isRaidMapAccount ? (
                    <Button asChild variant="outline" className="flex items-center gap-2">
                      <Link href={raidMapAccountPath} prefetch={false}>
                        <CreditCard className="h-4 w-4" />
                        <span>{raidMapAccountLabel}</span>
                      </Link>
                    </Button>
                  ) : null}
                  <SignInButton mode="modal" forceRedirectUrl={"/dashboard"}>
                    <Button>
                      Anmelden →
                    </Button>
                  </SignInButton>
                </div>
              )}
            </div>

            {/* Mobile Controls */}
            <div className="md:hidden flex items-center gap-3">
              {isSignedIn ? (
                <>
                  {isRaidMap && !isRaidMapAccount ? (
                    <Button asChild variant="outline" size="sm" className="flex items-center gap-2 px-3">
                      <Link href={raidMapAccountPath} prefetch={false}>
                        <CreditCard className="h-4 w-4" />
                        <span>Account</span>
                      </Link>
                    </Button>
                  ) : null}
                  {!isMentorship || isAdmin ? (
                    <button
                      onClick={() => setIsOpen(!isOpen)}
                      className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                      aria-label={isOpen ? 'Menü schließen' : 'Menü öffnen'}
                      aria-expanded={isOpen}
                    >
                      <span className="block transition-transform duration-200">
                        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                      </span>
                    </button>
                  ) : null}
                  {!isMentorship ? (
                    <UserButton
                      afterSignOutUrl="/"
                      appearance={{
                        elements: {
                          avatarBox: 'w-8 h-8',
                        },
                      }}
                    />
                  ) : null}
                </>
              ) : (
                <>
                  {isRaidMap && !isRaidMapAccount ? (
                    <Button asChild variant="outline" size="sm" className="flex items-center gap-2 px-3">
                      <Link href={raidMapAccountPath} prefetch={false}>
                        <CreditCard className="h-4 w-4" />
                        <span>Account</span>
                      </Link>
                    </Button>
                  ) : null}
                  <SignInButton mode="modal" forceRedirectUrl={"/dashboard"}>
                    <Button size="sm">
                      Anmelden →
                    </Button>
                  </SignInButton>
                </>
              )}
            </div>
          </nav>

          {/* Mobile Menu */}
          {isOpen && isSignedIn && (
            <div className="md:hidden absolute top-16 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-50 overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-200">
              <div className="container px-4 py-4">
                <div className="flex flex-col gap-4">
                  {!isMentorship ? (
                    <>
                      {isAdmin || mentorshipStatus?.hasSubscription ? (
                        mentorshipStatus && !mentorshipStatus.accessible && !isAdmin ? (
                          <Button
                            variant="outline"
                            className="w-full flex items-center gap-3 bg-gray-900 hover:bg-gray-800 text-gray-300 border-gray-700 cursor-not-allowed px-3 py-1 leading-tight"
                            disabled
                            title={`Mentorship startet ab ${mentorshipStartLabel}`}
                          >
                            <Notebook className="h-5 w-5" />
                            <div className="flex flex-col items-start gap-0">
                              <span className="text-sm">Mentorship</span>
                              <span className="text-[10px] text-gray-400 mb-1">Start {mentorshipStartLabel}</span>
                            </div>
                          </Button>
                        ) : (
                          <Button asChild className="w-full flex items-center justify-center gap-2">
                            <Link href="/mentorship" prefetch={false} onClick={() => setIsOpen(false)}>
                              <Notebook className="h-4 w-4" />
                              <span>Mentorship</span>
                            </Link>
                          </Button>
                        )
                      ) : null}

                      <Button asChild variant="outline" className="w-full flex items-center justify-center gap-2">
                        <Link
                          href={isDashboard ? '/' : '/dashboard'}
                          prefetch={false}
                          onClick={() => setIsOpen(false)}
                        >
                          {isDashboard ? (
                            <>
                              <Home className="h-4 w-4" />
                              <span>Home</span>
                            </>
                          ) : (
                            <>
                              <Gauge className="h-4 w-4" />
                              <span>Dashboard</span>
                            </>
                          )}
                        </Link>
                      </Button>
                    </>
                  ) : null}

                  {isAdmin && (
                    <Button asChild variant="outline" className="w-full flex items-center justify-center gap-2">
                      <Link href="/owner/blog" prefetch={false} onClick={() => setIsOpen(false)}>
                        <PenLine className="h-4 w-4" />
                        <span>Blog</span>
                      </Link>
                    </Button>
                  )}
                  {isAdmin && (
                    <Button asChild variant="outline" className="w-full flex items-center justify-center gap-2">
                      <Link href="/owner" prefetch={false} onClick={() => setIsOpen(false)}>
                        <Settings className="h-4 w-4" />
                        <span>Admin</span>
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Gradient Border */}
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-gray-300 to-transparent animate-gradient-x" />
      </header>

      {/* Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in-0 duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
