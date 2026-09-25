import { MENTORSHIP_CONFIG } from '@/lib/config'

/**
 * Inhalte und Ziele der Landingpage /lp-v3.
 * Regeln für alle sichtbaren Texte: Du-Ansprache, keine Gedankenstriche (U+2013, U+2014), keine Gewinnversprechen.
 * Der Test lib/landing-v3-content.test.mjs prüft die Gedankenstriche für den ganzen Ordner.
 */

/**
 * Ziel aller Kaufbuttons "Mentorship starten". Die Seite /checkout kommt aus dem Gast-Checkout.
 * Die Position steht als src im Link, damit Stripe-Sessions ohne Einwilligung nach Quelle zählbar sind.
 */
export const CHECKOUT_URL = '/checkout'
// Wie der bisherige Einstieg: nach der Anmeldung in den Kaufbereich bzw. zur Mentorship.
export const SIGN_IN_URL = '/sign-in?redirect_url=%2Fdashboard'

export type CtaPosition = 'nav' | 'hero' | 'offer' | 'final' | 'mbar'

export function ctaSource(position: CtaPosition) {
  return `lp3-${position}`
}

export function checkoutHref(position: CtaPosition) {
  return `${CHECKOUT_URL}?src=${ctaSource(position)}`
}

export const CTA_LABEL = 'Mentorship starten'

export const NAV_LINKS = [
  { href: '#ablauf', label: 'Ablauf' },
  { href: '#lehrplan', label: 'Lehrplan' },
  { href: '#stimmen', label: 'Stimmen' },
  { href: '#preis', label: 'Preis' },
  { href: '#fragen', label: 'Fragen' },
] as const

export const ASSURE = {
  title: 'Monatlich kündbar.',
  detail: 'Einstieg jederzeit, alle Lektionen inklusive.',
  short: 'Einstieg jederzeit',
} as const

/** Fallback, falls Whop beim Rendern nicht erreichbar oder nicht konfiguriert ist (Stand 25.09.2026). */
export const WHOP_FALLBACK = { count: 58, average: 5 } as const
export const WHOP_URL = 'https://whop.com/price-action-trader-mentorship-24-d9/pat-mentorship-2025/'
export const YOUTUBE_URL = 'https://www.youtube.com/@PriceActionTrader_Petar'
export const CONTACT_EMAIL = 'kontakt@price-action-trader.de'

export function formatRating(average: number) {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(average)
}

export const PRICE_LABEL = `${MENTORSHIP_CONFIG.price} €`

export const PHASES = [
  {
    when: 'Monat 1 bis 3',
    title: 'Grundlagen',
    items: ['Bias und Liquidität', 'PD-Array-Matrix: FVG, Orderblock, Breaker', 'Wichtige Zeiten: Makros, Silver Bullet, Sessions', 'Journaling-Methoden'],
  },
  {
    when: 'Monat 4 bis 6',
    title: 'Vertiefung',
    items: ['Zeitbasierte Liquidität und PD Arrays', 'Einstiegstechniken', 'Grundlagen im Risikomanagement'],
  },
  {
    when: 'Monat 7 bis 9',
    title: 'Anwendung',
    items: ['Die Konzepte am Live-Markt', 'Trade-Review-Workshops', 'Fortgeschrittenes Risikomanagement'],
  },
  {
    when: 'Monat 10 bis 12',
    title: 'Feinschliff',
    items: ['Trading-Psychologie', 'Bias aus höheren Timeframes', 'Persönliche Strategieentwicklung'],
  },
] as const

export const COURSES = [
  { src: '/images/mentorship/modules/core-march-2026.webp', title: 'Core Content März 2026', text: 'Die Grundlagen, Modul für Modul' },
  { src: '/images/mentorship/modules/advanced-september-2026.webp', title: 'Advanced Content September', text: 'Vertiefende Sessions wie Tape Reading' },
  { src: '/images/mentorship/modules/daily-september-2026.webp', title: 'Daily Reviews September', text: 'Markt-Reviews am Dienstag und Donnerstag' },
] as const

export const QUOTES = [
  {
    text: 'Plötzlich ist nichts mehr nur Zufall in der Price Action, sondern ich weiß das erste Mal, auf was ich warte.',
    name: 'Claudia P.',
    role: 'Future Trader',
    hideOnTablet: false,
  },
  {
    text: 'Mit Petar als Mentor war ich in der Lage, das Wissen Schritt für Schritt aufzubauen und in der Praxis anzuwenden.',
    name: 'Oliver B.',
    role: 'Future Trader',
    hideOnTablet: false,
  },
  {
    text: 'Petar vermittelt die Inhalte mit einer Engelsgeduld auf eine sehr angenehme Weise und auch die Community hinter Petar ist ein absoluter Mehrwert.',
    name: 'Bernhard K.',
    role: 'Future Trader Beginner',
    hideOnTablet: true,
  },
] as const

export const OFFER_FEATURES = [
  'Alle Lektionen und Aufzeichnungen, solange du dabei bist',
  'Zwei Live-Sessions pro Woche, Di und Do um 19:00',
  'Daily Reviews am Di und Do, Weekly Recap am Sonntag',
  'Q&A-Livestream am Monatsende',
  'Community auf Discord',
] as const

export const FAQ = [
  {
    q: 'Wie funktioniert das Abo?',
    a: `Die Mentorship kostet ${MENTORSHIP_CONFIG.price} € pro Monat inklusive MwSt. und ist mit einem Tag Frist zum Monatsende kündbar. Nach der Kündigung behältst du den Zugang bis zum Ende der bezahlten Periode.`,
  },
  {
    q: 'Welche Erfahrung brauche ich?',
    a: 'Grundkenntnisse der Marktprinzipien helfen, sind aber keine Pflicht. Das Programm ist straff, beginnt aber bei den Grundkonzepten und baut von dort Schritt für Schritt auf.',
  },
  {
    q: 'Wie viel Zeit sollte ich einplanen?',
    a: 'Ich empfehle 5 bis 10 Stunden pro Woche: 2 bis 3 Stunden für die Live-Sessions, 2 bis 3 Stunden für Übungen und etwas Zeit für die Community. Alle Sessions werden aufgezeichnet.',
  },
  {
    q: 'Bekomme ich Signale für meine Trades?',
    a: 'Nein. Die Live-Sessions sind kein Copy-Trading. Du sollst verstehen, was du siehst, und unabhängig von mir entscheiden können.',
  },
  {
    q: 'Ist mein Erfolg garantiert?',
    a: 'Nein. Wie viel du mitnimmst, hängt von dir ab. Ich erkläre dir die Konzepte so klar ich kann. Lernen und üben musst du selbst.',
  },
  {
    q: 'Welche Software brauche ich?',
    a: 'Ich arbeite mit TradingView und empfehle es für die Mentorship. Die Konzepte lassen sich aber mit jeder Chart-Software lernen, die Kerzencharts und Zeichenwerkzeuge hat.',
  },
  {
    q: 'Welche Märkte schauen wir uns an?',
    a: 'Vor allem Index-Futures wie ES und NQ. Im Verlauf der Mentorship schauen wir auch auf Währungs-Futures und Rohstoffe.',
  },
] as const

export const RISK_NOTE =
  'Trading ist mit Risiken verbunden. Die Inhalte dienen der Bildung und sind keine Anlageberatung. Price Action Trader ist ein unabhängiges Angebot und nicht mit ICT (Inner Circle Trader) verbunden.'
