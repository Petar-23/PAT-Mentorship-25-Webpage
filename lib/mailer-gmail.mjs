// E-Mail-Versand über Google Workspace: Gmail-API mit Dienstkonto und domänenweiter Delegation.
// Reine Bausteine ohne Zugriff auf Umgebungsvariablen: lib/mailer.ts liest die Konfiguration und
// setzt fetch, Uhr und Zufall ein, lib/mailer-gmail.test.mjs Attrappen. Keine zusätzliche
// Bibliothek, signiert wird mit node:crypto.
//
// Einrichtung (einmalig):
// 1. Google Cloud Console: Projekt mit aktivierter Gmail-API, Dienstkonto anlegen, JSON-Schlüssel
//    erzeugen.
// 2. Google Admin-Konsole > Sicherheit > Zugriffs- und Datenverwaltung > API-Steuerung >
//    Domainweite Delegation: Client-ID des Dienstkontos mit genau dem Bereich
//    https://www.googleapis.com/auth/gmail.send eintragen.
// 3. Env setzen: GOOGLE_MAIL_SERVICE_ACCOUNT (JSON-Schlüssel, roh oder base64-kodiert),
//    MAIL_SENDER_EMAIL (Workspace-Postfach, in dessen Namen gesendet wird, z. B.
//    petar@price-action-trader.de), MAIL_SENDER_NAME (z. B. "Petar | Price Action Trader").
//
// Ablauf je Mail: Zugangstoken per OAuth-JWT-Bearer (RS256, sub = Absender) holen oder aus dem
// Cache nehmen, MIME-Nachricht bauen, base64url-kodiert an users/me/messages/send schicken.
// Gmail liefert an To und Bcc aus und entfernt die Bcc-Zeile vor der Zustellung. Jede gesendete
// Mail liegt danach auch im Ordner "Gesendet" des Absenders.

import { createPrivateKey, randomBytes as nodeRandomBytes, sign } from 'node:crypto'

export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send'
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
export const JWT_BEARER_GRANT = 'urn:ietf:params:oauth:grant-type:jwt-bearer'

// Google akzeptiert höchstens eine Stunde Gültigkeit für die Assertion.
const ASSERTION_LIFETIME_S = 3600
// Token wird so lange vor Ablauf erneuert, damit kein Versand mit einem gerade ablaufenden Token läuft.
export const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000
export const DEFAULT_TIMEOUT_MS = 8_000
export const DEFAULT_SENDER_NAME = 'PRICE ACTION TRADER'

/**
 * @typedef {import('node:crypto').KeyObject} KeyObject
 * @typedef {{ clientEmail: string, privateKey: KeyObject, privateKeyId: string | null }} ServiceAccount
 * @typedef {'invalid_message' | 'token_failed' | 'send_failed'} MailErrorCode
 * @typedef {(url: string, init: RequestInit) => Promise<Response>} FetchLike
 *
 * @typedef {{
 *   to: string,
 *   bcc?: string | null,
 *   replyTo?: string | null,
 *   subject: string,
 *   text: string,
 *   html: string,
 * }} OutgoingMail
 *
 * @typedef {{
 *   from: { email: string, name?: string | null },
 *   date: Date,
 *   messageId: string,
 *   boundary: string,
 * } & OutgoingMail} MimeInput
 *
 * @typedef {{
 *   send: (mail: OutgoingMail, options?: { timeoutMs?: number }) => Promise<{ id: string | null }>,
 *   clearTokenCache: () => void,
 * }} GmailSender
 *
 * @typedef {{ status: 'ok', serviceAccount: ServiceAccount, senderEmail: string, senderName: string }} MailerConfigOk
 * @typedef {{ status: 'missing', missing: string[] }} MailerConfigMissing
 * @typedef {{ status: 'invalid', error: string }} MailerConfigInvalid
 * @typedef {MailerConfigOk | MailerConfigMissing | MailerConfigInvalid} MailerConfig
 */

export class MailError extends Error {
  /**
   * @param {MailErrorCode} code
   * @param {string} message Nie mit Schlüsselmaterial oder Nachrichteninhalt.
   */
  constructor(code, message) {
    super(message)
    this.name = 'MailError'
    this.code = code
  }
}

// ---------------------------------------------------------------------------
// Kodierung
// ---------------------------------------------------------------------------

/**
 * base64url ohne Auffüllzeichen (RFC 4648, Abschnitt 5), für JWT und die Rohnachricht.
 * @param {string | Uint8Array} input Zeichenketten werden als UTF-8 kodiert.
 */
