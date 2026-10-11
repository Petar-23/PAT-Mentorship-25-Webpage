import Image from 'next/image'
import { ETORO_CTA, ETORO_OFFER, PRICE_LABEL } from '@/components/landing-v3/content'

const STEPS = [
  { title: 'Konto eröffnen', text: 'Über den Button bei eToro. Für das Angebot zählen nur Konten über diesen Link.' },
  {
    title: `${ETORO_OFFER.minDeposit} einzahlen`,
    text: `Das ist die Bedingung. Traden musst du nicht, die ${ETORO_OFFER.minDeposit} bleiben dein Guthaben auf deinem eToro-Konto.`,
  },
  {
    title: 'Mir kurz schreiben',
    text: (
      <>
        Schick mir an <a href={`mailto:${ETORO_OFFER.claimEmail}`}>{ETORO_OFFER.claimEmail}</a> die E-Mail-Adresse deines eToro-Kontos. Ich gebe
        sie an eToro weiter, damit eToro die Einzahlung bestätigt.
      </>
    ),
  },
  { title: 'Code einlösen', text: 'Danach schicke ich dir deinen Code. Du löst ihn im Checkout ein und startest mit 0 € im ersten Monat.' },
]

/** Original-Logo von eToro (mintgrün, für dunkle Flächen), daher immer auf dunklem Chip. */
function EtoroLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
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
      <span className="pt-tag">Anzeige</span>
      <EtoroLogo size="sm" />
      <span className="pt-l">
        <b>Erster Monat Mentorship geschenkt:</b> Konto eröffnen und {ETORO_OFFER.minDeposit} einzahlen. Traden musst du nicht.
      </span>
      <span className="pt-s">Erster Monat geschenkt, ab {ETORO_OFFER.minDeposit} Einzahlung</span>
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
        <b>Erster Monat geschenkt.</b> Voraussetzung: ein eToro-Konto über meinen Link und {ETORO_OFFER.minDeposit} Einzahlung. Traden musst du
        nicht. <span className="pt-go">So funktioniert es</span>
        <small className="pt-tip-tag">Anzeige</small>
      </span>
    </a>
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
            Eröffne über meinen Link ein Konto bei eToro und zahle {ETORO_OFFER.minDeposit} ein. Dann übernimmt eToro deinen ersten Monat PAT
            Mentorship. Traden musst du dafür nicht. Das normale Angebot bleibt daneben genauso bestehen.
          </p>
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
        </div>
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
            <span>
              Einzahlung bei eToro ist die Bedingung.
              <br />
              Traden musst du nicht.
            </span>
          </div>
          <ul>
            <li>Alle Lektionen, Live-Sessions und die Community</li>
            <li>Die {ETORO_OFFER.minDeposit} bleiben dein Guthaben auf deinem eToro-Konto</li>
            <li>Danach {PRICE_LABEL} pro Monat inkl. MwSt., monatlich kündbar</li>
          </ul>
          <a className="btn btn-inv" href={ETORO_OFFER.href} target="_blank" rel="sponsored noopener" data-cta={ETORO_CTA.section}>
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
      </div>
    </section>
  )
}
