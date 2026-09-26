// Gemeinsame Textquelle für AGB, Widerrufsbelehrung, die Zustimmung zum sofortigen Leistungsbeginn
// und die Pflichtangaben im Kaufprozess. Dieselben Texte lesen:
// - die Seiten /AGB, /Widerruf und /checkout,
// - der Stripe Checkout (custom_text.submit, siehe checkoutSubmitMessage),
// - die Vertragsbestätigung per E-Mail nach § 312f BGB (lib/checkout-mail.ts).
// So kann die Mail nie von den Seiten abweichen.
//
// Keine Imports: Tests laden die Datei direkt (lib/checkout-mail.test.mjs).
//
// ANWALTLICH PRÜFEN: AGB und Widerrufsbelehrung stehen hier unverändert so, wie sie bisher auf den
// Seiten standen (Stand Januar 2026). Die Sofortstart-Zustimmung und die Pflichtangaben für den
// Checkout sind Entwürfe. Bei jeder inhaltlichen Änderung die Version hochzählen und den alten
// Zustimmungstext in EARLY_START_CONSENT_TEXTS behalten (Nachweis für frühere Käufe).

export type LegalLink = { text: string; href: string; newTab?: boolean }
export type LegalInline = string | LegalLink
export type LegalBlock =
  | { type: 'paragraph'; content: LegalInline[] }
  | { type: 'ordered'; items: LegalInline[][] }
  | { type: 'bullets'; items: LegalInline[][] }
export type LegalSection = { heading: string; blocks: LegalBlock[] }
export type LegalDocument = {
  title: string
  company: string
  stand: string
  version: string
  sections: LegalSection[]
  closing: string
}
export type WithdrawalForm = {
  heading: string
  hint: string
  recipientLabel: string
  recipientLines: string[]
  recipientEmail: LegalLink
  statement: string
  fields: string[]
  footnote: string
}

export const SITE_URL = 'https://www.price-action-trader.de'

export const PROVIDER = Object.freeze({
  name: 'Maric Capital GmbH',
  street: 'Karolinenstraße 13',
  city: '64342 Seeheim-Jugenheim',
  email: 'kontakt@price-action-trader.de',
})

const CONTACT_MAIL_LINK: LegalLink = { text: `E-Mail: ${PROVIDER.email}`, href: `mailto:${PROVIDER.email}` }

// ---------------------------------------------------------------------------
// AGB (Wortlaut unverändert von app/AGB/page.tsx übernommen)
// ---------------------------------------------------------------------------

