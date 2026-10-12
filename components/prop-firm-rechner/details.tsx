'use client'

import type { Zeile } from '@/lib/prop-firm/auswertung'
import type { RegelDaten } from '@/lib/prop-firm/konten'
import { woerterbuch, type Sprache } from './texte'

/** Aufgeklappte Tabellenzeile: Regeln, Kosten, weitere Kennzahlen, offene Punkte, Bot-Bedingungen, Quellen. */
export function Details({ zeile, daten, botBetrieb, sprache }: { zeile: Zeile; daten: RegelDaten; botBetrieb: boolean; sprache: Sprache }) {
  const t = woerterbuch(sprache)
  const D = t.details
  const { usd, pct, zahlText, datum } = t.f
  const e = zeile.eintrag
  const k = zeile.kante
  const offen = [...new Set(e.offen.map(t.daten.feld))]
  const strenger = [...new Set(e.strenger.map(t.daten.feld))]
  return (
    <div className="details-grid">
      <div>
        <h4>{D.regeln}</h4>
        {t.regelSaetze(e.konto).map((p) => (
          <div className="phase" key={p.titel}>
            <b>{p.titel}:</b> {p.saetze.join('; ')}.
          </div>
        ))}
        {e.liveNichtSimuliert && <p>{D.live}</p>}
      </div>
      <div>
        <h4>{D.kosten}</h4>
        <ul>
          {t.kostenSaetze(e.konto, botBetrieb).map((s) => <li key={s}>{s}</li>)}
          {e.aktionen.map((a) => <li key={a.name}>{t.daten.aktion(a)}</li>)}
        </ul>
        <h4 className="h4-weiter">{D.weitere}</h4>
        <ul>
          {e.hatEval && <li>{D.bestanden12(pct(k.bestanden12), k.passMedianHT !== null ? zahlText(k.passMedianHT) : null)}</li>}
          {e.hatEval && <li>{D.bruchEval(pct(k.bruchEval12))}</li>}
          <li>{D.ausz12(pct(k.ausz12))}</li>
          {k.kAusz6 !== null && <li>{D.kAusz6(pct(k.kAusz6))}</li>}
          {k.netto && <li>{D.jahrePlus(pct(k.netto.positiv))}</li>}
          {k.gebuehren !== null && <li>{D.gebuehren(usd(k.gebuehren), usd(k.ertrag))}</li>}
          {k.kaeufe !== null && <li>{D.kaeufe(zahlText(k.kaeufe, 1), zahlText(k.auszahlungen, 1))}</li>}
          {k.einsatzP90 !== null && <li>{D.einsatz(usd(k.einsatzP90))}</li>}
          {k.netto && <li>{D.netto(usd(k.netto.mittel, true), zahlText(2 * k.netto.se), usd(k.netto.p50, true))}</li>}
        </ul>
        {zeile.varianten.length > 0 && (
          <>
            <h4 className="h4-weiter">{D.unklar}</h4>
            <ul>
              {zeile.varianten.map((v) => (
                <li key={v.name}>{D.variante(t.daten.regelVariante(v.name, v.text), usd(v.kante.netto?.mittel, true), pct(v.kante.ausz6))}</li>
              ))}
            </ul>
          </>
        )}
      </div>
      <div>
        <h4>{D.hinweise}</h4>
        <ul>
          <li>{D.bots} {t.daten.bot(e.konto.bot_eignung)}</li>
          {e.konto.ko_kriterien.map(([code]) => <li key={code}>{t.daten.ko(code)}</li>)}
          {e.konto.verbote_codes.length > 0 && <li>{D.verboten} {e.konto.verbote_codes.map(t.daten.verbot).join(', ')}</li>}
          {offen.length > 0 && <li>{D.offen} {offen.join(', ')}</li>}
          {strenger.length > 0 && <li>{D.strenger} {strenger.join(', ')}</li>}
          {zeile.grund && <li>{D.nichtRechenbar} {t.daten.grund(zeile.grund)}</li>}
        </ul>
        <h4 className="h4-weiter">{D.quellen(datum(daten.stand))}</h4>
        <ul>
          {e.quellen.slice(0, 12).map((q) => {
            const quelle = daten.quellen[q]
            if (!quelle) return null
            return (
              <li key={q}>
                <a href={quelle.url} target="_blank" rel="noopener noreferrer nofollow">{t.daten.quelleTitel({ id: q, ...quelle })}</a>
              </li>
            )
          })}
          {e.quellen.length > 12 && <li>{D.weitereQuellen(e.quellen.length - 12)}</li>}
        </ul>
      </div>
    </div>
  )
}
