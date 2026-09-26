// E-Mails zum Gast-Checkout: Vertragsbestätigung nach § 312f BGB und Hinweis bei verspätet
// fehlgeschlagener Zahlung. Reine Funktionen ohne Netz, Text- und HTML-Fassung aus denselben Bausteinen.
// AGB und Widerrufsbelehrung kommen wörtlich aus lib/legal-texts.ts (dieselbe Quelle wie /AGB und /Widerruf).
//
// ANWALTLICH PRÜFEN: Aufbau und Wortlaut der Bestätigung (Vertragsinhalt, Belehrung mit
// Muster-Widerrufsformular, Wortlaut und Zeitpunkt der Sofortstart-Zustimmung).

import {
  AGB,
  MENTORSHIP_OFFER,
  PROVIDER,
  WIDERRUFSBELEHRUNG,
  earlyStartConsentText,
  legalDocumentToText,
  legalInlineParts,
  type LegalBlock,
  type LegalDocument,
  type LegalInline,
  type WithdrawalForm,
} from '@/lib/legal-texts'
import { escapeHtml, formatBerlinDate, formatBerlinDateTime } from '@/lib/vertrag-erklaerung.mjs'

export type Mail = { subject: string; text: string; html: string }

export type ConfirmationMailInput = {
  email: string
  name: string | null
  subscriptionId: string
  amountTotal: number | null
  currency: string | null
  startedAt: Date
  currentPeriodEnd: Date | null
  consentEarlyStart: boolean
  consentAt: string | null
  termsVersion: string | null
  createdNewUser: boolean
  loginUrl: string | null
  /** Basis-URL der App für Links (Anmelden, Kündigen, Widerrufen), ohne Schrägstrich am Ende. */
  siteUrl: string
}

type Row = { label: string; value: string }

