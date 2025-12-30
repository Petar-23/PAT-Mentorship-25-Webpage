'use client'

import { useUser } from '@clerk/nextjs'
import { UserButton, SignInButton } from '@clerk/nextjs'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Menu, X, Home, Settings, CreditCard, Notebook } from 'lucide-react'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export function Navbar() {
  const { user, isSignedIn } = useUser()
  const [isOpen, setIsOpen] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  
  const isMentorship = pathname?.startsWith('/mentorship')
  const isDashboard = pathname === '/dashboard'
  const isAdmin = user?.organizationMemberships?.some(
    membership => membership.role === 'org:admin'
  )

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
                      <Button asChild className="flex items-center gap-2">
                        <Link href="/mentorship">
                          <Notebook className="h-4 w-4" />
                          <span>Mentorship</span>
                        </Link>
                      </Button>

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
                        <Button asChild className="w-full flex items-center justify-center gap-2">
                          <Link href="/mentorship" onClick={() => setIsOpen(false)}>
                            <Notebook className="h-4 w-4" />
                            <span>Mentorship</span>
                          </Link>
                        </Button>

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