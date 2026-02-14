// Zentrale Konfiguration für PAT Mentorship
// Änderungen hier wirken sich auf die gesamte Website aus.

export const MENTORSHIP_CONFIG = {
  // Pricing
  price: 150,
  priceFormatted: '€150',
  priceWithTax: '€150/Monat (inkl. MwSt.)',
  currency: 'EUR',

  // Program
  programName: 'PAT Mentorship 2026',
  cohort: 'M26',
  maxSpots: 100,
  startDate: '2026-03-01T00:00:00+01:00',
  startDateFormatted: '01.03.2026',
  startMonthYear: 'März 2026',

  // Content
  sessionsPerWeek: '2',
  sessionDays: 'Di + Do',
} as const

export type MentorshipConfig = typeof MENTORSHIP_CONFIG
