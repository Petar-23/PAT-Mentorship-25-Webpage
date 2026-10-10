'use client'

import type { Zeile } from '@/lib/prop-firm/auswertung'
import { BOT_TEXT, KO_TEXT, VERBOT_TEXT, feldText, type RegelDaten } from '@/lib/prop-firm/konten'
import { datum, kostenSaetze, pct, regelSaetze, usd, zahlText } from './texte'

/** Aufgeklappte Tabellenzeile: Regeln, Kosten, weitere Kennzahlen, offene Punkte, Bot-Bedingungen, Quellen. */
export function Details({ zeile, daten, botBetrieb }: { zeile: Zeile; daten: RegelDaten; botBetrieb: boolean }) {
  const e = zeile.eintrag
  const k = zeile.kante
  const offen = [...new Set(e.offen.map(feldText))]
  const strenger = [...new Set(e.strenger.map(feldText))]
  return (
    <div className="details-grid">
      <div>
        <h4>Regeln</h4>
        {regelSaetze(e.konto).map((p) => (
          <div className="phase" key={p.titel}>
            <b>{p.titel}:</b> {p.saetze.join('; ')}.
          </div>
        ))}
        {e.liveNichtSimuliert && <p>Ein späteres Live-Konto rechnet der Rechner nicht mit (der Konto-Platz endet dort und wird neu gekauft).</p>}
      </div>
      <div>
        <h4>Kosten</h4>
        <ul>
          {kostenSaetze(e.konto, botBetrieb).map((s) => <li key={s}>{s}</li>)}
          {e.aktionen.map((a) => <li key={a.name}>{a.text}</li>)}
        </ul>
        <h4 style={{ marginTop: 14 }}>Weitere Kennzahlen</h4>
        <ul>
          {e.hatEval && <li>Bestanden in 12 Monaten: {pct(k.bestanden12)}, Median {k.passMedianHT !== null ? `${zahlText(k.passMedianHT)} Handelstage` : 'k. A.'}</li>}
          {e.hatEval && <li>In der Prüfung gesprengt: {pct(k.bruchEval12)}</li>}
          <li>Erste Auszahlung in 12 Monaten (ein Kauf): {pct(k.ausz12)}</li>
          {k.kAusz6 !== null && <li>Erste Auszahlung in 6 Monaten mit Nachkauf: {pct(k.kAusz6)}</li>}
          {k.netto && <li>Jahre mit Plus: {pct(k.netto.positiv)}</li>}
          {k.gebuehren !== null && <li>Gebühren im Schnitt: {usd(k.gebuehren)} pro Monat, Auszahlungen netto {usd(k.ertrag)} pro Monat</li>}
          {k.kaeufe !== null && <li>Käufe im Jahr: {zahlText(k.kaeufe, 1)}, Auszahlungen im Jahr: {zahlText(k.auszahlungen, 1)}</li>}
          {k.einsatzP90 !== null && <li>Kapital, das du vorstrecken musst (9 von 10 Jahren): bis {usd(k.einsatzP90)}</li>}
          {k.netto && <li>Netto pro Monat: Mittel {usd(k.netto.mittel, true)} ± {zahlText(2 * k.netto.se)} (Simulationsstreuung), Median {usd(k.netto.p50, true)}</li>}
        </ul>
        {zeile.varianten.length > 0 && (
          <>
            <h4 style={{ marginTop: 14 }}>Unklare Regel, zweite Lesart</h4>
            <ul>
              {zeile.varianten.map((v) => (
                <li key={v.name}>
                  {v.text}: Netto {usd(v.kante.netto?.mittel, true)} pro Monat, erste Auszahlung in 6 Monaten {pct(v.kante.ausz6)}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <div>
        <h4>Hinweise</h4>
        <ul>
          <li>Bots: {BOT_TEXT[e.konto.bot_eignung] ?? e.konto.bot_eignung}</li>
          {e.konto.ko_kriterien.map(([code]) => <li key={code}>{KO_TEXT[code] ?? code}</li>)}
          {e.konto.verbote_codes.length > 0 && <li>Verboten: {e.konto.verbote_codes.map((c) => VERBOT_TEXT[c] ?? c).join(', ')}</li>}
          {offen.length > 0 && <li>Bei der Firma nicht eindeutig: {offen.join(', ')}</li>}
          {strenger.length > 0 && <li>Strenger gerechnet, weil nicht genannt: {strenger.join(', ')}</li>}
          {zeile.grund && <li>Nicht rechenbar: {zeile.grund}</li>}
        </ul>
        <h4 style={{ marginTop: 14 }}>Quellen (abgerufen {datum(daten.stand)})</h4>
        <ul>
          {e.quellen.slice(0, 12).map((q) => {
            const quelle = daten.quellen[q]
            if (!quelle) return null
            return (
              <li key={q}>
                <a href={quelle.url} target="_blank" rel="noopener noreferrer nofollow">{quelle.titel}</a>
              </li>
            )
          })}
          {e.quellen.length > 12 && <li>und {e.quellen.length - 12} weitere (siehe Quellen unten)</li>}
        </ul>
      </div>
    </div>
  )
}
