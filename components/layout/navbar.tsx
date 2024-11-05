// src/components/layout/navbar.tsx
import Link from 'next/link'
import AuthButtons from './auth-buttons'

export default function Navbar() {
  return (
    <>
      {/* Spacer div to prevent content from going under fixed navbar */}
      <div className="h-16" />
      
      {/* Fixed navbar */}
      <header className="fixed top-0 left-0 right-0 bg-white border-b z-50">
        <div className="w-full">
          <nav className="h-16 px-4 md:px-6 lg:px-8 flex items-center justify-between max-w-[1600px] mx-auto">
            <Link href="/" className="font-bold text-xl">
              Mentorship 2025
            </Link>

            <AuthButtons />
          </nav>
        </div>
      </header>
    </>
  )
}