// Host- und Pfad-Routing für PAT Research.
// Reine Funktionen ohne Next-/Node-Abhängigkeiten: Middleware (Edge), Server,
// Client-Komponenten und die node:test-Tests importieren dieses Modul.
// Umgebungswerte werden immer übergeben (in Produktion process.env), nie global gelesen.
//
// Zwei Betriebsarten:
//   Host-Modus  research.price-action-trader.de/pricing → intern app/research/pricing
//               (Basis-Pfad '', der /research-Präfix ist im Browser unsichtbar)
//   Pfad-Modus  <preview-url>/research/pricing, localhost:3000/research/pricing
//               (Basis-Pfad '/research'; nur außerhalb von Production erlaubt)
//
// Kill-Switch: In Production ohne gültigen RESEARCH_PUBLIC_HOST ist Research auf
// keinem Host erreichbar (/research/* und /api/research/* liefern 404).
//
// Sicherheit: Redirect-Ziele sind immer entweder ein relativer Pfad mit genau
// einem führenden "/" (gleicher Host) oder https:// + konfigurierter Research-Host.
//
// Kodierte Trenner: Der Next-Router gleicht Routen auch gegen den dekodierten Pfad
// ab (/research%2Fpricing landet in app/research/pricing). Research-Präfixe werden
// deshalb roh UND dekodiert erkannt (readPath/hasPrefix). Ziele werden nie aus
// dekodierten Eingaben gebaut: solche Varianten bekommen in Production ein 404.
//
// Zweite Linie: Der Middleware-Matcher überspringt Pfade mit Datei-Endung
// (/research/x.css). isResearchServedOnHost() prüft deshalb serverseitig noch
// einmal (lib/research/request-context.ts).

import { RESEARCH_HOST_ENV, RESEARCH_PATH_PREFIX } from './config.mjs'

/** @typedef {'' | '/research'} ResearchBasePath */
/** @typedef {Readonly<Record<string, string | undefined>>} ResearchEnv */
/** @typedef {{ type: 'next' }} ResearchRouteNext */
/** @typedef {{ type: 'rewrite', pathname: string }} ResearchRouteRewrite */
/** @typedef {{ type: 'redirect', location: string, status: 308 }} ResearchRouteRedirect */
/** @typedef {{ type: 'not_found' }} ResearchRouteNotFound */
/** @typedef {ResearchRouteNext | ResearchRouteRewrite | ResearchRouteRedirect | ResearchRouteNotFound} ResearchRoute */
/** @typedef {{ basePath: ResearchBasePath, origin: string, isResearchHost: boolean }} ResearchRequestContext */

// Komma-Liste zusätzlicher Research-Hosts (z. B. eine Staging-Domain neben der öffentlichen).
export const RESEARCH_EXTRA_HOSTS_ENV = 'RESEARCH_EXTRA_HOSTS'
// Erlaubt den Pfad-Modus bei selbst gehostetem `next start` (NODE_ENV=production ohne VERCEL_ENV).
export const RESEARCH_ALLOW_PATH_MODE_ENV = 'RESEARCH_ALLOW_PATH_MODE'
// Lokaler Host-Modus: http://research.localhost:3000 (nur wenn der Pfad-Modus erlaubt ist).
export const RESEARCH_LOCAL_HOST = 'research.localhost'

// Der Browser kennt die Server-Env nicht. Für das Root-Chrome (Clerk-Sprache,
// Tracking, Cookie-Banner) gilt deshalb eine feste Namenskonvention: Research-Hosts
// beginnen mit "research." oder "research-staging." (Production, Staging, research.localhost).
export const RESEARCH_BROWSER_HOST_PREFIXES = Object.freeze(['research.', 'research-staging.'])

// Fallback-Origin, wenn eine Anfrage keinen brauchbaren Host-Header hat.
const MAIN_SITE_ORIGIN = 'https://www.price-action-trader.de'

const PREFIX_SEGMENT = RESEARCH_PATH_PREFIX.slice(1)
const NEXT = Object.freeze(/** @type {ResearchRouteNext} */ ({ type: 'next' }))
const NOT_FOUND = Object.freeze(/** @type {ResearchRouteNotFound} */ ({ type: 'not_found' }))