export function base64url(input) {
  const buffer = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input)
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// ---------------------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------------------

/**
 * Liest den JSON-Schlüssel eines Dienstkontos, roh oder base64-kodiert. Fehlermeldungen enthalten
 * nie Teile des Werts (JSON.parse würde einen Ausschnitt in die Meldung schreiben).
 * @param {unknown} raw
 * @returns {ServiceAccount}
 */
export function parseServiceAccount(raw) {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) throw new Error('GOOGLE_MAIL_SERVICE_ACCOUNT is empty')

  let json = value
  if (!value.startsWith('{') && !value.startsWith('[')) {
    // Node ignoriert beim Dekodieren Zeilenumbrüche und akzeptiert auch die URL-sichere Variante.
    json = Buffer.from(value, 'base64').toString('utf8').trim()
    if (!json.startsWith('{') && !json.startsWith('[')) {
      throw new Error('GOOGLE_MAIL_SERVICE_ACCOUNT is neither JSON nor base64-encoded JSON')
    }
  }

  /** @type {unknown} */
  let data
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('GOOGLE_MAIL_SERVICE_ACCOUNT contains invalid JSON')
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('GOOGLE_MAIL_SERVICE_ACCOUNT must be a JSON object')
  }

  const record = /** @type {Record<string, unknown>} */ (data)
  if (record.type !== undefined && record.type !== 'service_account') {
    throw new Error('GOOGLE_MAIL_SERVICE_ACCOUNT is not a service account key (type must be "service_account")')
  }

  const clientEmail = typeof record.client_email === 'string' ? record.client_email.trim() : ''
  if (!isEmailAddress(clientEmail)) {
    throw new Error('GOOGLE_MAIL_SERVICE_ACCOUNT has no valid client_email')
  }

  // Doppelt maskierte Zeilenumbrüche ("\\n") kommen vor, wenn der Schlüssel von Hand eingefügt wurde.
  const pem = typeof record.private_key === 'string' ? record.private_key.replace(/\\n/g, '\n') : ''
  if (!pem.includes('PRIVATE KEY')) {
    throw new Error('GOOGLE_MAIL_SERVICE_ACCOUNT has no private_key')
  }

  /** @type {KeyObject} */
  let privateKey
  try {
    privateKey = createPrivateKey(pem)
  } catch {
    throw new Error('GOOGLE_MAIL_SERVICE_ACCOUNT private_key cannot be read')
  }
  if (privateKey.asymmetricKeyType !== 'rsa') {
    throw new Error('GOOGLE_MAIL_SERVICE_ACCOUNT private_key is not an RSA key')
  }

  const privateKeyId =
    typeof record.private_key_id === 'string' && record.private_key_id.trim() ? record.private_key_id.trim() : null

  return { clientEmail, privateKey, privateKeyId }
}

/**
 * Liest die Mail-Konfiguration aus den Umgebungsvariablen (als Objekt übergeben).
 * @param {Record<string, string | undefined>} env
 * @returns {MailerConfig}
 */
export function readMailerEnv(env) {
  const rawAccount = env.GOOGLE_MAIL_SERVICE_ACCOUNT?.trim() ?? ''
  const rawSender = env.MAIL_SENDER_EMAIL?.trim() ?? ''
  const missing = [
    ...(rawAccount ? [] : ['GOOGLE_MAIL_SERVICE_ACCOUNT']),
    ...(rawSender ? [] : ['MAIL_SENDER_EMAIL']),
  ]
  if (missing.length > 0) return { status: 'missing', missing }

  try {
    const serviceAccount = parseServiceAccount(rawAccount)
    if (!isEmailAddress(rawSender)) throw new Error('MAIL_SENDER_EMAIL is not a valid email address')
    const senderName = sanitizeHeaderText(env.MAIL_SENDER_NAME ?? '') || DEFAULT_SENDER_NAME
    return { status: 'ok', serviceAccount, senderEmail: rawSender, senderName }
  } catch (error) {
    return { status: 'invalid', error: error instanceof Error ? error.message : 'invalid mail configuration' }
  }
}

// ---------------------------------------------------------------------------
// Zugangstoken (OAuth 2.0 JWT-Bearer, RFC 7523)
// ---------------------------------------------------------------------------

/**
 * Signierte Assertion für den Token-Endpunkt. sub ist das Workspace-Postfach, in dessen Namen das
 * Dienstkonto per domänenweiter Delegation sendet.
 * @param {{
 *   serviceAccount: ServiceAccount,
 *   subject: string,
 *   now: Date,
 *   scope?: string,
 *   audience?: string,
 *   lifetimeSeconds?: number,
 * }} input
 */
