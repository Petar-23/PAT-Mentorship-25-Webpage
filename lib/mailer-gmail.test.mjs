import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, randomInt, verify } from 'node:crypto'
import { z } from 'zod'
import {
  DEFAULT_SENDER_NAME,
  GMAIL_SEND_SCOPE,
  GMAIL_SEND_URL,
  GOOGLE_TOKEN_URL,
  JWT_BEARER_GRANT,
  MailError,
  TOKEN_REFRESH_MARGIN_MS,
  assertAddress,
  base64url,
  buildJwtAssertion,
  buildMimeMessage,
  createGmailSender,
  encodeHeaderText,
  formatAddress,
  formatMailDate,
  isEmailAddress,
  parseServiceAccount,
  readMailerEnv,
  sanitizeHeaderText,
} from './mailer-gmail.mjs'

// Schlüsselpaare nur für den Test, nie ein echter Schlüssel.
const rsa = () =>
  generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  })
const KEYS = rsa()
const OTHER_KEYS = rsa()

const NOW = new Date('2026-09-25T12:00:00Z')
const DASHES = /[\u2013\u2014]/
const SA_EMAIL = 'pat-mailer@test-project.iam.gserviceaccount.com'
const SENDER = 'absender@example.de'

const keyJson = (overrides = {}) =>
  JSON.stringify({
    type: 'service_account',
    project_id: 'test-project',
    private_key_id: 'kid123',
    private_key: KEYS.privateKey,
    client_email: SA_EMAIL,
    token_uri: GOOGLE_TOKEN_URL,
    ...overrides,
  })

const account = () => parseServiceAccount(keyJson())

const fromB64url = (value) => Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
const decodeJwtPart = (part) => JSON.parse(fromB64url(part).toString('utf8'))

// Dekodiert RFC-2047-B-Wörter (ggf. gefaltet) zurück in Text.
function decodeHeader(value) {
  const unfolded = value.replace(/\r\n /g, ' ')
  return unfolded
    .replace(/\?=\s+=\?/g, '?==?')
    .replace(/=\?UTF-8\?B\?([A-Za-z0-9+/=]*)\?=/g, (_, b64) => `\u0000${b64}\u0000`)
    .split('\u0000')
    .map((piece, index) => (index % 2 === 1 ? Buffer.from(piece, 'base64') : Buffer.from(piece, 'utf8')))
    .reduce((acc, buf) => Buffer.concat([acc, buf]), Buffer.alloc(0))
    .toString('utf8')
}

function splitMime(mime) {
  const [head, ...rest] = mime.split('\r\n\r\n')
  const headers = {}
  let last = null
  for (const line of head.split('\r\n')) {
    if (line.startsWith(' ')) {
      headers[last] += `\r\n${line}`
    } else {
      const index = line.indexOf(':')
      last = line.slice(0, index)
      headers[last] = line.slice(index + 2)
    }
  }
  return { head, headers, body: rest.join('\r\n\r\n') }
}

function partBodies(mime, boundary) {
  return mime
    .split(`--${boundary}`)
    .slice(1, -1)
    .map((section) => {
      const [partHead, partBody] = section.replace(/^\r\n/, '').split('\r\n\r\n')
      return { head: partHead, content: Buffer.from(partBody.replace(/\r\n/g, ''), 'base64').toString('utf8') }
    })
}

const baseMime = (overrides = {}) => ({
  from: { email: SENDER, name: 'Petar | Price Action Trader' },
  to: 'max@example.de',
  subject: 'Test',
  text: 'Hallo',
  html: '<p>Hallo</p>',
  date: NOW,
  messageId: '<abc123@example.de>',
  boundary: 'pat_0101',
  ...overrides,
})

// ---------------------------------------------------------------------------
// base64url
// ---------------------------------------------------------------------------

test('base64url: URL-sicheres Alphabet ohne Auffüllzeichen', () => {
  assert.equal(base64url(Uint8Array.from([0xfb, 0xff, 0xfe])), '-__-')
  assert.equal(Buffer.from([0xfb, 0xff, 0xfe]).toString('base64'), '+//+')
  assert.equal(base64url('a'), 'YQ')
  assert.equal(base64url('ab'), 'YWI')
  assert.equal(base64url('Kündigung ✓'), Buffer.from('Kündigung ✓', 'utf8').toString('base64url'))
  assert.equal(base64url(''), '')
})

