import { NextResponse } from 'next/server'

// Request-Guards für die Research-API-Routen (POST mit Cookie-Session).
//
// isSameOriginRequest: CSRF-Schutz. Verlangt einen Origin-Header, dessen Host
// dem Host-Header der Anfrage entspricht (Groß-/Kleinschreibung egal, Port
// zählt, Standard-Ports 80/443 werden normalisiert). Nur wenn der Origin-Header
// ganz fehlt, zählt ersatzweise der Referer. "null"-Origins (Sandbox-iframes,
// file://, manche Redirect-Ketten) werden immer abgelehnt.
//
// Bewusst der Host-Header und nicht request.url: Hinter der Middleware-
// Rewrite-Schicht (research.* → /api/research/*) bleibt der Host-Header der
// sichtbare Host, request.url kann intern abweichen.

// Hostname (DNS-Labels) oder IPv6-Literal, optional mit Port. Keine Pfade,
// kein userinfo, keine Leerzeichen.
const HOST_HEADER_PATTERN =
  /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*|\[[0-9a-f:.]+\])(?::\d{1,5})?$/i

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

// Host-Header im Schema der Quelle normalisieren ("example.com:443" bei https
// → "example.com"). Ungültige Host-Header → null.
function normalizeHostHeader(hostHeader: string, protocol: string): string | null {
  if (!HOST_HEADER_PATTERN.test(hostHeader)) return null
  try {
    return new URL(`${protocol}//${hostHeader}`).host
  } catch {
    return null
  }
}

function sourceMatchesHost(source: string, hostHeader: string, originOnly: boolean): boolean {
  const url = parseHttpUrl(source)
  if (!url || url.username || url.password) return false
  // Ein Origin-Header ist nur "schema://host[:port]".
  if (originOnly && (url.pathname !== '/' || url.search || url.hash)) return false

  const expectedHost = normalizeHostHeader(hostHeader, url.protocol)
  return expectedHost !== null && url.host === expectedHost
}

export function isSameOriginRequest(request: Request): boolean {
  const hostHeader = request.headers.get('host')?.trim()
  if (!hostHeader) return false

  // Fetch-Metadata als zusätzliche Absicherung: Browser markieren fremde
  // Seiten eindeutig als cross-site.
  if (request.headers.get('sec-fetch-site')?.trim().toLowerCase() === 'cross-site') return false

  const origin = request.headers.get('origin')
  if (origin !== null) {
    const trimmed = origin.trim()
    if (trimmed.length === 0 || trimmed.toLowerCase() === 'null') return false
    return sourceMatchesHost(trimmed, hostHeader, true)
  }

  const referer = request.headers.get('referer')?.trim()
  if (!referer) return false
  return sourceMatchesHost(referer, hostHeader, false)
}

/** Einheitliche JSON-Fehlerantwort der Research-API: `{ code, message }`. */
export function jsonError(
  status: number,
  code: string,
  message: string,
  init?: { headers?: HeadersInit }
): NextResponse<{ code: string; message: string }> {
  return NextResponse.json({ code, message }, { status, headers: init?.headers })
}