export function buildJwtAssertion({
  serviceAccount,
  subject,
  now,
  scope = GMAIL_SEND_SCOPE,
  audience = GOOGLE_TOKEN_URL,
  lifetimeSeconds = ASSERTION_LIFETIME_S,
}) {
  const iat = Math.floor(now.getTime() / 1000)
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    ...(serviceAccount.privateKeyId ? { kid: serviceAccount.privateKeyId } : {}),
  }
  const claims = {
    iss: serviceAccount.clientEmail,
    sub: subject,
    scope,
    aud: audience,
    iat,
    exp: iat + lifetimeSeconds,
  }
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`
  // RS256 = RSASSA-PKCS1-v1_5 mit SHA-256, die Voreinstellung von crypto.sign für RSA-Schlüssel.
  const signature = sign('sha256', Buffer.from(signingInput, 'utf8'), serviceAccount.privateKey)
  return `${signingInput}.${base64url(signature)}`
}

// ---------------------------------------------------------------------------
// MIME
// ---------------------------------------------------------------------------

const PRINTABLE_ASCII = /^[\x20-\x7e]*$/
const ADDRESS_CHARS = /^[\x21-\x7e]+$/
const ADDRESS_SHAPE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/
const MESSAGE_ID_SHAPE = /^<[^\s<>@]+@[^\s<>@]+>$/
const BOUNDARY_SHAPE = /^[0-9A-Za-z'()+_,./:=?-]{1,70}$/
// Ein encoded-word darf höchstens 75 Zeichen haben: "=?UTF-8?B?" + 60 Zeichen base64 + "?=" = 72.
// 45 Bytes ergeben genau 60 Zeichen base64.
const MAX_ENCODED_WORD_BYTES = 45
const MAX_HEADER_LINE = 78

/** @param {unknown} value */
function isEmailAddress(value) {
  return (
    typeof value === 'string' &&
    value.length <= 254 &&
    ADDRESS_CHARS.test(value) &&
    ADDRESS_SHAPE.test(value)
  )
}

/**
 * Gibt eine einzelne E-Mail-Adresse zurück oder wirft. Lehnt CR, LF, Leerzeichen, Kommas, spitze
 * Klammern und alles außerhalb von ASCII ab, damit keine zusätzlichen Kopfzeilen oder Empfänger
 * eingeschleust werden können. Die Meldung enthält die Adresse nicht.
 * @param {unknown} value
 * @param {string} field
 */
export function assertAddress(value, field) {
  const email = typeof value === 'string' ? value.trim() : ''
  if (!isEmailAddress(email)) throw new MailError('invalid_message', `Invalid ${field} address`)
  return email
}

/**
 * Freitext für Kopfzeilen: Steuerzeichen (auch CR und LF) werden zu Leerzeichen, mehrere
 * Leerzeichen zu einem. So kann niemand über Name oder Betreff eine neue Kopfzeile beginnen.
 * @param {unknown} value
 */
export function sanitizeHeaderText(value) {
  let out = ''
  for (const char of String(value ?? '')) {
    const code = /** @type {number} */ (char.codePointAt(0))
    out += code < 0x20 || code === 0x7f ? ' ' : char
  }
  return out.replace(/ {2,}/g, ' ').trim()
}

/**
 * RFC 2047: UTF-8 in B-Kodierung, aufgeteilt auf encoded-words mit ganzen Zeichen.
 * @param {string} text
 * @param {number} [firstWordMax] Platz für das erste Wort in der Kopfzeile (nach "Name: "), damit
 *   auch die erste Zeile höchstens 78 Zeichen hat. Folgewörter stehen auf eigenen Zeilen.
 * @returns {string[]}
 */
export function encodeWords(text, firstWordMax = 75) {
  // "=?UTF-8?B?" und "?=" sind 12 Zeichen, je 3 Bytes werden 4 Zeichen base64.
  const firstBytes = Math.max(3, Math.min(MAX_ENCODED_WORD_BYTES, Math.floor((firstWordMax - 12) / 4) * 3))
  /** @type {string[]} */
  const chunks = []
  let chunk = ''
  let limit = firstBytes
  for (const char of text) {
    if (chunk && Buffer.byteLength(chunk + char, 'utf8') > limit) {
      chunks.push(chunk)
      chunk = ''
      limit = MAX_ENCODED_WORD_BYTES
    }
    chunk += char
  }
  if (chunk) chunks.push(chunk)
  return chunks.map((part) => `=?UTF-8?B?${Buffer.from(part, 'utf8').toString('base64')}?=`)
}

/** @param {string} text */
function needsEncoding(text) {
  return !PRINTABLE_ASCII.test(text) || text.includes('=?')
}

/**
 * Wert einer unstrukturierten Kopfzeile (Betreff). Reines ASCII, das in eine Zeile passt, bleibt
 * lesbar, alles andere wird RFC-2047-kodiert und mit CRLF + Leerzeichen gefaltet.
 * @param {unknown} value
 * @param {string} headerName
 */
export function encodeHeaderText(value, headerName) {
  const text = sanitizeHeaderText(value)
  const prefix = headerName.length + 2
  if (!needsEncoding(text) && prefix + text.length <= MAX_HEADER_LINE) return text
  return encodeWords(text, MAX_HEADER_LINE - prefix).join('\r\n ')
}

/**
 * Adresse mit Anzeigename. Name mit Umlauten o. Ä.: RFC-2047-kodiert. Reines ASCII: als
 * quoted-string (unnötig kodierte Namen werten manche Spamfilter ab). Passt die Adresse nicht mehr
 * in die Zeile, wird vor "<" gefaltet.
 * @param {string} email
 * @param {string | null | undefined} name
 * @param {string} [headerName]
 */
export function formatAddress(email, name, headerName = 'From') {
  const address = assertAddress(email, 'sender')
  const display = sanitizeHeaderText(name ?? '')
  if (!display) return address

  const prefix = headerName.length + 2
  const quoted = `"${display.replace(/(["\\])/g, '\\$1')}"`
  const phrase =
    !needsEncoding(display) && prefix + quoted.length <= MAX_HEADER_LINE
      ? quoted
      : encodeWords(display, MAX_HEADER_LINE - prefix).join('\r\n ')
  const fold = phrase.lastIndexOf('\r\n ')
  const lastLineLength = fold === -1 ? prefix + phrase.length : phrase.length - fold - 2
  const separator = lastLineLength + address.length + 3 <= MAX_HEADER_LINE ? ' ' : '\r\n '
  return `${phrase}${separator}<${address}>`
}

