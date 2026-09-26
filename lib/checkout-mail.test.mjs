import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import * as vertrag from './vertrag-erklaerung.mjs'

// Vertragsbestätigung nach § 312f BGB (lib/checkout-mail.ts) aus der gemeinsamen Textquelle
// lib/legal-texts.ts. Keine Netzaufrufe.

const require = createRequire(import.meta.url)
function loadTs(relativePath, replacements = {}) {
  const source = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  })
  const compiled = { exports: {} }
  new Function('require', 'module', 'exports', outputText)((id) => (id in replacements ? replacements[id] : require(id)), compiled, compiled.exports)
  return compiled.exports
}

const legal = loadTs('./legal-texts.ts')
const mail = loadTs('./checkout-mail.ts', { '@/lib/legal-texts': legal, '@/lib/vertrag-erklaerung.mjs': vertrag })

const DASHES = /[–—]/

function input(overrides = {}) {
  return {
    email: 'max@example.com',
    name: 'Max Mustermann',
    subscriptionId: 'sub_123',
    amountTotal: 15000,
    currency: 'eur',
    startedAt: new Date('2026-09-25T12:00:00Z'),
    currentPeriodEnd: new Date('2026-10-25T12:00:00Z'),
    consentEarlyStart: true,
    consentAt: '2026-09-25T11:58:30.000Z',
    termsVersion: legal.CHECKOUT_TERMS_VERSION,
    createdNewUser: true,
    loginUrl: 'https://www.price-action-trader.de/willkommen/anmelden#ticket=abc',
    siteUrl: 'https://www.price-action-trader.de',
    ...overrides,
  }
}

test('confirmation contains the contract data, consent wording with timestamp, withdrawal info and AGB', () => {
  const { subject, text, html } = mail.buildPurchaseConfirmationMail(input())

  assert.equal(subject, 'Deine Buchung der PAT Mentorship 2026: Vertragsbestätigung')
  assert.match(text, /^Hallo Max,/)
  assert.match(text, /Preis: 150 € pro Monat inkl\. MwSt\./)
  assert.match(text, /Betrag der ersten Abrechnung: 150,00 € \(inkl\. MwSt\., laut Stripe\)/)
  assert.match(text, /Vertragsbeginn: 25\.09\.2026 um 14:00:00 Uhr \(MESZ\)/)
  assert.match(text, /Nächste Abrechnung: 25\.10\.2026/)
  assert.match(text, /Kündigung: Jederzeit kündbar mit einer Frist von einem Tag zum Ende des jeweiligen Abrechnungsmonats/)
  assert.match(text, /Vertragsnummer: sub_123/)
  assert.match(text, /Vertragspartner: Maric Capital GmbH, Karolinenstraße 13, 64342 Seeheim-Jugenheim/)

  // Zustimmung: Wortlaut, Zeitpunkt, Fassung
  assert.ok(text.includes(`„${legal.EARLY_START_CONSENT_TEXT}“`))
  assert.match(text, /Zeitpunkt: 25\.09\.2026 um 13:58:30 Uhr \(MESZ\)/)
  assert.ok(text.includes(`Fassung: ${legal.CHECKOUT_TERMS_VERSION}`))

  // Rechte und Wege
  assert.match(text, /https:\/\/www\.price-action-trader\.de\/kuendigen \(Schaltfläche „Verträge hier kündigen“\)/)
  assert.match(text, /https:\/\/www\.price-action-trader\.de\/widerrufen \(Schaltfläche „Vertrag widerrufen“\)/)

  // Widerrufsbelehrung mit Muster-Formular und AGB wörtlich aus der gemeinsamen Quelle
  assert.ok(text.includes(legal.legalDocumentToText(legal.WIDERRUFSBELEHRUNG)))
  assert.ok(text.includes(legal.legalDocumentToText(legal.AGB)))
  assert.match(text, /Muster-Widerrufsformular/)
  assert.match(text, /Hiermit widerrufe\(n\) ich\/wir \(\*\)/)
  assert.match(text, /- Bestellt am \(\*\)\/erhalten am \(\*\)/)
  assert.match(text, /§ 7 Widerrufsrecht und vorzeitiges Erlöschen/)
  for (const section of legal.AGB.sections) assert.ok(text.includes(section.heading), section.heading)

  // HTML hat dieselben Bausteine
  assert.match(html, /<h2[^>]*>Dein Vertrag<\/h2>/)
  assert.match(html, /Muster-Widerrufsformular/)
  assert.match(html, /<a href="https:\/\/price-action-trader\.de\/Widerruf">price-action-trader\.de\/Widerruf<\/a>/)
})