export const AGB: LegalDocument = {
  title: 'Allgemeine Geschäftsbedingungen (AGB)',
  company: 'der Maric Capital GmbH',
  stand: 'Januar 2026',
  version: '2026-01',
  sections: [
    {
      heading: '§ 1 Geltungsbereich',
      blocks: [
        {
          type: 'paragraph',
          content: [
            'Diese AGB gelten für alle Verträge zwischen Maric Capital GmbH, Karolinenstraße 13, 64342 Seeheim-Jugenheim, Geschäftsführer: Petar Maric und Andre Maric | E-Mail: kontakt@price-action-trader.de (nachfolgend „Anbieter“) und dem Kunden über monatliche Mentoring-Programme (Gruppe oder 1:1) sowie Event-Tickets.',
          ],
        },
      ],
    },
    {
      heading: '§ 2 Vertragsgegenstand',
      blocks: [
        {
          type: 'paragraph',
          content: [
            'Der Anbieter erbringt ausschließlich edukative Leistungen zur Vermittlung von Trading-Wissen. Keine Anlageberatung i.S.d. KWG/WpHG. Die Haupt-Mentorship läuft über die eigene Plattform. Der Anbieter behält sich vor, Event-Tickets, 1:1-Coachings oder Video-Zugänge teilweise über Whop abzuwickeln. Aufzeichnungen werden auf die Mentorship-Plattform hochgeladen, um sie den Kunden verfügbar zu machen.',
          ],
        },
      ],
    },
    {
      heading: '§ 3 Vertragsschluss und Preisangabe',
      blocks: [
        {
          type: 'ordered',
          items: [
            ['Der Vertrag kommt über Zahlungs- oder Buchungsfunktionen auf der Website des Anbieters (z. B. Stripe-Checkout), über Whop (für Events/1:1) oder durch Annahme einer individuellen Rechnung zustande.'],
            ['Die auf der Website angezeigten Preise sind Endpreise. Soweit Umsatzsteuer anfällt, ist diese im Preis enthalten. Der Gesamtpreis (brutto) wird bei der Bestellung transparent ausgewiesen und vor Abschluss nochmals deutlich angezeigt.'],
            ['Mit Abschluss der Bestellung (z. B. Checkout oder Whop) erklärt sich der Kunde mit dem ausgewiesenen Gesamtpreis einverstanden.'],
          ],
        },
      ],
    },
    {
      heading: '§ 4 Zahlungsbedingungen',
      blocks: [
        {
          type: 'paragraph',
          content: [
            'Zahlung erfolgt direkt über Stripe (Kreditkarte oder SEPA) oder Whop (für Events/1:1-Coachings). Bei individuellen 1:1-Mentorings kann auch per Rechnung mit Banküberweisung gezahlt werden.',
          ],
        },
      ],
    },
    {
      heading: '§ 5 Laufzeit und Kündigung – monatliche Mentorings',
      blocks: [
        {
          type: 'bullets',
          items: [
            ['keine Mindestlaufzeit'],
            ['verlängert sich automatisch um je einen Monat'],
            ['jederzeit kündbar mit Frist von 1 Tag zum Monatsende'],
            ['Kündigung über den „Mitgliedschaft verwalten“-Button auf der Plattform (führt zum Stripe-Customer-Portal), die Stripe-Customer-Portal-Funktion oder per E-Mail an kontakt@price-action-trader.de'],
          ],
        },
      ],
    },
    {
      heading: '§ 6 Laufzeit - Event-Tickets',
      blocks: [{ type: 'paragraph', content: ['Einmalzahlung, keine Verlängerung, keine Kündigung erforderlich.'] }],
    },
    {
      heading: '§ 7 Widerrufsrecht und vorzeitiges Erlöschen',
      blocks: [
        {
          type: 'ordered',
          items: [
            [
              'Verbraucher haben ein 14-tägiges Widerrufsrecht (§§ 355 ff. BGB). Die detaillierte Widerrufsbelehrung ist vor Vertragsschluss auf ',
              { text: 'price-action-trader.de/Widerruf', href: 'https://price-action-trader.de/Widerruf', newTab: true },
              ' abrufbar und wird per E-Mail nach Kauf zugesandt.',
            ],
            [
              'Vorzeitiges Erlöschen des Widerrufsrechts: Durch Akzeptanz dieser AGB und Abschluss des Checkouts erklären Sie sich ausdrücklich damit einverstanden, dass vor Ablauf der Widerrufsfrist mit der Erbringung der Dienstleistung begonnen wird (sofortiger Zugang zu allen Inhalten, Live-Calls, der Community und dem Mitgliederbereich). Ihnen ist bekannt und Sie bestätigen, dass Sie durch diese ausdrückliche Forderung Ihr Widerrufsrecht bereits mit Beginn der Leistungserbringung vollständig und unwiderruflich verlieren (§ 356 Abs. 5 BGB). Der Anbieter gewährt den vollständigen Zugang unmittelbar nach Zahlungseingang, womit das Widerrufsrecht erlischt. Bei Event-Tickets erlischt es spätestens mit Beginn der Veranstaltung.',
            ],
          ],
        },
      ],
    },
    {
      heading: '§ 8 Stornierung von Live-Events',
      blocks: [
        {
          type: 'bullets',
          items: [
            ['>60 Tage vorher: volle Rückerstattung minus 50 € Bearbeitung'],
            ['60-30 Tage vorher: 50 % Rückerstattung'],
            ['< 30 Tage vorher / No-Show: keine Rückerstattung'],
          ],
        },
      ],
    },
    {
      heading: '§ 9 Haftung und Risikohinweise',
      blocks: [
        {
          type: 'paragraph',
          content: [
            'Keine Erfolgs- oder Gewinngarantie. Trading kann zum Totalverlust führen. Haftung für leicht fahrlässige Pflichtverletzungen ausgeschlossen (außer bei Verletzung wesentlicher Vertragspflichten).',
          ],
        },
      ],
    },
    {
      heading: '§ 10 Urheberrechte',
      blocks: [{ type: 'paragraph', content: ['Alle Inhalte urheberrechtlich geschützt. Weitergabe und Aufzeichnung verboten.'] }],
    },
    {
      heading: '§ 11 Datenschutz',
      blocks: [
        {
          type: 'paragraph',
          content: [
            'Die Verarbeitung personenbezogener Daten erfolgt nach Maßgabe der Datenschutzerklärung, abrufbar unter ',
            { text: 'price-action-trader.de/datenschutz', href: 'https://price-action-trader.de/datenschutz', newTab: true },
            '.',
          ],
        },
      ],
    },
    {
      heading: '§ 12 Schlussbestimmungen',
      blocks: [
        {
          type: 'paragraph',
          content: [
            'Deutsches Recht | Gerichtsstand für Kaufleute: Sitz des Anbieters | Verbraucherstreitbeilegung: Der Anbieter ist nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen. | Salvatorische Klausel.',
          ],
        },
      ],
    },
  ],
  closing: 'Maric Capital GmbH - Januar 2026',
}

