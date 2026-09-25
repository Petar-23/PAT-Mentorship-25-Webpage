import { sendGoogleAdsConversion, sendGoogleEvent } from '@/components/analytics/google-tag'
import { MENTORSHIP_CONFIG } from '@/lib/config'
import { sanitizePublicEnv } from '@/lib/public-env'

/**
 * Hilfsfunktion um Events an gtag zu senden.
 * Schlankes Utility, damit CTA-Komponenten nicht die GTM-React-Komponente importieren.
 * Ohne Einwilligung (Analyse oder Marketing) ein No-op: es wird nichts gesendet und nichts gepuffert.
 */
export function trackEvent(eventName: string, eventParams?: Record<string, unknown>) {
  sendGoogleEvent(eventName, eventParams)
}

/**
 * Spezifische Conversion-Events für Google Ads.
 */
export const trackConversion = {
  ctaClick: (source = 'hero_cta') => {
    trackEvent('cta_click', {
      event_category: 'engagement',
      event_label: source,
      cta_source: source,
    })
  },

  signInStart: (source = 'unknown_cta') => {
    trackEvent('sign_in_start', {
      event_category: 'engagement',
      event_label: 'begin_sign_in',
      cta_source: source,
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
    const conversionLabel =
      sanitizePublicEnv(process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_CONVERSION_LABEL) ??
      sanitizePublicEnv(process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL)

    trackEvent('generate_lead', {
      event_category: 'conversion',
      event_label: 'quick_guide_signup',
      value: 0,
      currency: 'EUR',
    })

    sendGoogleAdsConversion(conversionLabel, {
      value: 0,
      currency: 'EUR',
    })
  },

  purchase: (value?: number) => {
    const conversionLabel = sanitizePublicEnv(process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL)

    trackEvent('purchase', {
      event_category: 'conversion',
      event_label: 'subscription_started',
      value: value ?? MENTORSHIP_CONFIG.price,
      currency: MENTORSHIP_CONFIG.currency,
    })

    sendGoogleAdsConversion(conversionLabel, {
      value: value ?? MENTORSHIP_CONFIG.price,
      currency: MENTORSHIP_CONFIG.currency,
    })
  },
}
