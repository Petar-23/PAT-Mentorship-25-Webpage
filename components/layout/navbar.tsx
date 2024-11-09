'use client'

import { useUser } from '@clerk/nextjs'
import { UserButton, SignInButton } from '@clerk/nextjs'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import { useCustomerCount } from '@/hooks/useCustomerCount'
import { Button } from '@/components/ui/button'
import { Menu, X, Home, Gauge } from 'lucide-react'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export function Navbar() {
  const { isSignedIn } = useUser()
  const { count } = useCustomerCount()
  const [isOpen, setIsOpen] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const isDashboard = pathname === '/dashboard'
  
  // Calculate remaining spots and urgency
  const remainingSpots = 100 - (count || 0)
  const isLow = remainingSpots <= 20

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

  const toggleMenu = () => {
    setIsOpen(!isOpen)
  }

  const closeMenu = () => {
    setIsOpen(false)
  }

  const handleNavigation = (path: string) => {
    setIsNavigating(true)
    router.push(path)
    // Close menu and reset navigation state after a delay
    setTimeout(() => {
      setIsNavigating(false)
      setIsOpen(false)
    }, 500) // Adjust timing as needed
  }

  // Custom SignInButton wrapper to handle menu closing
  const SignInWrapper = ({ children }: { children: React.ReactNode }) => (
    <SignInButton mode="modal" forceRedirectUrl="/dashboard">
      <div onClick={closeMenu}>
        {children}
      </div>
    </SignInButton>
  )

  // Navigation button based on current route
  const NavigationButton = () => {
    if (!isSignedIn) {
      return (
        <SignInWrapper>
          <Button>
            Anmelden →
          </Button>
        </SignInWrapper>
      );
    }

    if (isDashboard) {
      return (
        <Button
          variant="outline"
          onClick={() => handleNavigation('/')}
          disabled={isNavigating}
          className="flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          <span>Home</span>
        </Button>
      );
    }

    return (
      <Button
        variant="outline"
        onClick={() => handleNavigation('/dashboard')}
        disabled={isNavigating}
        className="flex items-center gap-2"
      >
        <Gauge className="h-4 w-4" />
        <span>Dashboard</span>
      </Button>
    );
  }

  return (
    <>
      <header className="relative bg-white z-50">
        <div className="container mx-auto px-4">
          <nav className="h-16 flex items-center justify-between">
            {/* Left section with logo */}
            <Link 
              href="/" 
              className="flex items-center gap-3 group hover:opacity-90 transition-opacity"
              onClick={closeMenu}
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
              {/* Available Spots Counter */}
              <div className={`
                px-4 py-1.5 rounded-full border transition-colors
                ${isLow 
                  ? 'border-red-200 bg-red-50 text-red-700' 
                  : 'border-gray-200 bg-white text-gray-700'}
              `}>
                <div className="text-sm flex items-center gap-2">
                  <span>Verfügbare Plätze:</span>
                  <span className={`font-medium ${isLow ? 'text-red-600' : 'text-green-600'}`}>
                    {remainingSpots}/100
                  </span>
                  {isLow && (
                    <span className="text-xs text-red-600 animate-pulse">
                      Limited!
                    </span>
                  )}
                </div>
              </div>

              {/* Desktop Auth Buttons */}
              {isSignedIn ? (
                <div className="flex items-center gap-3">
                  <NavigationButton />
                  <UserButton 
                    afterSignOutUrl="/"
                    appearance={{
                      elements: {
                        avatarBox: "w-8 h-8"
                      }
                    }} 
                  />
                </div>
              ) : (
                <SignInWrapper>
                  <Button>
                    Anmelden →
                  </Button>
                </SignInWrapper>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={toggleMenu}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
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
                  {isOpen ? (
                    <X className="h-6 w-6" />
                  ) : (
                    <Menu className="h-6 w-6" />
                  )}
                </motion.div>
              </AnimatePresence>
            </button>
          </nav>

          {/* Mobile Menu */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="md:hidden absolute top-16 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-50 overflow-hidden"
              >
                <div className="container px-4 py-4">
                  {/* Mobile menu content with flex layout */}
                  <div className="flex items-center justify-between gap-4">
                    {/* Mobile Spots Counter */}
                    <div className={`
                      flex-1 px-4 py-2 rounded-lg border transition-colors
                      ${isLow 
                        ? 'border-red-200 bg-red-50 text-red-700' 
                        : 'border-gray-200 bg-white text-gray-700'}
                    `}>
                      <div className="text-sm flex items-center justify-between">
                        <span className="hidden sm:inline">Verfügbare Plätze:</span>
                        <span className="sm:hidden">Plätze:</span>
                        <span className={`font-medium ${isLow ? 'text-red-600' : 'text-green-600'}`}>
                          {remainingSpots}/100
                          {isLow && (
                            <span className="text-xs text-red-600 animate-pulse ml-2">
                              Limited!
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Mobile Auth Buttons */}
                    {isSignedIn ? (
                      <div className="flex items-center gap-3">
                        <NavigationButton />
                        <UserButton 
                          afterSignOutUrl="/"
                          appearance={{
                            elements: {
                              avatarBox: "w-8 h-8"
                            }
                          }} 
                        />
                      </div>
                    ) : (
                      <SignInWrapper>
                        <Button>
                          Anmelden →
                        </Button>
                      </SignInWrapper>
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
            onClick={closeMenu}
          />
        )}
      </AnimatePresence>
    </>
  )
}