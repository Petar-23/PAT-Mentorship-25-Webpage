import Link from 'next/link'
import { ETORO_CTA, ETORO_OFFER, YOUTUBE_URL } from '@/components/landing-v3/content'
import { EtoroLogo } from '@/components/landing-v3/sections/partner'
import { woerterbuch, type Sprache } from './texte'

export const X_URL = 'https://x.com/petar_trades'
export const AI_LAB_URL = 'https://petartrades.substack.com'

/**
 * Karte am Ende des Ablaufs, in beiden Sprachen dieselbe: genau drei Wege weiter (X und YouTube, AI Lab, eToro-Angebot).
 * Das eToro-Angebot trägt Kennzeichnung, Bedingung, Vergütungs- und Risikohinweis im selben Block (Texte aus ETORO_OFFER,
 * auf Englisch aus ETORO_OFFER.en). Ist das Angebot aus, bleiben die ersten beiden.
 */
export function CtaKarte({ sprache }: { sprache: Sprache }) {
  const t = woerterbuch(sprache)
  const C = t.cta
  const o = sprache === 'de' ? ETORO_OFFER : { ...ETORO_OFFER, ...ETORO_OFFER.en }
  return (
    <section className="cta-karte" aria-labelledby={`cta-titel-${sprache}`}>
      <h3 id={`cta-titel-${sprache}`}>{C.titel}</h3>
      <ol className="cta-wege">
        <li>
          <div className="cta-weg cta-weg-block">
            <span className="cta-nr" aria-hidden="true">01</span>
            <span className="cta-text">
              <b>{C.folgen.titel}</b>
              <small>{C.folgen.text}</small>
              <span className="cta-paar">
                <a className="cta-ziel" href={X_URL} target="_blank" rel="noopener" data-cta={`pfr-${sprache}-x`}>
                  {C.folgen.x} <span className="arr" aria-hidden="true">↗</span>
                </a>
                <a className="cta-ziel" href={YOUTUBE_URL} target="_blank" rel="noopener" data-cta={`pfr-${sprache}-youtube`}>
                  {C.folgen.yt} <span className="arr" aria-hidden="true">↗</span>
                </a>
              </span>
            </span>
          </div>
        </li>
        <li>
          <a className="cta-weg" href={AI_LAB_URL} target="_blank" rel="noopener" data-cta={`pfr-${sprache}-ailab`}>
            <span className="cta-nr" aria-hidden="true">02</span>
            <span className="cta-text">
              <b>{C.lab.titel}</b>
              <small>{C.lab.text}</small>
            </span>
            <span className="arr" aria-hidden="true">↗</span>
          </a>
        </li>
        {ETORO_OFFER.enabled && (
          <li className="cta-etoro">
            <div className="cta-weg cta-weg-block">
              <span className="cta-nr" aria-hidden="true">03</span>
              <span className="cta-text">
                <span className="cta-marke">
                  <span className="pt-tag">{C.etoro.anzeige}</span>
                  <EtoroLogo size="sm" />
                </span>
                <b>{C.etoro.titel}</b>
                {C.etoro.zusatz && <small className="cta-zusatz">{C.etoro.zusatz}</small>}
                <small>{C.etoro.bedingung(o.minDeposit)}</small>
                <span className="cta-knoepfe">
                  <a className="btn btn-inv" href={ETORO_OFFER.href} target="_blank" rel="sponsored noopener" data-cta={ETORO_CTA.tool}>
                    {C.etoro.knopf} <span className="arr" aria-hidden="true">↗</span>
                  </a>
                  <Link className="lnk" href="/#etoro" prefetch={false} hrefLang={sprache === 'en' ? 'de' : undefined}>
                    {C.etoro.wie}
                  </Link>
                </span>
                <span className="cta-fein">{o.disclosure}</span>
                <span className="pt-risk" role="note">
                  <span>
                    <b>{C.etoro.risikoTitel}</b> {o.riskPlatform}
                  </span>
                  <span>{o.riskCfd}</span>
                </span>
              </span>
            </div>
          </li>
        )}
      </ol>
    </section>
  )
}