/** Vorname aus dem Namen bei Stripe, nur wenn er harmlos aussieht. */
export function greetingName(name: string | null | undefined): string | null {
  const first = typeof name === 'string' ? name.trim().split(/\s+/)[0] ?? '' : ''
  return /^[\p{L}][\p{L}'’.-]{0,39}$/u.test(first) ? first : null
}

export function formatEuroAmount(cents: number | null, currency: string | null): string | null {
  if (cents == null || !Number.isFinite(cents)) return null
  const code = (currency ?? 'eur').toUpperCase()
  const formatted = new Intl.NumberFormat('de-DE', { style: 'currency', currency: code }).format(cents / 100)
  // Intl setzt ein geschütztes Leerzeichen vor das Eurozeichen, in Mails reicht ein normales.
  return formatted.replace(/ /g, ' ')
}

function parseDate(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

function base(siteUrl: string) {
  return siteUrl.replace(/\/+$/, '')
}

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

function contractRows(input: ConfirmationMailInput): Row[] {
  const rows: Row[] = [
    { label: 'Leistung', value: `${MENTORSHIP_OFFER.product}: ${MENTORSHIP_OFFER.service}.` },
    { label: 'Preis', value: MENTORSHIP_OFFER.price },
  ]
  const firstCharge = formatEuroAmount(input.amountTotal, input.currency)
  if (firstCharge) rows.push({ label: 'Betrag der ersten Abrechnung', value: `${firstCharge} (inkl. MwSt., laut Stripe)` })
  rows.push(
    { label: 'Vertragsbeginn', value: formatBerlinDateTime(input.startedAt) },
    { label: 'Laufzeit', value: MENTORSHIP_OFFER.term }
  )
  if (input.currentPeriodEnd) rows.push({ label: 'Nächste Abrechnung', value: formatBerlinDate(input.currentPeriodEnd) })
  rows.push(
    { label: 'Kündigung', value: MENTORSHIP_OFFER.cancellation },
    { label: 'Vertragsnummer', value: input.subscriptionId },
    { label: 'E-Mail-Adresse', value: input.email },
    { label: 'Vertragspartner', value: `${PROVIDER.name}, ${PROVIDER.street}, ${PROVIDER.city}, ${PROVIDER.email}` }
  )
  return rows
}

function accessParagraphs(input: ConfirmationMailInput): string[] {
  const site = base(input.siteUrl)
  const signIn = `${site}/sign-in`
  if (input.createdNewUser) {
    return [
      input.loginUrl
        ? `Wir haben für dich ein Konto mit dieser E-Mail-Adresse angelegt. Mit diesem Link meldest du dich direkt an (7 Tage gültig, nur einmal nutzbar): ${input.loginUrl}`
        : `Wir haben für dich ein Konto mit dieser E-Mail-Adresse angelegt. Melde dich unter ${signIn} mit dieser E-Mail-Adresse an.`,
      `Später meldest du dich unter ${signIn} mit deiner E-Mail-Adresse und einem Code an, den wir dir per E-Mail schicken. Ein Passwort brauchst du nicht.`,
    ]
  }
  return [
    `Die Buchung gehört zu deinem bestehenden Konto mit dieser E-Mail-Adresse. Melde dich wie gewohnt unter ${signIn} an.`,
  ]
}

function rightsParagraphs(input: ConfirmationMailInput): string[] {
  const site = base(input.siteUrl)
  return [
    `Kündigen kannst du jederzeit ohne Anmeldung unter ${site}/kuendigen (Schaltfläche „Verträge hier kündigen“) oder im Mitgliederbereich über „Abonnement verwalten“.`,
    `Widerrufen kannst du unter ${site}/widerrufen (Schaltfläche „Vertrag widerrufen“) oder mit einer eindeutigen Erklärung per E-Mail oder Brief, zum Beispiel mit dem Muster-Widerrufsformular unten.`,
  ]
}

function consentParagraphs(input: ConfirmationMailInput): { intro: string; quote: string | null; details: string[] } {
  const text = earlyStartConsentText(input.termsVersion)
  const at = parseDate(input.consentAt)
  if (!input.consentEarlyStart) {
    return { intro: 'Zu diesem Kauf ist keine Zustimmung zum sofortigen Beginn gespeichert.', quote: null, details: [] }
  }
  return {
    intro:
      'Vor der Weiterleitung zur Zahlung hast du auf www.price-action-trader.de/checkout mit einem Häkchen dieser Erklärung zugestimmt:',
    quote: text,
    details: [
      at ? `Zeitpunkt: ${formatBerlinDateTime(at)}` : 'Zeitpunkt: nicht gespeichert',
      `Fassung: ${input.termsVersion ?? 'unbekannt'}`,
      ...(text ? [] : ['Den Wortlaut dieser Fassung schicken wir dir auf Anfrage.']),
    ],
  }
}

// ---------------------------------------------------------------------------
// Vertragsbestätigung
// ---------------------------------------------------------------------------

const CONFIRMATION_SUBJECT = `Deine Buchung der ${MENTORSHIP_OFFER.product}: Vertragsbestätigung`
const CONFIRMATION_INTRO =
  'vielen Dank für deine Buchung. Hier ist die Bestätigung deines Vertrags mit allen Vertragsdaten, unseren AGB und der Widerrufsbelehrung. Bitte bewahre diese E-Mail auf.'

export function buildPurchaseConfirmationMail(input: ConfirmationMailInput): Mail {
  const first = greetingName(input.name)
  const greeting = first ? `Hallo ${first},` : 'Hallo,'
  const rows = contractRows(input)
  const access = accessParagraphs(input)
  const rights = rightsParagraphs(input)
  const consent = consentParagraphs(input)

  const text = [
    greeting,
    '',
    CONFIRMATION_INTRO,
    '',
    'DEIN VERTRAG',
    ...rows.map((row) => `${row.label}: ${row.value}`),
    '',
    'DEIN ZUGANG',
    ...access,
    '',
    'KÜNDIGEN UND WIDERRUFEN',
    ...rights,
    '',
    'DEINE ZUSTIMMUNG ZUM SOFORTIGEN BEGINN',
    consent.intro,
    ...(consent.quote ? [`„${consent.quote}“`] : []),
    ...consent.details,
    '',
    '----------------------------------------',
    legalDocumentToText(WIDERRUFSBELEHRUNG),
    '',
    '----------------------------------------',
    legalDocumentToText(AGB),
    '',
    '----------------------------------------',
    `Fragen? Antworte einfach auf diese E-Mail oder schreib an ${PROVIDER.email}.`,
    '',
    PROVIDER.name,
    PROVIDER.street,
    PROVIDER.city,
  ].join('\n')

  const html = renderHtml({
    title: `Deine Buchung der ${MENTORSHIP_OFFER.product}`,
    body: [
      p(escapeHtml(greeting)),
      p(escapeHtml(CONFIRMATION_INTRO)),
      h2('Dein Vertrag'),
      table(rows),
      h2('Dein Zugang'),
      ...access.map((paragraph) => p(linkify(paragraph, input.loginUrl))),
      h2('Kündigen und widerrufen'),
      ...rights.map((paragraph) => p(escapeHtml(paragraph))),
      h2('Deine Zustimmung zum sofortigen Beginn'),
      p(escapeHtml(consent.intro)),
      consent.quote
        ? `<blockquote style="margin:0 0 12px;padding:8px 12px;border-left:3px solid #cbd5e1;color:#0f172a">„${escapeHtml(consent.quote)}“</blockquote>`
        : '',
      ...consent.details.map((line) => p(escapeHtml(line), 'margin:0 0 4px;color:#475569')),
      hr(),
      documentHtml(WIDERRUFSBELEHRUNG),
      hr(),
      documentHtml(AGB),
      hr(),
      p(`Fragen? Antworte einfach auf diese E-Mail oder schreib an <a href="mailto:${PROVIDER.email}">${PROVIDER.email}</a>.`),
      p([PROVIDER.name, PROVIDER.street, PROVIDER.city].map(escapeHtml).join('<br>'), 'margin:0;color:#64748b;font-size:13px'),
    ],
  })

  return { subject: CONFIRMATION_SUBJECT, text, html }
}

// ---------------------------------------------------------------------------
// Verspätet fehlgeschlagene Zahlung (z. B. SEPA-Lastschrift)
// ---------------------------------------------------------------------------

export function buildPaymentFailedMail(input: { name: string | null; siteUrl: string }): Mail {
  const first = greetingName(input.name)
  const greeting = first ? `Hallo ${first},` : 'Hallo,'
  const paragraphs = [
    `die Zahlung für deine Buchung der ${MENTORSHIP_OFFER.product} konnte nicht eingezogen werden, zum Beispiel weil eine Lastschrift zurückgegeben wurde.`,
    'Bitte prüfe deine Zahlungsangaben. Ob dein Zugang weiterläuft, hängt davon ab, ob die Zahlung noch eingeht.',
    `Wenn du Fragen hast, antworte einfach auf diese E-Mail oder schreib an ${PROVIDER.email}. Neu buchen kannst du jederzeit unter ${base(input.siteUrl)}/checkout.`,
  ]
  const subject = `Zahlung für die ${MENTORSHIP_OFFER.product} fehlgeschlagen`
  const text = [greeting, '', ...paragraphs.flatMap((paragraph) => [paragraph, '']), PROVIDER.name, PROVIDER.street, PROVIDER.city].join('\n')
  const html = renderHtml({
    title: subject,
    body: [
      p(escapeHtml(greeting)),
      ...paragraphs.map((paragraph) => p(escapeHtml(paragraph))),
      p([PROVIDER.name, PROVIDER.street, PROVIDER.city].map(escapeHtml).join('<br>'), 'margin:0;color:#64748b;font-size:13px'),
    ],
  })
  return { subject, text, html }
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

function p(inner: string, style = 'margin:0 0 12px') {
  return `<p style="${style}">${inner}</p>`
}

function h2(text: string) {
  return `<h2 style="font-size:17px;margin:24px 0 8px">${escapeHtml(text)}</h2>`
}

function hr() {
  return '<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">'
}

function table(rows: Row[]) {
  const cells = rows
    .map(
      (row) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#475569;vertical-align:top">${escapeHtml(row.label)}</td><td style="padding:6px 0;color:#0f172a">${escapeHtml(row.value)}</td></tr>`
    )
    .join('')
  return `<table style="border-collapse:collapse;margin:0 0 12px">${cells}</table>`
}

/** Escaped den Absatz und macht nur den Login-Link klickbar (sonst keine automatischen Links). */
function linkify(paragraph: string, loginUrl: string | null) {
  if (!loginUrl || !paragraph.includes(loginUrl)) return escapeHtml(paragraph)
  const [before, after] = paragraph.split(loginUrl)
  return `${escapeHtml(before)}<a href="${escapeHtml(loginUrl)}">Jetzt anmelden</a>${escapeHtml(after ?? '')}`
}

function inlineHtml(content: LegalInline[]) {
  return legalInlineParts(content)
    .map((part) => (part.href ? `<a href="${escapeHtml(part.href)}">${escapeHtml(part.text)}</a>` : escapeHtml(part.text)))
    .join('')
}

function blockHtml(block: LegalBlock) {
  if (block.type === 'paragraph') return p(inlineHtml(block.content))
  const tag = block.type === 'ordered' ? 'ol' : 'ul'
  const items = block.items.map((item) => `<li style="margin:0 0 6px">${inlineHtml(item)}</li>`).join('')
  return `<${tag} style="margin:0 0 12px;padding-left:22px">${items}</${tag}>`
}

function documentHtml(document: LegalDocument & { form?: WithdrawalForm }) {
  const parts = [
    `<h2 style="font-size:17px;margin:0 0 4px">${escapeHtml(document.title)}</h2>`,
    p(`${escapeHtml(document.company)}, Stand: ${escapeHtml(document.stand)}`, 'margin:0 0 12px;color:#475569'),
  ]
  for (const section of document.sections) {
    parts.push(`<h3 style="font-size:15px;margin:16px 0 6px">${escapeHtml(section.heading)}</h3>`)
    for (const block of section.blocks) parts.push(blockHtml(block))
  }
  const form = document.form
  if (form) {
    parts.push(
      `<h3 style="font-size:15px;margin:16px 0 6px">${escapeHtml(form.heading)}</h3>`,
      p(`<em>${escapeHtml(form.hint)}</em>`),
      p(escapeHtml(form.recipientLabel), 'margin:0 0 4px'),
      p([...form.recipientLines.map(escapeHtml), inlineHtml([form.recipientEmail])].join('<br>'), 'margin:0 0 12px;padding-left:16px'),
      p(escapeHtml(form.statement)),
      p(form.fields.map((field) => `- ${escapeHtml(field)}`).join('<br>'), 'margin:0 0 12px;padding-left:16px'),
      p(`<em>${escapeHtml(form.footnote)}</em>`, 'margin:0 0 12px;font-size:13px')
    )
  }
  parts.push(p(escapeHtml(document.closing), 'margin:12px 0 0;color:#475569'))
  return parts.join('\n')
}

function renderHtml({ title, body }: { title: string; body: string[] }) {
  return `<!doctype html><html lang="de"><body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#0f172a">
<div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>
${body.filter(Boolean).join('\n')}
</div></body></html>`
}