test('new accounts get the one-time login link, existing accounts a plain sign-in hint', () => {
  const fresh = mail.buildPurchaseConfirmationMail(input())
  assert.match(fresh.text, /Mit diesem Link meldest du dich direkt an \(7 Tage gültig, nur einmal nutzbar\): https:\/\/www\.price-action-trader\.de\/willkommen\/anmelden#ticket=abc/)
  assert.match(fresh.html, /<a href="https:\/\/www\.price-action-trader\.de\/willkommen\/anmelden#ticket=abc">Jetzt anmelden<\/a>/)
  assert.match(fresh.text, /Ein Passwort brauchst du nicht\./)

  const withoutLink = mail.buildPurchaseConfirmationMail(input({ loginUrl: null }))
  assert.match(withoutLink.text, /Melde dich unter https:\/\/www\.price-action-trader\.de\/sign-in mit dieser E-Mail-Adresse an\./)

  const existing = mail.buildPurchaseConfirmationMail(input({ createdNewUser: false, loginUrl: null }))
  assert.match(existing.text, /Die Buchung gehört zu deinem bestehenden Konto/)
  assert.doesNotMatch(existing.text, /ticket=/)
  assert.doesNotMatch(existing.html, /ticket=/)
})

test('names and values are escaped in the HTML version, odd names are not used in the greeting', () => {
  const { text, html } = mail.buildPurchaseConfirmationMail(input({ name: '<script>alert(1)</script>', email: 'a"b@example.com' }))
  assert.match(text, /^Hallo,/)
  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /a&quot;b@example\.com/)
  assert.equal(mail.greetingName('  Anna-Lena  Muster'), 'Anna-Lena')
  assert.equal(mail.greetingName('http://evil.example'), null)
  assert.equal(mail.greetingName(null), null)
})

test('missing or unknown consent data is stated honestly instead of inventing a wording', () => {
  const unknown = mail.buildPurchaseConfirmationMail(input({ termsVersion: 'alt-1' }))
  assert.match(unknown.text, /Fassung: alt-1/)
  assert.match(unknown.text, /Den Wortlaut dieser Fassung schicken wir dir auf Anfrage\./)

  const none = mail.buildPurchaseConfirmationMail(input({ consentEarlyStart: false }))
  assert.match(none.text, /Zu diesem Kauf ist keine Zustimmung zum sofortigen Beginn gespeichert\./)
})

test('new mail texts contain no dashes (the AGB keep their existing wording)', () => {
  const { text } = mail.buildPurchaseConfirmationMail(input())
  const ownPart = text.split('----------------------------------------')[0]
  assert.doesNotMatch(ownPart, DASHES)
  const failed = mail.buildPaymentFailedMail({ name: 'Max', siteUrl: 'https://www.price-action-trader.de' })
  assert.doesNotMatch(failed.text, DASHES)
  assert.match(failed.subject, /Zahlung für die PAT Mentorship 2026 fehlgeschlagen/)
  assert.match(failed.text, /https:\/\/www\.price-action-trader\.de\/checkout/)
})

test('amounts are formatted in German', () => {
  assert.equal(mail.formatEuroAmount(15000, 'eur'), '150,00 €')
  assert.equal(mail.formatEuroAmount(17850, 'EUR'), '178,50 €')
  assert.equal(mail.formatEuroAmount(null, 'eur'), null)
})
