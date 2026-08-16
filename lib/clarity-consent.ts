export type ClarityConsentApi = (...args: unknown[]) => void

export function syncClarityConsent(
  clarity: ClarityConsentApi | undefined,
  analyticsGranted: boolean
) {
  if (!clarity) return false

  clarity('consentv2', {
    ad_Storage: 'denied',
    analytics_Storage: analyticsGranted ? 'granted' : 'denied',
  })

  if (!analyticsGranted) {
    // Microsoft documents this call as the way to erase existing Clarity
    // cookies and stop further tracking after consent is withdrawn.
    clarity('consent', false)
  }

  return true
}
