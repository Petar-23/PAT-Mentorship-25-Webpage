// Winzige Research-Erkennung für das Root-Chrome (Clerk-Sprache, Tracking,
// Cookie-Banner). Dieses Modul landet im Client-Bundle JEDER Seite der Website,
// deshalb bewusst ohne Imports (keine Konfiguration, keine Einwilligungstexte).
// Es entscheidet nur über Darstellung, nie über Zugriff — die vollständige,
// sicherheitsrelevante Host-/Pfad-Logik steht in lib/research/routing.mjs.

// Namenskonvention der Research-Hosts (Production, Staging, research.localhost).
export const RESEARCH_BROWSER_HOST_PREFIXES = Object.freeze(['research.', 'research-staging.'])

/**
 * true für research.* / research-staging.* (Browser-Hostname, ohne Port).
 * @param {string | null | undefined} hostname
 * @returns {boolean}
 */
export function isResearchSurfaceHostname(hostname) {
  if (typeof hostname !== 'string') return false
  const normalized = hostname.trim().toLowerCase()
  return RESEARCH_BROWSER_HOST_PREFIXES.some((prefix) => normalized.startsWith(prefix) && normalized.length > prefix.length)
}

/**
 * true für den sichtbaren Pfad-Modus /research und /research/* (Previews, lokal).
 * @param {string | null | undefined} pathname
 * @returns {boolean}
 */
export function isResearchSurfacePathname(pathname) {
  return typeof pathname === 'string' && (pathname === '/research' || pathname.startsWith('/research/'))
}