const HOST_LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?'
const HOSTNAME_PATTERN = new RegExp(`^${HOST_LABEL}(?:\\.${HOST_LABEL})*$`)
const IPV6_HOSTNAME_PATTERN = /^\[[0-9a-f:.]+\]$/
const PORT_PATTERN = /^\d{1,5}$/
const HAS_CONTROL_CHARACTER = /[\u0000-\u001F\u007F]/
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/g
// Framework-Pfade, die auch auf dem Research-Host nie umgeschrieben werden.
// Ganzes Segment, damit "_next%2F..%2Fmentorship" nicht als Framework-Pfad durchgeht.
const FRAMEWORK_SEGMENT_PATTERN = /^(?:_next|_vercel|__nextjs[\w-]*)$/
// Prozentkodierte ASCII-Zeichen (%00–%7F). Nicht-ASCII-Sequenzen ergeben nie "/",
// "\" oder Buchstaben von "research"/"api" und bleiben kodiert (wirft nie).
const PERCENT_ENCODED_ASCII = /%([0-7][0-9a-f])/gi
// Next dekodiert einmal, ein vorgeschalteter Proxy evtl. noch einmal. Mehr Runden
// braucht kein realer Stack; die Grenze hält die Laufzeit bei langen Pfaden klein.
const MAX_DECODE_ROUNDS = 8

/**
 * @param {ResearchEnv | undefined} env
 * @param {string} name
 */
function readEnv(env, name) {
  const value = env?.[name]
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Zerlegt einen Host-Wert ("Research.Example.de:3000") in Hostname und Host
 * (mit Port). Liefert null für alles, was kein reiner Host ist (Schema, Pfad,
 * Userinfo, Leerzeichen, ungültige Ports …).
 * @param {unknown} value
 * @returns {{ hostname: string, host: string } | null}
 */
function parseHost(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null

  let hostname = trimmed
  /** @type {string | null} */
  let port = null
  if (trimmed.startsWith('[')) {
    const end = trimmed.indexOf(']')
    if (end === -1) return null
    hostname = trimmed.slice(0, end + 1)
    const rest = trimmed.slice(end + 1)
    if (rest) {
      if (!rest.startsWith(':')) return null
      port = rest.slice(1)
    }
  } else {
    const colon = trimmed.indexOf(':')
    if (colon !== -1) {
      hostname = trimmed.slice(0, colon)
      port = trimmed.slice(colon + 1)
    }
  }

  if (port !== null && (!PORT_PATTERN.test(port) || Number(port) < 1 || Number(port) > 65535)) return null
  // Vollqualifizierte Namen ("research.example.de.") zeigen auf denselben Host.
  if (hostname.endsWith('.')) hostname = hostname.slice(0, -1)
  if (!HOSTNAME_PATTERN.test(hostname) && !IPV6_HOSTNAME_PATTERN.test(hostname)) return null

  return { hostname, host: port ? `${hostname}:${port}` : hostname }
}

/**
 * Host aus der Konfiguration. Toleriert versehentlich mitkopiertes Schema und
 * abschließende Slashes ("https://research.example.de/"), sonst wie parseHost.
 * @param {unknown} value
 */
function parseConfiguredHost(value) {
  if (typeof value !== 'string') return null
  return parseHost(value.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, ''))
}

/** @param {string} hostname */
function isLoopbackHostname(hostname) {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]'
  )
}

/**
 * Zerlegt einen Pfad in Segmente. Leere Segmente (doppelte, führende oder
 * abschließende Slashes, Backslashes) und Steuerzeichen fallen weg, damit
 * daraus gebaute Ziele nie protokoll-relativ ("//evil") werden können.
 * @param {unknown} pathname
 * @returns {string[]}
 */
function pathSegments(pathname) {
  if (typeof pathname !== 'string') return []
  return pathname.replace(CONTROL_CHARACTERS, '').split(/[/\\]+/).filter(Boolean)
}

/** @param {string} segment */
function decodeSegment(segment) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * Präfix-Vergleich auf dekodierten Segmenten: /%72esearch zählt wie /research,
 * damit prozentkodierte Pfade den Kill-Switch nicht umgehen.
 * @param {string[]} segments
 * @param {string[]} expected
 */
function startsWithSegments(segments, expected) {
  return (
    segments.length >= expected.length &&
    expected.every((segment, index) => decodeSegment(segments[index]) === segment)
  )
}

/**
 * Dekodiert ASCII-Prozentkodierungen wiederholt (%252F → %2F → /), höchstens
 * MAX_DECODE_ROUNDS Runden. Nur zur Erkennung, nie zum Bauen von Zielen.
 * @param {string} pathname
 */