/**
 * Datum nach RFC 5322, z. B. "Fri, 25 Sep 2026 12:00:00 +0000".
 * @param {Date} date
 */
export function formatMailDate(date) {
  return date.toUTCString().replace(/GMT$/, '+0000')
}

/**
 * Message-ID mit der Domain des Absenders.
 * @param {string} senderEmail
 * @param {Uint8Array} random mindestens 16 Zufallsbytes
 */
export function createMessageId(senderEmail, random) {
  const domain = assertAddress(senderEmail, 'sender').split('@').pop()?.toLowerCase()
  return `<${Buffer.from(random).toString('hex')}@${domain}>`
}

/** @param {Uint8Array} random */
export function createBoundary(random) {
  // "_" kommt in base64 nicht vor, die Grenze kann also nicht im kodierten Inhalt stehen.
  return `pat_${Buffer.from(random).toString('hex')}`
}

/**
 * Text für einen Teil mit Content-Transfer-Encoding base64: CRLF-Zeilenenden, 76 Zeichen je Zeile.
 * @param {string} content
 */
function base64Body(content) {
  const normalized = String(content).replace(/\r\n|\r|\n/g, '\r\n')
  const encoded = Buffer.from(normalized, 'utf8').toString('base64')
  return (encoded.match(/.{1,76}/g) ?? ['']).join('\r\n')
}

/**
 * Vollständige Nachricht (multipart/alternative mit text/plain und text/html, UTF-8, base64),
 * Zeilenenden CRLF.
 * @param {MimeInput} input
 */
export function buildMimeMessage(input) {
  if (!MESSAGE_ID_SHAPE.test(input.messageId)) throw new MailError('invalid_message', 'Invalid Message-ID')
  if (!BOUNDARY_SHAPE.test(input.boundary)) throw new MailError('invalid_message', 'Invalid MIME boundary')

  const headers = [
    `From: ${formatAddress(input.from.email, input.from.name)}`,
    `To: ${assertAddress(input.to, 'to')}`,
    ...(input.bcc ? [`Bcc: ${assertAddress(input.bcc, 'bcc')}`] : []),
    ...(input.replyTo ? [`Reply-To: ${assertAddress(input.replyTo, 'reply-to')}`] : []),
    `Subject: ${encodeHeaderText(input.subject, 'Subject')}`,
    `Date: ${formatMailDate(input.date)}`,
    `Message-ID: ${input.messageId}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${input.boundary}"`,
  ]

  /**
   * @param {string} type
   * @param {string} content
   */
  const part = (type, content) => [
    `--${input.boundary}`,
    `Content-Type: ${type}; charset=UTF-8`,
    'Content-Transfer-Encoding: base64',
    '',
    base64Body(content),
  ]

  return [
    ...headers,
    '',
    ...part('text/plain', input.text),
    ...part('text/html', input.html),
    `--${input.boundary}--`,
    '',
  ].join('\r\n')
}

