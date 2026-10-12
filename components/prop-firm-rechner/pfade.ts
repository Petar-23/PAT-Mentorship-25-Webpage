/**
 * Adressen beider Fassungen des Prop-Firm-Rechners (Sprachwahl, hreflang, Sitemap, Navbar).
 * Eigenes kleines Modul, damit die globale Navbar nicht die Wörterbücher mitlädt.
 */
export const PFADE = {
  de: '/tools/prop-firm-rechner',
  en: '/en/tools/prop-firm-calculator',
} as const

export const RECHNER_PFADE: readonly string[] = [PFADE.de, PFADE.en]
