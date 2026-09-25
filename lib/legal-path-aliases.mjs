// Rechtsseiten liegen unter /AGB und /Widerruf. Andere Schreibweisen wie /agb
// oder /widerruf sollen dauerhaft dorthin weiterleiten.
//
// Das geht nicht über redirects() in next.config.ts: Next vergleicht die
// Quellpfade dort ohne Beachtung der Groß- und Kleinschreibung. Eine Regel
// /agb -> /AGB würde also auch /AGB selbst treffen und endlos weiterleiten.
// Deshalb prüft die Middleware den Pfad hier exakt.
export const LEGAL_ROUTES = ['/AGB', '/Widerruf']

/**
 * Liefert die richtige Route, wenn `pathname` eine Rechtsseite in anderer
 * Schreibweise ist, sonst `null`.
 * @param {string} pathname
 * @returns {string | null}
 */
export function legalPathRedirect(pathname) {
  if (typeof pathname !== 'string') return null
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  const lower = normalized.toLowerCase()
  const target = LEGAL_ROUTES.find((route) => route.toLowerCase() === lower)
  if (!target || target === pathname) return null
  return target
}