function decodeAsciiEscapes(pathname) {
  let value = pathname
  for (let round = 0; round < MAX_DECODE_ROUNDS; round += 1) {
    const decoded = value.replace(PERCENT_ENCODED_ASCII, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    if (decoded === value) break
    value = decoded
  }
  return value
}

/**
 * Ein Pfad in zwei Lesarten: roh (Segmente wie in der URL, so sieht ihn die
 * Middleware) und dekodiert (so gleicht der Next-Router Routen ab).
 * @param {unknown} pathname
 * @returns {{ raw: string[], decoded: string[] }}
 */
function readPath(pathname) {
  return {
    raw: pathSegments(pathname),
    decoded: typeof pathname === 'string' ? pathSegments(decodeAsciiEscapes(pathname)) : [],
  }
}

/**
 * true, wenn eine der beiden Lesarten mit den Segmenten beginnt.
 * @param {{ raw: string[], decoded: string[] }} path
 * @param {string[]} expected
 */
function hasPrefix(path, expected) {
  return startsWithSegments(path.raw, expected) || startsWithSegments(path.decoded, expected)
}

/**
 * @param {string} base  '' oder ein Pfad ohne abschließenden Slash
 * @param {string[]} segments
 */
function joinPath(base, segments) {
  if (segments.length === 0) return base || '/'
  return `${base}/${segments.join('/')}`
}

/** @param {unknown} search */
function normalizeSearch(search) {
  if (typeof search !== 'string') return ''
  const value = search.replace(CONTROL_CHARACTERS, '')
  if (value === '' || value === '?') return ''
  return value.startsWith('?') ? value : `?${value}`
}

/** @param {unknown} basePath */
function assertBasePath(basePath) {
  if (basePath !== '' && basePath !== RESEARCH_PATH_PREFIX) {
    throw new TypeError(`Research base path must be '' or '${RESEARCH_PATH_PREFIX}'.`)
  }
}

/**
 * Pfad-Modus (/research/* auf beliebigem Host) ist nur außerhalb von
 * Production erlaubt. Vercel-Previews und `next dev` dürfen ihn nutzen,
 * ein selbst gehostetes `next start` nur mit RESEARCH_ALLOW_PATH_MODE=1.
 * Unbekannte VERCEL_ENV-Werte werden wie fehlende behandelt (fail-closed im Build).
 * @param {ResearchEnv} env
 * @returns {boolean}
 */
export function isResearchPathModeAllowed(env) {
  const vercelEnv = readEnv(env, 'VERCEL_ENV')
  if (vercelEnv === 'production') return false
  if (vercelEnv === 'preview' || vercelEnv === 'development') return true
  if (readEnv(env, 'NODE_ENV') === 'production') return readEnv(env, RESEARCH_ALLOW_PATH_MODE_ENV) === '1'
  return true
}

/**
 * Öffentliche Research-Origin ("https://research.price-action-trader.de") aus
 * RESEARCH_PUBLIC_HOST, oder null, wenn nicht (gültig) konfiguriert.
 * @param {ResearchEnv} env
 * @returns {string | null}
 */
export function getResearchPublicOrigin(env) {
  const parsed = parseConfiguredHost(readEnv(env, RESEARCH_HOST_ENV))
  return parsed ? `https://${parsed.host}` : null
}

/**
 * Alle Hostnamen (klein, ohne Port), auf denen Research im Host-Modus läuft.
 * Leer, wenn der Kill-Switch greift (Production ohne RESEARCH_PUBLIC_HOST) —
 * dann zählen auch RESEARCH_EXTRA_HOSTS nicht.
 * @param {ResearchEnv} env
 * @returns {string[]}
 */
export function getResearchHosts(env) {
  const pathModeAllowed = isResearchPathModeAllowed(env)
  const publicHost = parseConfiguredHost(readEnv(env, RESEARCH_HOST_ENV))
  if (!publicHost && !pathModeAllowed) return []

  /** @type {Set<string>} */
  const hosts = new Set()
  if (publicHost) hosts.add(publicHost.hostname)
  for (const entry of readEnv(env, RESEARCH_EXTRA_HOSTS_ENV).split(',')) {
    const parsed = parseConfiguredHost(entry)
    if (parsed) hosts.add(parsed.hostname)
  }
  if (pathModeAllowed) hosts.add(RESEARCH_LOCAL_HOST)
  return [...hosts]
}

/**
 * @param {string | null | undefined} hostname  Host-Header, darf einen Port enthalten
 * @param {ResearchEnv} env
 * @returns {boolean}
 */
export function isResearchHostname(hostname, env) {
  const parsed = parseHost(hostname)
  return parsed !== null && getResearchHosts(env).includes(parsed.hostname)
}

/**
 * @param {string | null | undefined} hostname
 * @param {ResearchEnv} env
 * @returns {ResearchBasePath}
 */
export function researchBasePathForHost(hostname, env) {
  return isResearchHostname(hostname, env) ? '' : RESEARCH_PATH_PREFIX
}

/**
 * Darf eine Anfrage an diesen Host Research ausliefern (Seiten und /api/research/*)?
 * true auf Research-Hosts und überall, wo der Pfad-Modus erlaubt ist (Preview,
 * lokal); false in Production auf dem Haupt-Host und immer bei aktivem Kill-Switch.
 * Serverseitige zweite Linie hinter der Middleware, deren Matcher z. B.
 * /research/x.css überspringt.
 * @param {string | null | undefined} hostname  Host-Header, darf einen Port enthalten
 * @param {ResearchEnv} env
 * @returns {boolean}
 */
export function isResearchServedOnHost(hostname, env) {
  return isResearchPathModeAllowed(env) || isResearchHostname(hostname, env)
}

/**
 * Browser-seitige Erkennung eines Research-Hosts über die Namenskonvention
 * (siehe RESEARCH_BROWSER_HOST_PREFIXES). Nur für Root-Chrome-Entscheidungen,
 * nie für Zugriffsprüfungen.
 * @param {string | null | undefined} hostname
 * @returns {boolean}
 */
export function isResearchBrowserHostname(hostname) {
  const parsed = parseHost(hostname)
  return parsed !== null && RESEARCH_BROWSER_HOST_PREFIXES.some((prefix) => parsed.hostname.startsWith(prefix))
}

/**
 * true für /research und /research/* (Pfad-Modus bzw. intern umgeschriebene Pfade),
 * auch in kodierter Form (/research%2Fpricing), die Next ebenfalls dorthin routet.
 * @param {string | null | undefined} pathname
 * @returns {boolean}
 */
export function isResearchPathname(pathname) {
  return hasPrefix(readPath(pathname), [PREFIX_SEGMENT])
}

/**
 * Baut einen Link innerhalb von Research: researchHref('/research', '/pricing?x=1')
 * === '/research/pricing?x=1', researchHref('', '/') === '/'.
 * Wirft bei allem außer app-relativen Pfaden (absolute oder protokoll-relative
 * URLs, fehlender führender Slash, Steuerzeichen).
 * @param {ResearchBasePath} basePath
 * @param {string} path
 * @returns {string}
 */
export function researchHref(basePath, path) {
  assertBasePath(basePath)
  if (
    typeof path !== 'string' ||
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.startsWith('/\\') ||
    HAS_CONTROL_CHARACTER.test(path)
  ) {
    throw new TypeError('researchHref() expects an app-relative path that starts with a single "/".')
  }
  if (!basePath) return path
  if (path === '/') return basePath
  if (path[1] === '?' || path[1] === '#') return `${basePath}${path.slice(1)}`
  return `${basePath}${path}`
}

/**
 * Logischer Research-Pfad ohne Basis ("/pricing"), immer mit führendem "/",
 * ohne abschließenden Slash. Für aktive Navigation und Rücksprung-Pfade.
 *
 * basePath '/research' (Pfad-Modus): der sichtbare Präfix wird entfernt.
 * basePath '' (Research-Host): Der Browser-Pfad hat nie /research (die Middleware
 * leitet ihn per 308 weg), usePathname() kann beim Server-Rendering aber den intern
 * umgeschriebenen Pfad liefern. Deshalb wird /research auch hier entfernt; Server
 * und Client kommen so zum selben Ergebnis.
 * @param {ResearchBasePath} basePath
 * @param {string | null | undefined} pathname
 * @returns {string}
 */
export function logicalResearchPath(basePath, pathname) {
  assertBasePath(basePath)
  const segments = pathSegments(pathname)
  return joinPath('', startsWithSegments(segments, [PREFIX_SEGMENT]) ? segments.slice(1) : segments)
}

/**
 * Routing-Entscheidung der Middleware für eine Anfrage.
 * @param {{ host: string | null | undefined, pathname: string | null | undefined, search?: string | null, env: ResearchEnv }} request
 * @returns {ResearchRoute}
 */
export function resolveResearchRoute({ host, pathname, search, env }) {
  const path = readPath(pathname)
  const segments = path.raw

  if (isResearchHostname(host, env)) {
    // Entscheidungen hier auf den rohen Segmenten: Alles, was nicht ausdrücklich
    // weitergereicht wird, landet unter /research (auch kodierte Varianten wie
    // /research%2Fpricing → /research/research%2Fpricing → Research-404).
    // Sichtbares /research auf dem Research-Host: auf den kanonischen Pfad ohne Präfix.
    if (startsWithSegments(segments, [PREFIX_SEGMENT])) {
      return { type: 'redirect', location: `${joinPath('', segments.slice(1))}${normalizeSearch(search)}`, status: 308 }
    }
    if (startsWithSegments(segments, ['api', 'v1'])) {
      return { type: 'rewrite', pathname: joinPath('/api/research/v1', segments.slice(2)) }
    }
    if (segments.length === 1 && decodeSegment(segments[0]) === 'mcp') {
      return { type: 'rewrite', pathname: '/api/research/mcp' }
    }
    if (startsWithSegments(segments, ['.well-known', 'oauth-protected-resource'])) {
      return { type: 'rewrite', pathname: joinPath('/api/research/oauth-protected-resource', segments.slice(2)) }
    }
    // Übrige APIs (z. B. /api/research/checkout) und Framework-Pfade laufen unverändert.
    if (startsWithSegments(segments, ['api'])) return NEXT
    if (segments.length > 0 && FRAMEWORK_SEGMENT_PATTERN.test(segments[0])) return NEXT
    return { type: 'rewrite', pathname: joinPath(RESEARCH_PATH_PREFIX, segments) }
  }

  // Roh ODER dekodiert: /research%2Fpricing und /api%2Fresearch%2Fcheckout routet
  // Next ebenfalls in die Research-Bäume, sie dürfen den Kill-Switch nicht umgehen.
  const isResearchPage = hasPrefix(path, [PREFIX_SEGMENT])
  const isResearchApi = hasPrefix(path, ['api', PREFIX_SEGMENT])
  // Haupt-Seite: alles andere bleibt unangetastet.
  if (!isResearchPage && !isResearchApi) return NEXT
  if (isResearchPathModeAllowed(env)) return NEXT

  // Production: Research-Seiten nur noch auf dem Research-Host, APIs dort ebenfalls.
  // Weitergeleitet wird nur die Form mit echten Trennern (/research/…); kodierte
  // Trenner erzeugt kein eigener Link, sie bekommen ein 404 statt eines Ziels aus
  // dekodierter Eingabe.
  if (startsWithSegments(segments, [PREFIX_SEGMENT])) {
    const publicOrigin = getResearchPublicOrigin(env)
    if (publicOrigin) {
      return {
        type: 'redirect',
        location: `${publicOrigin}${joinPath('', segments.slice(1))}${normalizeSearch(search)}`,
        status: 308,
      }
    }
  }
  return NOT_FOUND
}

/**
 * Basis-Pfad und Origin einer Anfrage aus Host-Header und x-forwarded-proto.
 * Protokoll: x-forwarded-proto (http/https), sonst http für localhost und
 * 127.0.0.1, sonst https. Ohne gültigen Host: Pfad-Modus mit NEXT_PUBLIC_APP_URL
 * (bzw. der Haupt-Domain) als Origin.
 * @param {{ host: string | null | undefined, forwardedProto?: string | null, env: ResearchEnv }} request
 * @returns {ResearchRequestContext}
 */
export function resolveResearchRequestContext({ host, forwardedProto, env }) {
  const parsed = parseHost(host)
  if (!parsed) {
    return { basePath: RESEARCH_PATH_PREFIX, origin: fallbackOrigin(env), isResearchHost: false }
  }

  const isResearchHost = getResearchHosts(env).includes(parsed.hostname)
  const proto = typeof forwardedProto === 'string' ? forwardedProto.split(',')[0].trim().toLowerCase() : ''
  const protocol = proto === 'http' || proto === 'https' ? proto : isLoopbackHostname(parsed.hostname) ? 'http' : 'https'
  return {
    basePath: isResearchHost ? '' : RESEARCH_PATH_PREFIX,
    origin: `${protocol}://${parsed.host}`,
    isResearchHost,
  }
}

/** @param {ResearchEnv} env */
function fallbackOrigin(env) {
  const configured = readEnv(env, 'NEXT_PUBLIC_APP_URL')
  if (configured) {
    try {
      const url = new URL(configured)
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin
    } catch {
      // ungültige Konfiguration → Haupt-Domain
    }
  }
  return MAIN_SITE_ORIGIN
}
