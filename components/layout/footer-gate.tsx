'use client'

import { usePathname } from 'next/navigation'
import { Footer } from './footer'

export function FooterGate() {
  const pathname = usePathname()

  if (pathname.startsWith('/mentorship')) {
    return null
  }

  return <Footer />
}