// ---------------------------------------------------------------------------
// Widerrufsbelehrung mit Muster-Widerrufsformular (Wortlaut unverändert von app/Widerruf/page.tsx)
// ---------------------------------------------------------------------------

export const WIDERRUFSBELEHRUNG: LegalDocument & { form: WithdrawalForm } = {
  title: 'Widerrufsbelehrung',
  company: 'der Maric Capital GmbH',
  stand: 'Januar 2026',
  version: '2026-01',
  sections: [
    {
      heading: 'Widerrufsrecht für Verbraucher',
      blocks: [
        {
          type: 'paragraph',
          content: [
            'Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.',
          ],
        },
      ],
    },
    {
      heading: 'Ausübung des Widerrufsrechts',
      blocks: [
        {
          type: 'paragraph',
          content: [
            'Um Ihr Widerrufsrecht auszuüben, müssen Sie uns mittels einer eindeutigen Erklärung (z. B. E-Mail oder Brief) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das untenstehende Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.',
          ],
        },
      ],
    },
    {
      heading: 'Kontakt für Widerruf',
      blocks: [
        {
          type: 'paragraph',
          content: ['An: Maric Capital GmbH, Karolinenstraße 13, 64342 Seeheim-Jugenheim, ', CONTACT_MAIL_LINK],
        },
      ],
    },
    {
      heading: 'Folgen des Widerrufs',
      blocks: [
        {
          type: 'paragraph',
          content: [
            'Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen unverzüglich und spätestens binnen 14 Tagen ab Erhalt Ihrer Widerrufserklärung zurückzuzahlen.',
          ],
        },
      ],
    },
    {
      heading: 'Vorzeitiges Erlöschen des Widerrufsrechts',
      blocks: [
        {
          type: 'paragraph',
          content: [
            'Bei allen monatlichen Mentoring-Programmen (Gruppen-Mentorship und privates 1:1-Mentoring) erlischt Ihr Widerrufsrecht vollständig und endgültig bereits mit Beginn der Leistungserbringung, wenn Sie vor Absenden Ihrer Bestellung ausdrücklich verlangt haben, dass wir vor Ablauf der Widerrufsfrist mit der Ausführung der Dienstleistung beginnen, und gleichzeitig bestätigt haben, dass Ihnen bewusst ist, dass Sie Ihr Widerrufsrecht mit Beginn der Leistungserbringung vollständig verlieren. Siehe auch AGB § 7 für Details.',
          ],
        },
      ],
    },
  ],
  form: {
    heading: 'Muster-Widerrufsformular',
    hint: '(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)',
    recipientLabel: 'An:',
    recipientLines: [PROVIDER.name, PROVIDER.street, PROVIDER.city],
    recipientEmail: CONTACT_MAIL_LINK,
    statement:
      'Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*)',
    fields: [
      'Bestellt am (*)/erhalten am (*)',
      'Name des/der Verbraucher(s)',
      'Anschrift des/der Verbraucher(s)',
      'Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)',
      'Datum',
    ],
    footnote: '(*) Unzutreffendes streichen',
  },
  closing: 'Maric Capital GmbH - Januar 2026',
}

