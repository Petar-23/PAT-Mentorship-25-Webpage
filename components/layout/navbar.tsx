// src/components/layout/navbar.tsx
'use client'

import { useUser } from '@clerk/nextjs'
import { UserButton, SignInButton } from '@clerk/nextjs'
import Link from 'next/link'
import Image from 'next/image'
import { useCustomerCount } from '@/hooks/useCustomerCount'
import { Button } from '@/components/ui/button'

export function Navbar() {
  const { isSignedIn } = useUser()
  const { count } = useCustomerCount()
  
  // Calculate remaining spots and urgency
  const remainingSpots = 100 - (count || 0)
  const isLow = remainingSpots <= 20

  return (
    <header className="relative bg-white">
      <div className="container mx-auto px-4">
        <nav className="h-16 flex items-center justify-between">
          {/* Left section with logo - Updated */}
          <Link 
            href="/" 
            className="flex items-center gap-3 group hover:opacity-90 transition-opacity"
          >
            <Image
              src="/images/hero/PAT-logo.png" // Make sure to add your logo image
              alt="PAT Mentorship Logo"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="text-xl font-semibold">
              PRICE ACTION TRADER
            </span>
          </Link>

          {/* Right section */}
          <div className="flex items-center gap-4">
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

            {/* Auth Buttons */}
            {isSignedIn ? (
              <div className="flex items-center gap-3">
                <Button asChild variant="outline">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
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
              <SignInButton mode="modal">
                <Button>
                  Anmelden →
                </Button>
              </SignInButton>
            )}
          </div>
        </nav>
      </div>

      {/* Gradient Border */}
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-gray-300 to-transparent animate-gradient-x" />
    </header>
  )
}