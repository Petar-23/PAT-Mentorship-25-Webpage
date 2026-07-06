import { MENTORSHIP_CONFIG } from '@/lib/config'
import { sanitizePublicEnv } from '@/lib/public-env'

/**
 * Hilfsfunktion um Events an gtag zu senden.
 * Schlankes Utility, damit CTA-Komponenten nicht die GTM-React-Komponente importieren.
 */
export function trackEvent(eventName: string, eventParams?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, eventParams)
  }
}

/**
 * Spezifische Conversion-Events für Google Ads.
 */
export const trackConversion = {
  ctaClick: () => {
    trackEvent('cta_click', {
      event_category: 'engagement',
      event_label: 'hero_cta',
    })
  },

  signInStart: () => {
    trackEvent('sign_in_start', {
      event_category: 'engagement',
      event_label: 'begin_sign_in',
    })
  },

  signInComplete: () => {
    trackEvent('sign_in_complete', {
      event_category: 'conversion',
      event_label: 'user_authenticated',
    })
  },

  checkoutStart: () => {
    trackEvent('begin_checkout', {
      event_category: 'conversion',
      event_label: 'checkout_initiated',
    })
  },

  leadMagnetSignup: () => {
    const googleAdsId = sanitizePublicEnv(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID)
    const conversionLabel =
      sanitizePublicEnv(process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_CONVERSION_LABEL) ??
      sanitizePublicEnv(process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL)

    trackEvent('generate_lead', {
      event_category: 'conversion',
      event_label: 'quick_guide_signup',
      value: 0,
      currency: 'EUR',
    })

    if (googleAdsId && conversionLabel && typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', 'conversion', {
        send_to: `${googleAdsId}/${conversionLabel}`,
        value: 0,
        currency: 'EUR',
      })
    }
  },

  purchase: (value?: number) => {
    const googleAdsId = sanitizePublicEnv(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID)
    const conversionLabel = sanitizePublicEnv(process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL)

    trackEvent('purchase', {
      event_category: 'conversion',
      event_label: 'subscription_started',
      value: value ?? MENTORSHIP_CONFIG.price,
      currency: MENTORSHIP_CONFIG.currency,
    })

    if (googleAdsId && conversionLabel && typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', 'conversion', {
        send_to: `${googleAdsId}/${conversionLabel}`,
        value: value ?? MENTORSHIP_CONFIG.price,
        currency: MENTORSHIP_CONFIG.currency,
      })
    }
  },
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}