// ---------------------------------------------------------------------------
// Angebot und Pflichtangaben im Kaufprozess (/checkout, Stripe, Bestätigungsmail)
// ---------------------------------------------------------------------------

export const MENTORSHIP_OFFER = Object.freeze({
  product: 'PAT Mentorship 2026',
  service:
    'Lektionen im Mitgliederbereich, 2 Live-Sessions pro Woche (Di + Do) mit Aufzeichnungen und die Community, solange deine Mitgliedschaft läuft',
  priceCents: 15000,
  currency: 'EUR',
  price: '150 € pro Monat inkl. MwSt.',
  term: 'Unbefristet, die Mitgliedschaft verlängert sich jeden Monat automatisch.',
  cancellation:
    'Jederzeit kündbar mit einer Frist von einem Tag zum Ende des jeweiligen Abrechnungsmonats. Der Abrechnungsmonat beginnt mit dem Tag deiner Buchung.',
  access: 'Direkt nach der Zahlung.',
})

// Zahlungsarten, die /checkout vor der Weiterleitung nennt (§ 312j Abs. 1 BGB). Der Checkout nutzt
// die dynamischen Zahlungsarten aus dem Stripe-Dashboard. Diese Liste muss dazu passen: nur
// eintragen, was im Live-Modus für Abonnements aktiv ist, und entfernen, was dort ausgeschaltet ist.
export const CHECKOUT_PAYMENT_METHODS: readonly string[] = Object.freeze([
  'Kredit- oder Debitkarte',
  'Apple Pay',
  'Google Pay',
  'SEPA-Lastschrift',
  'PayPal',
])

// Zustimmung zum sofortigen Leistungsbeginn (§ 356 Abs. 4 und 5, § 357a Abs. 2 BGB).
// ANWALTLICH PRÜFEN: Entwurf, orientiert an AGB § 7 und der Rechtsprüfung vom 25.09.2026.
// Digitale Inhalte (Lektionen, Aufzeichnungen): Erlöschen mit Beginn der Bereitstellung.
// Dienstleistungen (Live-Sessions): Erlöschen erst mit vollständiger Erbringung, vorher Wertersatz.
export const EARLY_START_CONSENT_VERSION = 'sofortstart-2026-09-25-entwurf'

export const CHECKOUT_TERMS_VERSION = `agb-${AGB.version}_widerruf-${WIDERRUFSBELEHRUNG.version}_${EARLY_START_CONSENT_VERSION}`

/** Wortlaut je terms_version. Alte Einträge nie löschen, sie belegen frühere Zustimmungen. */
export const EARLY_START_CONSENT_TEXTS: Readonly<Record<string, string>> = Object.freeze({
  [CHECKOUT_TERMS_VERSION]:
    'Ich verlange ausdrücklich, dass die Maric Capital GmbH vor Ablauf der Widerrufsfrist mit der Leistung beginnt und mir sofort nach der Zahlung Zugang zur PAT Mentorship gewährt. Mir ist bekannt, dass mein Widerrufsrecht für die digitalen Inhalte (Lektionen und Aufzeichnungen) mit Beginn der Bereitstellung erlischt und für die Dienstleistungen (Live-Sessions) erst, wenn sie vollständig erbracht sind. Widerrufe ich vorher, zahle ich für die bis zum Widerruf erbrachten Dienstleistungen anteiligen Wertersatz.',
})

