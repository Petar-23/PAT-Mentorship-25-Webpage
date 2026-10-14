import Image from 'next/image'
import { ETORO_CTA, ETORO_OFFER, PRICE_LABEL } from '@/components/landing-v3/content'

const STEPS = [
  { title: 'Konto eröffnen', text: 'Über den Button bei eToro. Für das Angebot zählen nur Konten über diesen Link.' },
  {
    title: 'Ersteinzahlung tätigen',
    text: 'Tätige über dein neues Konto deine Ersteinzahlung bei eToro.',
  },
  {
    title: 'Code per E-Mail erhalten',
    text: (
      <>
        Nach der Einzahlung sendet dir eToro deinen Code automatisch per E-Mail. Nur wenn er nach {ETORO_OFFER.codeWaitDays} Tagen nicht
        angekommen ist, schreib mir an <a href={`mailto:${ETORO_OFFER.supportEmail}`}>{ETORO_OFFER.supportEmail}</a>.
      </>
    ),
  },
  { title: 'Code einlösen', text: 'Löse deinen Code im PAT-Checkout ein und starte mit 0 € im ersten Monat.' },
]

/** Original-Logo von eToro (mintgrün, für dunkle Flächen), daher immer auf dunklem Chip. */
export function EtoroLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span className={`pt-logo pt-logo-${size}`}>
      <Image src={ETORO_OFFER.logo} alt="eToro" width={107} height={20} unoptimized />
    </span>
  )
}

/** Leiste über der Kopfzeile: verweist auf den Abschnitt, nicht direkt zu eToro, damit Bedingungen und Risikohinweis zuerst sichtbar sind. */
export function PartnerBar() {
  if (!ETORO_OFFER.enabled) return null
  return (
    <a className="pt-bar" href="#etoro" data-cta={ETORO_CTA.bar}>
      <span className="pt-bar-brand">
        <EtoroLogo size="sm" />
        <span className="pt-bar-label">Anzeige</span>
      </span>
      <span className="pt-l">
        <b>Erster Monat Mentorship geschenkt:</b> Konto bei eToro eröffnen und Ersteinzahlung tätigen.
      </span>
      <span className="pt-s">Erster Monat geschenkt mit eToro</span>
      <span className="pt-more">
        <span className="pt-more-t">So geht&apos;s </span>
        <span className="arr" aria-hidden="true">→</span>
      </span>
    </a>
  )
}

/** Hinweis im Preis-Abschnitt, neben dem normalen Angebot. */
export function PartnerTip() {
  if (!ETORO_OFFER.enabled) return null
  return (
    <a className="pt-tip" href="#etoro" data-cta={ETORO_CTA.tip}>
      <EtoroLogo size="sm" />
      <span>
        <b>Erster Monat geschenkt.</b> Voraussetzung: ein eToro-Konto über meinen Link und deine Ersteinzahlung.{' '}
        <span className="pt-go">So funktioniert es</span>
        <small className="pt-tip-tag">Anzeige</small>
      </span>
    </a>
  )
}

/** Die vier Schritte bis zum Code (Landing und Prop-Firm-Rechner). */
export function PartnerSteps() {
  return (
    <ol className="pt-steps">
      {STEPS.map((step, index) => (
        <li key={step.title}>
          <span className="no">{String(index + 1).padStart(2, '0')}</span>
          <div>
            <b>{step.title}</b>
            <span>{step.text}</span>
          </div>
        </li>
      ))}
    </ol>
  )
}

/**
 * Angebotskarte mit Partnerlink, Offenlegung und Risikohinweis. Einzige Quelle für diese Texte neben ETORO_OFFER,
 * genutzt auf der Landing und unter dem Prop-Firm-Rechner (dort mit eigener Quelle fürs Klick-Tracking).
 */
export function PartnerCard({ cta = ETORO_CTA.section }: { cta?: string }) {
  return (
    <div className="offer pt-card">
      <p className="pt-co">
        <span>PAT Mentorship</span>
        <span className="x" aria-hidden="true">
          ×
        </span>
        <EtoroLogo />
      </p>
      <p className="amt">
        <b>1 Monat</b>
        <span>geschenkt</span>
      </p>
      <p className="terms">Mentorship im Wert von {PRICE_LABEL}</p>
      <div className="pt-req">
        <b>{ETORO_OFFER.minDeposit}</b>
        <span>Mindestbetrag für deine Ersteinzahlung bei eToro.</span>
      </div>
      <ul>
        <li>Alle Lektionen, Live-Sessions und die Community</li>
        <li>Code kommt nach der Ersteinzahlung automatisch per E-Mail von eToro</li>
        <li>Danach {PRICE_LABEL} pro Monat inkl. MwSt., monatlich kündbar</li>
      </ul>
      <a className="btn btn-inv" href={ETORO_OFFER.href} target="_blank" rel="sponsored noopener" data-cta={cta}>
        Konto bei eToro eröffnen <span className="arr" aria-hidden="true">↗</span>
      </a>
      <p className="fine">{ETORO_OFFER.disclosure}</p>
      <div className="pt-risk" role="note" aria-label="Risikohinweis eToro">
        <p>
          <b>Risikohinweis:</b> {ETORO_OFFER.riskPlatform}
        </p>
        <p>{ETORO_OFFER.riskCfd}</p>
      </div>
    </div>
  )
}

export function Partner() {
  if (!ETORO_OFFER.enabled) return null
  return (
    <section className="sec partner" id="etoro" aria-labelledby="etoro-title">
      <div className="wrap offer-grid">
        <div>
          <p className="label">Partner-Angebot · Anzeige</p>
          <h2 id="etoro-title">
            <span className="dim">Dein erster Monat.</span>
            <span>Geht auf eToro.</span>
          </h2>
          <p className="lead">
            Eröffne über meinen Link ein Konto bei eToro und tätige deine Ersteinzahlung. Dann übernimmt
            eToro deinen ersten Monat PAT Mentorship. Das normale Angebot bleibt daneben genauso bestehen.
          </p>
          <PartnerSteps />
        </div>
        <PartnerCard />
      </div>
    </section>
  )
}