// ---------------------------------------------------------------------------
// Env und Schlüssel
// ---------------------------------------------------------------------------

test('parseServiceAccount: rohes JSON', () => {
  const sa = parseServiceAccount(keyJson())
  assert.equal(sa.clientEmail, SA_EMAIL)
  assert.equal(sa.privateKeyId, 'kid123')
  assert.equal(sa.privateKey.asymmetricKeyType, 'rsa')
  assert.equal(sa.privateKey.type, 'private')
})

test('parseServiceAccount: base64-kodiertes JSON, auch mit Zeilenumbrüchen und URL-sicher', () => {
  const b64 = Buffer.from(keyJson(), 'utf8').toString('base64')
  assert.equal(parseServiceAccount(b64).clientEmail, SA_EMAIL)
  const wrapped = b64.match(/.{1,76}/g).join('\n')
  assert.equal(parseServiceAccount(`\n${wrapped}\n`).clientEmail, SA_EMAIL)
  assert.equal(parseServiceAccount(Buffer.from(keyJson(), 'utf8').toString('base64url')).clientEmail, SA_EMAIL)
})

test('parseServiceAccount: doppelt maskierte Zeilenumbrüche im Schlüssel', () => {
  const escaped = keyJson({ private_key: KEYS.privateKey.replace(/\n/g, '\\n') })
  assert.ok(escaped.includes('\\\\n'))
  assert.equal(parseServiceAccount(escaped).privateKey.asymmetricKeyType, 'rsa')
})

