'use client'

import { useSyncExternalStore } from 'react'
import {
  getCookieConsentServerSnapshot,
  getCookieConsentSnapshot,
  subscribeCookieConsent,
} from '@/lib/cookie-settings'

export function useCookieConsent() {
  return useSyncExternalStore(
    subscribeCookieConsent,
    getCookieConsentSnapshot,
    getCookieConsentServerSnapshot
  )
}
