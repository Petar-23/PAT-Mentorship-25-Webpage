import type { Metadata } from 'next'
import { LoginLinkSignIn } from '@/components/checkout/login-link-sign-in'

// Ziel des Login-Links aus der Vertragsbestätigung (lib/checkout-fulfillment.ts, createLoginLink).

export const metadata: Metadata = {
  title: 'Anmelden',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default function LoginLinkPage() {
  return <LoginLinkSignIn />
}