test('parseServiceAccount: Fehler ohne Schlüsselmaterial in der Meldung', () => {
  const cases = [
    ['', /empty/],
    ['   ', /empty/],
    ['kein json und kein base64 !!!', /neither JSON nor base64/],
    [`{"private_key": "${KEYS.privateKey.slice(0, 40)}`, /invalid JSON/],
    ['[1,2]', /JSON object/],
    [keyJson({ type: 'authorized_user' }), /service account/],
    [keyJson({ client_email: 'kein-mail' }), /client_email/],
    [keyJson({ private_key: undefined }), /private_key/],
    [keyJson({ private_key: '-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----\n' }), /cannot be read/],
  ]
  for (const [input, pattern] of cases) {
    assert.throws(
      () => parseServiceAccount(input),
      (error) => {
        assert.match(error.message, pattern)
        assert.doesNotMatch(error.message, /BEGIN|MII/)
        return true
      }
    )
  }
  const ec = generateKeyPairSync('ec', { namedCurve: 'P-256', privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
  assert.throws(() => parseServiceAccount(keyJson({ private_key: ec.privateKey })), /not an RSA key/)
})

test('readMailerEnv: fehlende Werte werden benannt', () => {
  assert.deepEqual(readMailerEnv({}), { status: 'missing', missing: ['GOOGLE_MAIL_SERVICE_ACCOUNT', 'MAIL_SENDER_EMAIL'] })
  assert.deepEqual(readMailerEnv({ GOOGLE_MAIL_SERVICE_ACCOUNT: keyJson(), MAIL_SENDER_EMAIL: '  ' }), {
    status: 'missing',
    missing: ['MAIL_SENDER_EMAIL'],
  })
})

test('readMailerEnv: roh und base64, Name mit Standardwert', () => {
  const raw = readMailerEnv({ GOOGLE_MAIL_SERVICE_ACCOUNT: keyJson(), MAIL_SENDER_EMAIL: ` ${SENDER} ` })
  assert.equal(raw.status, 'ok')
  assert.equal(raw.senderEmail, SENDER)
  assert.equal(raw.senderName, DEFAULT_SENDER_NAME)
  assert.equal(raw.serviceAccount.clientEmail, SA_EMAIL)

  const b64 = readMailerEnv({
    GOOGLE_MAIL_SERVICE_ACCOUNT: Buffer.from(keyJson()).toString('base64'),
    MAIL_SENDER_EMAIL: SENDER,
    MAIL_SENDER_NAME: 'Petar | Price Action Trader\r\nBcc: evil@example.com',
  })
  assert.equal(b64.status, 'ok')
  assert.equal(b64.senderName, 'Petar | Price Action Trader Bcc: evil@example.com')
})

test('readMailerEnv: ungültige Werte', () => {
  const badSender = readMailerEnv({ GOOGLE_MAIL_SERVICE_ACCOUNT: keyJson(), MAIL_SENDER_EMAIL: 'a@b.de\r\nBcc: x@y.de' })
  assert.deepEqual(badSender, { status: 'invalid', error: 'MAIL_SENDER_EMAIL is not a valid email address' })
  const badKey = readMailerEnv({ GOOGLE_MAIL_SERVICE_ACCOUNT: 'Zm9v', MAIL_SENDER_EMAIL: SENDER })
  assert.equal(badKey.status, 'invalid')
  assert.match(badKey.error, /neither JSON nor base64/)
})

// ---------------------------------------------------------------------------
// JWT
// ---------------------------------------------------------------------------

test('buildJwtAssertion: Header, Claims und RS256-Signatur', () => {
  const jwt = buildJwtAssertion({ serviceAccount: account(), subject: SENDER, now: NOW })
  assert.doesNotMatch(jwt, /[+/=]/)
  const [h, c, s] = jwt.split('.')
  assert.deepEqual(decodeJwtPart(h), { alg: 'RS256', typ: 'JWT', kid: 'kid123' })
  const iat = Math.floor(NOW.getTime() / 1000)
  assert.deepEqual(decodeJwtPart(c), {
    iss: SA_EMAIL,
    sub: SENDER,
    scope: 'https://www.googleapis.com/auth/gmail.send',
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp: iat + 3600,
  })
  assert.equal(GMAIL_SEND_SCOPE, 'https://www.googleapis.com/auth/gmail.send')

  const signingInput = Buffer.from(`${h}.${c}`)
  const signature = fromB64url(s)
  assert.equal(signature.length, 256)
  assert.equal(verify('sha256', signingInput, KEYS.publicKey, signature), true)
  assert.equal(verify('sha256', signingInput, OTHER_KEYS.publicKey, signature), false)

  // Geänderte Claims passen nicht mehr zur Signatur.
  const forged = base64url(JSON.stringify({ ...decodeJwtPart(c), sub: 'andere@example.de' }))
  assert.equal(verify('sha256', Buffer.from(`${h}.${forged}`), KEYS.publicKey, signature), false)
})

test('buildJwtAssertion: ohne private_key_id kein kid', () => {
  const sa = parseServiceAccount(keyJson({ private_key_id: undefined }))
  const [h] = buildJwtAssertion({ serviceAccount: sa, subject: SENDER, now: NOW }).split('.')
  assert.deepEqual(decodeJwtPart(h), { alg: 'RS256', typ: 'JWT' })
})

// ---------------------------------------------------------------------------
// MIME
// ---------------------------------------------------------------------------

test('buildMimeMessage: Aufbau, CRLF, Umlaute in Name und Betreff', () => {
  const subject = 'Bestätigung Ihrer Kündigung (K-2026-ABCD)'
  const name = 'Petar Marić | Price Action Trader'
  const text = 'Guten Tag,\n\nIhre Kündigung ist eingegangen.\nGrüße'
  const html = '<p>Guten Tag,</p>\n<p>Ihre Kündigung ist eingegangen. Grüße</p>'
  const mime = buildMimeMessage(
    baseMime({ from: { email: SENDER, name }, subject, text, html, bcc: 'kopie@example.de', replyTo: 'kontakt@example.de' })
  )

  // Nur CRLF, keine einzelnen CR oder LF, keine Zeile über 78 Zeichen, nur ASCII.
  assert.doesNotMatch(mime.replace(/\r\n/g, ''), /[\r\n]/)
  for (const line of mime.split('\r\n')) assert.ok(line.length <= 78, line)
  assert.match(mime, /^[\x20-\x7e\r\n]*$/)

  const { headers, head } = splitMime(mime)
  assert.match(headers.From, /^=\?UTF-8\?B\?[^?]+\?=( |\r\n )?.*<absender@example\.de>$/s)
  assert.equal(decodeHeader(headers.From.replace(/(\r\n)? <absender@example\.de>$/, '')), name)
  assert.match(headers.Subject, /^=\?UTF-8\?B\?/)
  assert.equal(decodeHeader(headers.Subject), subject)
  assert.equal(headers.To, 'max@example.de')
  assert.equal(headers.Bcc, 'kopie@example.de')
  assert.equal(headers['Reply-To'], 'kontakt@example.de')
  assert.equal(headers.Date, 'Fri, 25 Sep 2026 12:00:00 +0000')
  assert.equal(headers['Message-ID'], '<abc123@example.de>')
  assert.equal(headers['MIME-Version'], '1.0')
  assert.equal(headers['Content-Type'], 'multipart/alternative; boundary="pat_0101"')
  assert.deepEqual(
    head.split('\r\n').filter((line) => !line.startsWith(' ')).map((line) => line.split(':')[0]),
    ['From', 'To', 'Bcc', 'Reply-To', 'Subject', 'Date', 'Message-ID', 'MIME-Version', 'Content-Type']
  )

  const parts = partBodies(mime, 'pat_0101')
  assert.equal(parts.length, 2)
  assert.equal(parts[0].head, 'Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64')
  assert.equal(parts[1].head, 'Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64')
  assert.equal(parts[0].content, text.replace(/\n/g, '\r\n'))
  assert.equal(parts[1].content, html.replace(/\n/g, '\r\n'))
  assert.ok(mime.endsWith('--pat_0101--\r\n'))
})

test('buildMimeMessage: ASCII-Name als quoted-string, ASCII-Betreff lesbar', () => {
  const mime = buildMimeMessage(baseMime({ subject: 'Eingang (W-1)' }))
  const { headers } = splitMime(mime)
  assert.equal(headers.From, '"Petar | Price Action Trader" <absender@example.de>')
  assert.equal(headers.Subject, 'Eingang (W-1)')
  assert.equal(headers.Bcc, undefined)
  assert.equal(headers['Reply-To'], undefined)
  assert.equal(formatAddress(SENDER, 'Er sagt "hallo" \\o/'), '"Er sagt \\"hallo\\" \\\\o/" <absender@example.de>')
  assert.equal(formatAddress(SENDER, '  '), SENDER)
})

test('encodeHeaderText: lange Betreffe werden gefaltet, Mehrbyte-Zeichen bleiben ganz', () => {
  const subject = `Interne Kopie: Eingangsbestätigung Ihres Widerrufs für Grüße ÄÖÜ äöü ß 😀 ${'ü'.repeat(40)} (W-2026-XYZ)`
  const encoded = encodeHeaderText(subject, 'Subject')
  const words = encoded.split('\r\n ')
  assert.ok(words.length > 2)
  for (const word of words) {
    assert.match(word, /^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/)
    assert.ok(word.length <= 75)
    // Jedes Wort ist für sich gültiges UTF-8 (kein Zeichen über zwei Wörter verteilt).
    const bytes = Buffer.from(word.slice(10, -2), 'base64')
    assert.equal(Buffer.from(bytes.toString('utf8'), 'utf8').equals(bytes), true)
  }
  assert.equal(decodeHeader(encoded), subject)

  // Langer reiner ASCII-Betreff: kodiert statt überlanger Zeile.
  const long = 'A'.repeat(90)
  assert.equal(decodeHeader(encodeHeaderText(long, 'Subject')), long)
  // "=?" im Klartext würde als encoded-word gelesen, deshalb kodieren.
  assert.match(encodeHeaderText('Preis =?UTF-8?', 'Subject'), /^=\?UTF-8\?B\?/)
})

test('Header-Injection: CR/LF in Name und Betreff wird entfernt', () => {
  const mime = buildMimeMessage(
    baseMime({
      from: { email: SENDER, name: 'Petar\r\nBcc: evil@example.com' },
      subject: 'Hallo\r\nBcc: evil@example.com\nX-Evil: 1',
    })
  )
  const { head, headers } = splitMime(mime)
  const names = head.split('\r\n').filter((line) => !line.startsWith(' ')).map((line) => line.split(':')[0])
  assert.equal(names.includes('Bcc'), false)
  assert.equal(names.includes('X-Evil'), false)
  assert.equal(headers.Subject, 'Hallo Bcc: evil@example.com X-Evil: 1')
  assert.equal(headers.From, '"Petar Bcc: evil@example.com" <absender@example.de>')
  assert.equal(sanitizeHeaderText('a\u0000b\tc\u007fd  e'), 'a b c d e')
})

test('Header-Injection: ungültige Adressen werden abgelehnt', () => {
  const bad = [
    'max@example.de\r\nBcc: evil@example.com',
    'max@example.de\nBcc: evil@example.com',
    'max@example.de, evil@example.com',
    'Max <max@example.de>',
    'max @example.de',
    'mäx@example.de',
    'max@localhost',
    '',
    null,
  ]
  for (const to of bad) {
    assert.throws(() => buildMimeMessage(baseMime({ to })), (error) => error instanceof MailError && error.code === 'invalid_message')
  }
  assert.throws(() => buildMimeMessage(baseMime({ bcc: 'a@b.de\r\nX: y' })), /Invalid bcc address/)
  assert.throws(() => buildMimeMessage(baseMime({ replyTo: 'a@b.de;c@d.de' })), /Invalid reply-to address/)
  assert.throws(() => buildMimeMessage(baseMime({ from: { email: 'x\r\n@y.de' } })), /Invalid sender address/)
  assert.throws(() => buildMimeMessage(baseMime({ messageId: '<a@b>\r\nBcc: c@d.de' })), /Message-ID/)
  assert.throws(() => buildMimeMessage(baseMime({ boundary: 'x"\r\nBcc: c@d.de' })), /boundary/)
  assert.equal(assertAddress(" max.o'neil+tag@sub.example.de ", 'to'), "max.o'neil+tag@sub.example.de")
})

test('isEmailAddress: jede Adresse, die das Formular annimmt, nimmt auch der Versand an', () => {
  // Gleiche Kette wie lib/vertrag-validierung.mjs. Sonst ginge eine gültige Eingabe nie raus.
  const formEmail = z.string().trim().toLowerCase().max(254).email()
  const samples = [
    'max@example.de',
    "max.o'neil+tag@sub.example.de",
    'a_b-c@x-y.example.co.uk',
    'MAX@EXAMPLE.DE',
    '1@2a.de',
  ]
  const alphabet = "abcXYZ019_'+-.@"
  for (let i = 0; i < 3000; i += 1) {
    let local = ''
    for (let j = randomInt(1, 12); j > 0; j -= 1) local += alphabet[randomInt(alphabet.length)]
    samples.push(`${local}@${['example.de', 'a-b.example.com', 'x.io'][randomInt(3)]}`)
  }
  let accepted = 0
  for (const sample of samples) {
    const parsed = formEmail.safeParse(sample)
    if (!parsed.success) continue
    accepted += 1
    assert.equal(isEmailAddress(parsed.data), true, parsed.data)
  }
  assert.ok(accepted > 100)
})

test('formatMailDate: RFC 5322 mit +0000', () => {
  assert.equal(formatMailDate(new Date('2026-01-05T08:09:10Z')), 'Mon, 05 Jan 2026 08:09:10 +0000')
})

// ---------------------------------------------------------------------------
// Versand mit Attrappe statt Netz
// ---------------------------------------------------------------------------

function mockGoogle(options = {}) {
  const calls = []
  let tokenCount = 0
  const fetch = async (url, init) => {
    calls.push({ url, init })
    if (url === GOOGLE_TOKEN_URL) {
      tokenCount += 1
      if (options.tokenHang) {
        return new Promise((_, reject) => {
          init.signal.addEventListener('abort', () => reject(init.signal.reason))
        })
      }
      if (options.tokenFails) return new Response('{"error":"unauthorized_client"}', { status: 401 })
      return Response.json({ access_token: `token-${tokenCount}`, expires_in: 3599, token_type: 'Bearer' })
    }
    if (url === GMAIL_SEND_URL) {
      if (options.hang) {
        return new Promise((_, reject) => {
          init.signal.addEventListener('abort', () => reject(init.signal.reason))
        })
      }
      const status = options.sendStatus?.shift() ?? 200
      if (status !== 200) return new Response('{"error":{"code":' + status + '}}', { status })
      return Response.json({ id: `msg-${calls.length}`, threadId: 't1', labelIds: ['SENT'] })
    }
    throw new Error(`unexpected url ${url}`)
  }
  return { fetch, calls }
}

function makeSender(mock, clock) {
  return createGmailSender({
    serviceAccount: account(),
    senderEmail: SENDER,
    senderName: 'Petar Marić | Price Action Trader',
    fetch: mock.fetch,
    now: () => new Date(clock.now),
    randomBytes: (size) => Buffer.alloc(size, 0xab),
  })
}

const MAIL = {
  to: 'max@example.de',
  bcc: 'kopie@example.de',
  replyTo: 'kontakt@example.de',
  subject: 'Bestätigung Ihrer Kündigung (K-1)',
  text: 'Text',
  html: '<p>Text</p>',
}

test('createGmailSender: Token-Anfrage und Versand an die Gmail-API', async () => {
  const mock = mockGoogle()
  const clock = { now: NOW.getTime() }
  const sender = makeSender(mock, clock)
  const result = await sender.send(MAIL)
  assert.deepEqual(result, { id: 'msg-2' })
  assert.equal(mock.calls.length, 2)

  const [tokenCall, sendCall] = mock.calls
  assert.equal(tokenCall.url, 'https://oauth2.googleapis.com/token')
  assert.equal(tokenCall.init.method, 'POST')
  assert.equal(tokenCall.init.headers['content-type'], 'application/x-www-form-urlencoded')
  const form = new URLSearchParams(tokenCall.init.body)
  assert.equal(form.get('grant_type'), JWT_BEARER_GRANT)
  assert.equal(form.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer')
  const claims = decodeJwtPart(form.get('assertion').split('.')[1])
  assert.equal(claims.iss, SA_EMAIL)
  assert.equal(claims.sub, SENDER)
  assert.ok(tokenCall.init.signal instanceof AbortSignal)

  assert.equal(sendCall.url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send')
  assert.equal(sendCall.init.method, 'POST')
  assert.equal(sendCall.init.headers.authorization, 'Bearer token-1')
  assert.ok(sendCall.init.signal instanceof AbortSignal)
  const { raw } = JSON.parse(sendCall.init.body)
  assert.doesNotMatch(raw, /[+/=]/)
  const mime = fromB64url(raw).toString('utf8')
  const { headers } = splitMime(mime)
  assert.equal(headers.To, 'max@example.de')
  assert.equal(headers.Bcc, 'kopie@example.de')
  assert.equal(headers['Reply-To'], 'kontakt@example.de')
  assert.equal(decodeHeader(headers.Subject), MAIL.subject)
  assert.equal(decodeHeader(headers.From.replace(/(\r\n)? <absender@example\.de>$/, '')), 'Petar Marić | Price Action Trader')
  assert.equal(headers['Message-ID'], `<${'ab'.repeat(16)}@example.de>`)
  assert.equal(headers.Date, 'Fri, 25 Sep 2026 12:00:00 +0000')
  assert.equal(headers['Content-Type'], `multipart/alternative; boundary="pat_${'ab'.repeat(12)}"`)
})

test('createGmailSender: Token wird bis kurz vor Ablauf wiederverwendet', async () => {
  const mock = mockGoogle()
  const clock = { now: NOW.getTime() }
  const sender = makeSender(mock, clock)
  await sender.send(MAIL)
  clock.now += 3599_000 - TOKEN_REFRESH_MARGIN_MS - 1_000
  await sender.send(MAIL)
  const tokenCalls = () => mock.calls.filter((call) => call.url === GOOGLE_TOKEN_URL).length
  assert.equal(tokenCalls(), 1)
  assert.equal(mock.calls.at(-1).init.headers.authorization, 'Bearer token-1')

  clock.now += 2_000
  await sender.send(MAIL)
  assert.equal(tokenCalls(), 2)
  assert.equal(mock.calls.at(-1).init.headers.authorization, 'Bearer token-2')
})

test('createGmailSender: parallele Mails teilen sich eine Token-Anfrage', async () => {
  const mock = mockGoogle()
  const sender = makeSender(mock, { now: NOW.getTime() })
  await Promise.all([sender.send(MAIL), sender.send({ ...MAIL, bcc: null }), sender.send({ ...MAIL, to: 'b@example.de' })])
  assert.equal(mock.calls.filter((call) => call.url === GOOGLE_TOKEN_URL).length, 1)
  assert.equal(mock.calls.filter((call) => call.url === GMAIL_SEND_URL).length, 3)
})

test('createGmailSender: Token-Fehler bricht vor dem Versand ab, nächster Versuch fragt neu', async () => {
  const mock = mockGoogle({ tokenFails: true })
  const sender = makeSender(mock, { now: NOW.getTime() })
  await assert.rejects(sender.send(MAIL), (error) => {
    assert.ok(error instanceof MailError)
    assert.equal(error.code, 'token_failed')
    assert.match(error.message, /401 .*unauthorized_client/)
    return true
  })
  assert.equal(mock.calls.filter((call) => call.url === GMAIL_SEND_URL).length, 0)
  await assert.rejects(sender.send(MAIL), /token request failed/)
  assert.equal(mock.calls.filter((call) => call.url === GOOGLE_TOKEN_URL).length, 2)
})

test('createGmailSender: 401 beim Versand holt ein frisches Token und wiederholt einmal', async () => {
  const mock = mockGoogle({ sendStatus: [401] })
  const sender = makeSender(mock, { now: NOW.getTime() })
  const result = await sender.send(MAIL)
  assert.ok(result.id)
  const sends = mock.calls.filter((call) => call.url === GMAIL_SEND_URL)
  assert.equal(mock.calls.filter((call) => call.url === GOOGLE_TOKEN_URL).length, 2)
  assert.deepEqual(
    sends.map((call) => call.init.headers.authorization),
    ['Bearer token-1', 'Bearer token-2']
  )
  // Dieselbe Nachricht (gleiche Message-ID), keine zweite Mail.
  assert.equal(sends[0].init.body, sends[1].init.body)

  // Das frische Token bleibt gespeichert.
  await sender.send(MAIL)
  assert.equal(mock.calls.filter((call) => call.url === GOOGLE_TOKEN_URL).length, 2)
  assert.equal(mock.calls.at(-1).init.headers.authorization, 'Bearer token-2')
})

test('createGmailSender: zweimal 401 meldet send_failed und verwirft das Token', async () => {
  const mock = mockGoogle({ sendStatus: [401, 401] })
  const sender = makeSender(mock, { now: NOW.getTime() })
  await assert.rejects(sender.send(MAIL), (error) => {
    assert.ok(error instanceof MailError)
    assert.equal(error.code, 'send_failed')
    assert.match(error.message, /Gmail send failed: 401/)
    return true
  })
  assert.equal(mock.calls.filter((call) => call.url === GMAIL_SEND_URL).length, 2)
  await sender.send(MAIL)
  assert.equal(mock.calls.filter((call) => call.url === GOOGLE_TOKEN_URL).length, 3)
  assert.equal(mock.calls.at(-1).init.headers.authorization, 'Bearer token-3')
})

test('createGmailSender: 403 wird nicht wiederholt, Meldung ohne Token und Schlüssel', async () => {
  const mock = mockGoogle({ sendStatus: [403] })
  const sender = makeSender(mock, { now: NOW.getTime() })
  await assert.rejects(sender.send(MAIL), (error) => {
    assert.ok(error instanceof MailError)
    assert.equal(error.code, 'send_failed')
    assert.match(error.message, /Gmail send failed: 403/)
    assert.doesNotMatch(error.message, /token-1|Bearer|BEGIN|MII/)
    return true
  })
  assert.equal(mock.calls.filter((call) => call.url === GMAIL_SEND_URL).length, 1)
  await sender.send(MAIL)
  assert.equal(mock.calls.filter((call) => call.url === GOOGLE_TOKEN_URL).length, 1)
})

test('createGmailSender: verspätetes 401 eines alten Tokens verwirft kein frisches', async () => {
  const clock = { now: NOW.getTime() }
  let releaseOld
  const calls = []
  let tokenCount = 0
  const fetch = async (url, init) => {
    calls.push({ url, init })
    if (url === GOOGLE_TOKEN_URL) {
      tokenCount += 1
      return Response.json({ access_token: `token-${tokenCount}`, expires_in: 3599 })
    }
    const auth = init.headers.authorization
    // Die erste Mail mit token-1 hängt, bis sie am Ende mit 401 antwortet.
    if (auth === 'Bearer token-1' && !releaseOld) {
      return new Promise((resolve) => {
        releaseOld = () => resolve(new Response('{}', { status: 401 }))
      })
    }
    return Response.json({ id: `msg-${calls.length}` })
  }
  const sender = createGmailSender({
    serviceAccount: account(),
    senderEmail: SENDER,
    fetch,
    now: () => new Date(clock.now),
    randomBytes: (size) => Buffer.alloc(size, 0xab),
  })
  const slow = sender.send(MAIL)
  await new Promise((resolve) => setImmediate(resolve))
  // Token läuft ab, die nächste Mail holt token-2.
  clock.now += 3599_000
  await sender.send(MAIL)
  releaseOld()
  await slow
  const before = calls.filter((call) => call.url === GOOGLE_TOKEN_URL).length
  await sender.send(MAIL)
  assert.equal(calls.filter((call) => call.url === GOOGLE_TOKEN_URL).length, before)
  assert.equal(calls.at(-1).init.headers.authorization, 'Bearer token-2')
})

test('createGmailSender: andere Fehler behalten das Token', async () => {
  const mock = mockGoogle({ sendStatus: [500] })
  const sender = makeSender(mock, { now: NOW.getTime() })
  await assert.rejects(sender.send(MAIL), /Gmail send failed: 500/)
  await sender.send(MAIL)
  assert.equal(mock.calls.filter((call) => call.url === GOOGLE_TOKEN_URL).length, 1)
})

test('createGmailSender: Zeitgrenze gilt für Token und Versand zusammen', async () => {
  const mock = mockGoogle({ hang: true })
  const sender = makeSender(mock, { now: NOW.getTime() })
  const started = Date.now()
  await assert.rejects(sender.send(MAIL, { timeoutMs: 50 }), (error) => {
    assert.ok(error instanceof MailError)
    assert.equal(error.code, 'send_failed')
    assert.match(error.message, /TimeoutError/)
    return true
  })
  assert.ok(Date.now() - started < 2_000)
})

test('createGmailSender: hängende Token-Anfrage endet mit token_failed, kein Versand', async () => {
  const mock = mockGoogle({ tokenHang: true })
  const sender = makeSender(mock, { now: NOW.getTime() })
  const started = Date.now()
  const results = await Promise.allSettled([sender.send(MAIL, { timeoutMs: 50 }), sender.send(MAIL, { timeoutMs: 50 })])
  for (const result of results) {
    assert.equal(result.status, 'rejected')
    assert.equal(result.reason.code, 'token_failed')
    assert.match(result.reason.message, /TimeoutError/)
  }
  assert.ok(Date.now() - started < 2_000)
  assert.equal(mock.calls.filter((call) => call.url === GOOGLE_TOKEN_URL).length, 1)
  assert.equal(mock.calls.filter((call) => call.url === GMAIL_SEND_URL).length, 0)
})

test('createGmailSender: ungültige Nachricht geht nicht ins Netz', async () => {
  const mock = mockGoogle()
  const sender = makeSender(mock, { now: NOW.getTime() })
  await assert.rejects(sender.send({ ...MAIL, to: 'max@example.de\r\nBcc: evil@example.com' }), (error) => error.code === 'invalid_message')
  assert.equal(mock.calls.length, 0)
  assert.throws(() => createGmailSender({ serviceAccount: account(), senderEmail: 'kein mail', fetch: mock.fetch }), /Invalid sender/)
})

test('keine Gedankenstriche in Meldungen', () => {
  for (const message of [
    readMailerEnv({}).missing.join(' '),
    readMailerEnv({ GOOGLE_MAIL_SERVICE_ACCOUNT: 'x', MAIL_SENDER_EMAIL: SENDER }).error,
    DEFAULT_SENDER_NAME,
  ]) {
    assert.doesNotMatch(message, DASHES)
  }
})
