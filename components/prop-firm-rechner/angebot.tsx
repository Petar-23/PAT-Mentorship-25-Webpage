import Link from 'next/link'
import { ETORO_CTA, ETORO_OFFER, PRICE_LABEL } from '@/components/landing-v3/content'
import { PartnerCard, PartnerSteps } from '@/components/landing-v3/sections/partner'

/** Abonnier-Adresse von Petars Research-Newsletter (Substack). */
export const RESEARCH_LOG_URL = 'https://petartrades.substack.com/subscribe'

/**
 * Block nach den Ergebnissen, deutsche Seite: eToro-Angebot wie auf der Landing (Anzeige, Logo, Bedingungen, Partnerlink,
 * Offenlegung, Risikohinweise; alles aus ETORO_OFFER und der Angebotskarte der Landing) und ein leiser Hinweis auf die Mentorship.
 * Ist das Angebot aus (ETORO_OFFER.enabled), bleibt nur der Hinweis auf die Mentorship.
 */
export function EtoroAngebot() {
  if (!ETORO_OFFER.enabled) {
    return (
      <section className="sec angebot" id="angebot" aria-labelledby="angebot-titel">
        <div className="wrap angebot-schmal">
          <p className="label">PAT Mentorship</p>
          <h2 id="angebot-titel">
            <span className="dim">ICT verstehen.</span>
            <span>Schritt für Schritt.</span>
          </h2>
          <p className="lead">
            Der Rechner prüft deine Zahlen. In der PAT Mentorship erkläre ich dir die Konzepte von ICT in einem klaren Lehrplan, auf Deutsch
            und live am aktuellen Markt. {PRICE_LABEL} pro Monat, monatlich kündbar.
          </p>
          <p className="mentorship-hinweis">
            <Link className="lnk" href="/#preis" prefetch={false}>
              Mentorship und Preis ansehen
            </Link>
          </p>
        </div>
      </section>
    )
  }
  return (
    <section className="sec partner angebot" id="angebot" aria-labelledby="angebot-titel">
      <div className="wrap offer-grid">
        <div>
          <p className="label">Partner-Angebot · Anzeige</p>
          <h2 id="angebot-titel">
            <span className="dim">Dein erster Monat Mentorship.</span>
            <span>Geht auf eToro.</span>
          </h2>
          <p className="lead">
            Der Rechner prüft deine Zahlen. In der PAT Mentorship erkläre ich dir die Konzepte von ICT Schritt für Schritt, auf Deutsch und
            live. Eröffne über meinen Link ein Konto bei eToro und zahle {ETORO_OFFER.minDeposit} ein, dann übernimmt eToro deinen ersten
            Monat. Traden musst du dafür nicht.
          </p>
          <PartnerSteps />
          <p className="mentorship-hinweis">
            Lieber ohne eToro? Die Mentorship kostet {PRICE_LABEL} pro Monat und ist monatlich kündbar.{' '}
            <Link className="lnk" href="/#preis" prefetch={false}>
              Mentorship ansehen
            </Link>
          </p>
        </div>
        <PartnerCard cta={ETORO_CTA.tool} />
      </div>
    </section>
  )
}

/** Block nach den Ergebnissen, englische Seite: Petars Research-Newsletter statt eToro. */
export function ResearchLog() {
  return (
    <section className="sec angebot" id="research-log" aria-labelledby="research-titel">
      <div className="wrap offer-grid">
        <div>
          <p className="label">Research log</p>
          <h2 id="research-titel">
            <span className="dim">Get my research log.</span>
            <span>What holds up, and what doesn’t.</span>
          </h2>
          <p className="lead">
            I research trading strategies with AI agents and test every idea honestly, on market data it has never seen. The log shows what
            holds up and what doesn’t, failures included.
          </p>
        </div>
        <div className="offer">
          <p className="nm">Research log by Petar</p>
          <p className="amt">
            <b>Free</b>
            <span>by email</span>
          </p>
          <p className="terms">On Substack, unsubscribe at any time</p>
          <ul>
            <li>Strategy research with AI agents, written up plainly</li>
            <li>Every result checked on data the strategy never saw</li>
            <li>Failures included. No signals, no profit promises</li>
          </ul>
          <a className="btn btn-inv" href={RESEARCH_LOG_URL} target="_blank" rel="noopener" data-cta="pfr-en-research">
            Subscribe for free <span className="arr" aria-hidden="true">↗</span>
          </a>
          <p className="fine">You sign up on Substack. Your email address goes to Substack, not to this site.</p>
        </div>
      </div>
    </section>
  )
}

/** Der passende Block je Sprache: Deutsch eToro und Mentorship, Englisch der Research-Newsletter. */
export function Angebot({ sprache }: { sprache: 'de' | 'en' }) {
  return sprache === 'de' ? <EtoroAngebot /> : <ResearchLog />
}
