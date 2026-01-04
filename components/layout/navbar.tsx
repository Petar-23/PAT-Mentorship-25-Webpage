'use client'

import { useUser } from '@clerk/nextjs'
import { UserButton, SignInButton } from '@clerk/nextjs'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Menu, X, Home, Settings, CreditCard, Notebook } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export function Navbar() {
  const { user, isSignedIn } = useUser()
  const [isOpen, setIsOpen] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const [mentorshipStatus, setMentorshipStatus] = useState<{
    accessible: boolean
    startDate: string
    hasSubscription: boolean
  } | null>(null)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const postCheckoutRef = useRef(false)

  const isMentorship = pathname?.startsWith('/mentorship')
  const isDashboard = pathname === '/dashboard'
  const isAdmin = user?.organizationMemberships?.some(
    membership => membership.role === 'org:admin'
  )
  const isCheckoutSuccess = isDashboard && searchParams.get('success') === 'true'

  // Lade Mentorship-Status beim ersten Laden
  useEffect(() => {
    if (!isSignedIn) {
      setMentorshipStatus(null)
      return
    }

    // Wenn wir aus Stripe zurückkommen, kann es ein paar Sekunden dauern bis Webhooks/DB aktuell sind.
    // Deshalb pollen wir kurz, damit der Mentorship-Button ohne Refresh sofort erscheint.
    if (isCheckoutSuccess) {
      postCheckoutRef.current = true
    }

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let attempts = 0
    const maxAttempts = postCheckoutRef.current ? 12 : 1 // ~18s bei 1.5s Delay

    const load = async () => {
      attempts += 1
      try {
        const res = await fetch('/api/mentorship-status', { cache: 'no-store' })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(
            `mentorship-status failed (${res.status}): ${text || res.statusText}`
          )
        }

        const data = await res.json()

        if (cancelled) return
        setMentorshipStatus(data)

        // Sobald das Abo aktiv ist, stoppen wir und deaktivieren den Post-Checkout-Modus.
        if (data?.hasSubscription) {
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
        console.error('Failed to load mentorship status:', err)

        if (cancelled) return
        if (postCheckoutRef.current && attempts < maxAttempts) {
          timeoutId = setTimeout(load, 1500)
        } else {
          postCheckoutRef.current = false
        }
      }
    }

    load()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [isSignedIn, isCheckoutSuccess])

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

  const handleNavigation = async (path: string) => {
    try {
      setIsNavigating(true)
      await router.push(path)
      setIsOpen(false)
    } catch (error) {
      console.error('Navigation error:', error)
    } finally {
      setIsNavigating(false)
    }
  }

  return (
    <>
      <header className="relative bg-white z-50">
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
                className="rounded-lg"
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
                      {mentorshipStatus ? (
                        !mentorshipStatus.accessible && !isAdmin ? (
                          <Button
                            variant="outline"
                            className="flex items-center gap-3 bg-gray-900 hover:bg-gray-800 text-gray-300 border-gray-700 cursor-not-allowed px-3 py-1 leading-tight"
                            disabled
                            title="Mentorship startet ab 01.03.2026"
                          >
                            <Notebook className="h-5 w-5" />
                            <div className="flex flex-col items-start gap-0">
                              <span className="text-sm">Mentorship</span>
                              <span className="text-[10px] text-gray-400 mb-1">Start 01.03.2026</span>
                            </div>
                          </Button>
                        ) : mentorshipStatus.hasSubscription || isAdmin ? (
                          <Button asChild className="flex items-center gap-2">
                            <Link href="/mentorship">
                              <Notebook className="h-4 w-4" />
                              <span>Mentorship</span>
                            </Link>
                          </Button>
                        ) : null
                      ) : null}

                      <Button
                        variant="outline"
                        onClick={() => handleNavigation(isDashboard ? '/' : '/dashboard')}
                        disabled={isNavigating}
                        className="flex items-center gap-2"
                      >
                        {isDashboard ? (
                          <>
                            <Home className="h-4 w-4" />
                            <span>Home</span>
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-4 w-4" />
                            <span>Abo</span>
                          </>
                        )}
                      </Button>
                    </>
                  ) : null}
                  
                  {isAdmin && (
                    <Button
                      variant="outline"
                      onClick={() => handleNavigation('/owner')}
                      disabled={isNavigating}
                      className="flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Admin</span>
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
                <SignInButton mode="modal" forceRedirectUrl={"/dashboard"}>
                  <Button>
                    Anmelden →
                  </Button>
                </SignInButton>
              )}
            </div>

            {/* Mobile Controls */}
            <div className="md:hidden flex items-center gap-3">
              {isSignedIn ? (
                <>
                  {!isMentorship || isAdmin ? (
                    <button
                      onClick={() => setIsOpen(!isOpen)}
                      className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                      disabled={isNavigating}
                    >
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={isOpen ? 'close' : 'menu'}
                          initial={{ rotate: -90, opacity: 0 }}
                          animate={{ rotate: 0, opacity: 1 }}
                          exit={{ rotate: 90, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        </motion.div>
                      </AnimatePresence>
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
                <SignInButton mode="modal" forceRedirectUrl={"/dashboard"}>
                  <Button size="sm">
                    Anmelden →
                  </Button>
                </SignInButton>
              )}
            </div>
          </nav>

          {/* Mobile Menu */}
          <AnimatePresence>
            {isOpen && isSignedIn && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="md:hidden absolute top-16 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-50 overflow-hidden"
              >
                <div className="container px-4 py-4">
                  <div className="flex flex-col gap-4">
                    {!isMentorship ? (
                      <>
                        {mentorshipStatus ? (
                          !mentorshipStatus.accessible && !isAdmin ? (
                            <Button
                              variant="outline"
                              className="w-full flex items-center gap-3 bg-gray-900 hover:bg-gray-800 text-gray-300 border-gray-700 cursor-not-allowed px-3 py-1 leading-tight"
                              disabled
                              title="Mentorship startet ab 01.03.2026"
                            >
                              <Notebook className="h-5 w-5" />
                              <div className="flex flex-col items-start gap-0">
                                <span className="text-sm">Mentorship</span>
                                <span className="text-[10px] text-gray-400 mb-1">Start 01.03.2026</span>
                              </div>
                            </Button>
                          ) : mentorshipStatus.hasSubscription || isAdmin ? (
                            <Button asChild className="w-full flex items-center justify-center gap-2">
                              <Link href="/mentorship" onClick={() => setIsOpen(false)}>
                                <Notebook className="h-4 w-4" />
                                <span>Mentorship</span>
                              </Link>
                            </Button>
                          ) : null
                        ) : null}

                        <Button
                          variant="outline"
                          onClick={() => handleNavigation(isDashboard ? '/' : '/dashboard')}
                          disabled={isNavigating}
                          className="w-full flex items-center justify-center gap-2"
                        >
                          {isDashboard ? (
                            <>
                              <Home className="h-4 w-4" />
                              <span>Home</span>
                            </>
                          ) : (
                            <>
                              <CreditCard className="h-4 w-4" />
                              <span>Abo</span>
                            </>
                          )}
                        </Button>
                      </>
                    ) : null}
                    
                    {isAdmin && (
                      <Button
                        variant="outline"
                        onClick={() => handleNavigation('/owner')}
                        disabled={isNavigating}
                        className="w-full flex items-center justify-center gap-2"
                      >
                        <Settings className="h-4 w-4" />
                        <span>Admin</span>
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Gradient Border */}
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-gray-300 to-transparent animate-gradient-x" />
      </header>

      {/* Backdrop Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}