// ---------------------------------------------------------------------------
// Versand
// ---------------------------------------------------------------------------

/** @param {Response} res */
async function responseSnippet(res) {
  const text = await res.text().catch(() => '')
  return text.replace(/\s+/g, ' ').slice(0, 300)
}

/**
 * Versender mit Token-Cache. Eine Instanz je Konfiguration (lib/mailer.ts hält sie im Modul), damit
 * das Token über mehrere Mails und warme Aufrufe hinweg wiederverwendet wird.
 * @param {{
 *   serviceAccount: ServiceAccount,
 *   senderEmail: string,
 *   senderName?: string | null,
 *   fetch: FetchLike,
 *   now?: () => Date,
 *   randomBytes?: (size: number) => Uint8Array,
 *   timeoutMs?: number,
 * }} config
 * @returns {GmailSender}
 */
export function createGmailSender(config) {
  const senderEmail = assertAddress(config.senderEmail, 'sender')
  const now = config.now ?? (() => new Date())
  const random = config.randomBytes ?? ((size) => nodeRandomBytes(size))

  /** @type {{ token: string, expiresAt: number } | null} */
  let cached = null
  /** @type {Promise<string> | null} */
  let pending = null

  /** @param {AbortSignal} signal */
  async function requestToken(signal) {
    const assertion = buildJwtAssertion({ serviceAccount: config.serviceAccount, subject: senderEmail, now: now() })
    let res
    try {
      res = await config.fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({ grant_type: JWT_BEARER_GRANT, assertion }).toString(),
        signal,
      })
    } catch (error) {
      throw new MailError('token_failed', `Google token request failed: ${errorText(error)}`)
    }
    if (!res.ok) {
      throw new MailError('token_failed', `Google token request failed: ${res.status} ${await responseSnippet(res)}`)
    }
    /** @type {any} */
    const data = await res.json().catch(() => null)
    const token = typeof data?.access_token === 'string' ? data.access_token : ''
    if (!token) throw new MailError('token_failed', 'Google token response without access_token')
    const expiresIn = Number(data.expires_in) > 0 ? Number(data.expires_in) : 3600
    cached = { token, expiresAt: now().getTime() + expiresIn * 1000 }
    return token
  }

  /** @param {AbortSignal} signal */
  function accessToken(signal) {
    if (cached && now().getTime() < cached.expiresAt - TOKEN_REFRESH_MARGIN_MS) return Promise.resolve(cached.token)
    // Parallele Mails teilen sich eine Token-Anfrage.
    if (!pending) {
      pending = requestToken(signal).finally(() => {
        pending = null
      })
    }
    return pending
  }

  /**
   * Wirft MailError. Eine Zeitgrenze gilt für Token und Versand zusammen.
   * @param {OutgoingMail} mail
   * @param {{ timeoutMs?: number }} [options]
   */
  async function send(mail, options = {}) {
    const mime = buildMimeMessage({
      ...mail,
      from: { email: senderEmail, name: config.senderName },
      date: now(),
      messageId: createMessageId(senderEmail, random(16)),
      boundary: createBoundary(random(12)),
    })

    const signal = AbortSignal.timeout(options.timeoutMs ?? config.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    const token = await accessToken(signal)

    let res
    try {
      res = await config.fetch(GMAIL_SEND_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ raw: base64url(mime) }),
        signal,
      })
    } catch (error) {
      throw new MailError('send_failed', `Gmail send failed: ${errorText(error)}`)
    }
    // Abgelaufenes oder widerrufenes Token: beim nächsten Versand neu holen.
    if (res.status === 401) cached = null
    if (!res.ok) {
      throw new MailError('send_failed', `Gmail send failed: ${res.status} ${await responseSnippet(res)}`)
    }
    /** @type {any} */
    const data = await res.json().catch(() => null)
    return { id: typeof data?.id === 'string' ? data.id : null }
  }

  return {
    send,
    clearTokenCache() {
      cached = null
    },
  }
}

/** @param {unknown} error */
function errorText(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
}