export const EARLY_START_CONSENT_TEXT = EARLY_START_CONSENT_TEXTS[CHECKOUT_TERMS_VERSION]

/** Wortlaut der Zustimmung zu einer gespeicherten terms_version, sonst null. */
export function earlyStartConsentText(termsVersion: string | null | undefined): string | null {
  if (!termsVersion) return null
  return Object.prototype.hasOwnProperty.call(EARLY_START_CONSENT_TEXTS, termsVersion)
    ? EARLY_START_CONSENT_TEXTS[termsVersion]
    : null
}

/**
 * Pflichtangaben direkt über dem Bestellbutton im Stripe Checkout (custom_text.submit, höchstens
 * 1200 Zeichen, Links als Markdown). ANWALTLICH PRÜFEN: Wortlaut und ob die Angaben dort genügen.
 */
export function checkoutSubmitMessage(siteUrl: string = SITE_URL): string {
  const base = siteUrl.replace(/\/+$/, '')
  return [
    `${MENTORSHIP_OFFER.product}: ${MENTORSHIP_OFFER.service}.`,
    `Preis: ${MENTORSHIP_OFFER.price}`,
    `Laufzeit: ${MENTORSHIP_OFFER.term}`,
    `Kündigung: ${MENTORSHIP_OFFER.cancellation}`,
    `Es gelten unsere [AGB](${base}/AGB). Hier findest du die [Widerrufsbelehrung](${base}/Widerruf).`,
  ].join(' ')
}

/** Text neben der AGB-Checkbox in Stripe, nur wenn CHECKOUT_TOS_CONSENT=true. */
export function checkoutTermsAcceptanceMessage(siteUrl: string = SITE_URL): string {
  const base = siteUrl.replace(/\/+$/, '')
  return `Ich stimme den [AGB](${base}/AGB) zu.`
}

// ---------------------------------------------------------------------------
// Klartext (für die Bestätigungsmail)
// ---------------------------------------------------------------------------

function inlineToText(content: LegalInline[]): string {
  return content
    .map((part) => {
      if (typeof part === 'string') return part
      const target = part.href.startsWith('mailto:') ? part.href.slice('mailto:'.length) : part.href
      return part.text.includes(target) ? part.text : `${part.text} (${target})`
    })
    .join('')
}

function blockToText(block: LegalBlock): string[] {
  if (block.type === 'paragraph') return [inlineToText(block.content)]
  return block.items.map((item, index) => `${block.type === 'ordered' ? `${index + 1}.` : '•'} ${inlineToText(item)}`)
}

/** Ganzes Rechtsdokument als Klartext, Abschnitt für Abschnitt (mit Muster-Widerrufsformular, falls vorhanden). */
export function legalDocumentToText(document: LegalDocument & { form?: WithdrawalForm }): string {
  const lines: string[] = [document.title, `${document.company}, Stand: ${document.stand}`, '']
  for (const section of document.sections) {
    lines.push(section.heading)
    for (const block of section.blocks) lines.push(...blockToText(block))
    lines.push('')
  }
  const form = document.form
  if (form) {
    lines.push(
      form.heading,
      form.hint,
      '',
      form.recipientLabel,
      ...form.recipientLines,
      inlineToText([form.recipientEmail]),
      '',
      form.statement,
      '',
      ...form.fields.map((field) => `- ${field}`),
      '',
      form.footnote,
      ''
    )
  }
  lines.push(document.closing)
  return lines.join('\n')
}

/** Einzelne Blöcke für HTML-Ausgaben ohne React (Mail). Jeder Wert ist noch nicht escaped. */
export function legalInlineParts(content: LegalInline[]): Array<{ text: string; href: string | null }> {
  return content.map((part) => (typeof part === 'string' ? { text: part, href: null } : { text: part.text, href: part.href }))
}
