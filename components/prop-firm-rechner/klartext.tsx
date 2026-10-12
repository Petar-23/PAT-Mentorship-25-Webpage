'use client'

import type { Zeile as VorZeile } from '@/lib/prop-firm/auswertung'
import type { KontoEintrag } from '@/lib/prop-firm/konten'
import { RW, type RwDetail } from '@/lib/prop-firm/rueckwaerts'
import { Erklaerung, Satz, Zaehler } from './bewegung'
import { unterzeile } from './ergebnisse'
import { erwartungVor, zahlAus, type VorRechnung } from './rechner'
import { drawdown, type RueckAntworten, type Zeile } from './rueckwaerts'
import { posten, type EndenAnteile } from './scheitern'
import type { Form } from './start'
import { woerterbuch, type Sprache, type Woerterbuch } from './texte'

/** Abstand für den Satz „Liegt deine Trefferquote … darunter“ (Prozentpunkte) */
export const DARUNTER_PUNKTE = 5

function scheitertSatz(a: EndenAnteile, t: Woerterbuch): { satz: string; erklaerung: string | null } {
  const f = posten(a).filter((p) => p.fehler)
  if (!f.length) return { satz: t.app.keinScheitern, erklaerung: null }
  const p = f[0]
  const name = `${t.enden.name[p.ende]} ${p.phase === 'funded' ? t.enden.funded : t.enden.pruefung}`
  return { satz: t.app.scheitert(name, t.f.pct(p.anteil)), erklaerung: t.enden.erklaerung[p.ende] }
}

/** Ein Satz, warum dieses Konto am leichtesten ist: Drawdown, wie er nachgezogen wird, und der Preis. */
function warumSatz(e: KontoEintrag, t: Woerterbuch): string {
  const ph = e.konto.phasen[0]
  const dd = drawdown(e)
  const preis = e.konto.preis === null ? t.f.ka : e.konto.rhythmus === 'monatlich' ? t.app.preisMonatlich(t.f.usd(e.konto.preis)) : t.app.preisEinmalig(t.f.usd(e.konto.preis))
  return t.app.warum(dd ? t.f.usd(dd) : t.f.ka, t.app.ddArt[ph?.dd_art ?? 'keiner'] ?? '', preis)
}

/** Ergebnis rückwärts in Klartext, Satz für Satz. */
export function RueckKlartext({ sprache, antworten, bester, detail, darunter, onAndere }: {
  sprache: Sprache
  antworten: RueckAntworten
  bester: Zeile | null
  detail: RwDetail | null
  darunter: RwDetail | null
  onAndere: () => void
}) {
  const t = woerterbuch(sprache)
  const A = t.app
  const crv = t.f.zahlText(antworten.crv, 1)
  const z = bester?.gewaehlt ?? null
  const dd = bester ? drawdown(bester.e) : null
  const risiko = z && dd ? RW.risiko[z.risikoIndex] * dd : null
  const s = detail ? scheitertSatz(detail, t) : null
  return (
    <div className="klar">
      <Satz i={0} klasse="klar-intro">
        {A.intro(t.rueck.monate(antworten.monate), t.f.usd(antworten.ziel), antworten.sicherheit)}{' '}
        {bester && z ? A.muss : null}
      </Satz>
      {bester && z ? (
        <>
          <div className="klar-zeilen">
            <Satz i={1} als="div" klasse="klar-zeile">
              <span>{A.trefferMin}</span>
              <b className="num"><Zaehler wert={z.trefferquote} format={(x) => t.f.pct(x)} /></b>
              <span>{A.beiCrv(crv)}</span>
            </Satz>
            <Satz i={2} als="div" klasse="klar-zeile">
              <b className="num">{antworten.tpw}</b>
              <span>{A.tradesProWoche}</span>
            </Satz>
            <Satz i={3} als="div" klasse="klar-zeile">
              <span>{A.risikoJeTrade}</span>
              <b className="num">{risiko !== null ? <Zaehler wert={risiko} format={(x) => t.f.usd(x)} /> : t.f.ka}</b>
              <span>{A.risikoAnteil(t.f.prozent(RW.risiko[z.risikoIndex] * 100))}</span>
            </Satz>
          </div>
          <Satz i={4} klasse="klar-satz">{A.erwartung(t.f.r(z.erwartung))}</Satz>
          <Satz i={5} klasse="klar-konto">
            {A.leichtesten}: <b>{bester.e.firma} {t.f.groesseKurz(bester.e.groesse)}</b>
            <small>{unterzeile(bester.e, t)}</small>
          </Satz>
          <Satz i={6} klasse="klar-klein">{warumSatz(bester.e, t)}</Satz>
          {darunter && (
            <Satz i={7} klasse="klar-satz">
              {A.darunter(DARUNTER_PUNKTE, t.f.pct(Math.max(0, z.trefferquote - DARUNTER_PUNKTE / 100)), Math.floor(darunter.erreicht * 10 + 1e-9))}
            </Satz>
          )}
          {s && (
            <Satz i={8} als="div" klasse="klar-satz">
              <p>{s.satz}</p>
              {s.erklaerung && <Erklaerung titel={t.wz.wasHeisst} klasse="erkl-klein">{s.erklaerung}</Erklaerung>}
            </Satz>
          )}
        </>
      ) : (
        <Satz i={1} klasse="klar-satz">{A.keinKonto(crv)}</Satz>
      )}
      <Satz i={9} als="div" klasse="klar-links">
        <button type="button" className="lnk-knopf" onClick={onAndere}>{A.andereKonten}</button>
      </Satz>
    </div>
  )
}

/** Ergebnis vorwärts in Klartext, Satz für Satz. */
export function VorKlartext({ sprache, form, rechnung, onAndere, onAnnahmen }: {
  sprache: Sprache
  form: Form
  rechnung: VorRechnung
  onAndere: () => void
  onAnnahmen: () => void
}) {
  const t = woerterbuch(sprache)
  const A = t.app
  const b: VorZeile | null = rechnung.bester
  const e = erwartungVor(form, sprache)
  const s = b ? scheitertSatz(b.kante, t) : null
  const netto = b?.rangNetto ?? null
  return (
    <div className="klar">
      <Satz i={0} klasse="klar-intro">
        {netto !== null && netto <= 0
          ? A.vorMinus
          : A.vorIntro(t.f.prozent(zahlAus(form.trefferquote, sprache)), form.crv, t.f.usd(zahlAus(form.risikoUsd, sprache)), form.tradesProWoche)}
      </Satz>
      {b && netto !== null ? (
        <>
          <Satz i={1} als="div" klasse="klar-gross">
            <b className={`num ${netto > 0 ? '' : 'minus'}`}><Zaehler wert={netto} format={(x) => t.f.usd(x, true)} /></b>
            <span>{A.proMonat}</span>
          </Satz>
          <Satz i={2} klasse="klar-konto">
            {A.bei} <b>{b.eintrag.firma} {t.f.groesseKurz(b.eintrag.groesse)}</b>
            <small>{unterzeile(b.eintrag, t)}</small>
          </Satz>
          <Satz i={3} klasse="klar-klein">{A.nachGebuehren}</Satz>
          {b.kante.netto && <Satz i={4} klasse="klar-satz">{A.imPlus(Math.floor(b.kante.netto.positiv * 10 + 1e-9))}</Satz>}
          {e !== null && <Satz i={5} klasse="klar-satz">{A.vorErwartung(t.f.r(e))}</Satz>}
          {s && (
            <Satz i={6} als="div" klasse="klar-satz">
              <p>{s.satz}</p>
              {s.erklaerung && <Erklaerung titel={t.wz.wasHeisst} klasse="erkl-klein">{s.erklaerung}</Erklaerung>}
            </Satz>
          )}
        </>
      ) : (
        <Satz i={1} klasse="klar-satz">{t.ergebnis.rechnet}</Satz>
      )}
      <Satz i={7} als="div" klasse="klar-links">
        <button type="button" className="lnk-knopf" onClick={onAndere}>{A.andereKonten}</button>
        <button type="button" className="lnk-knopf" onClick={onAnnahmen}>{A.annahmen}</button>
      </Satz>
    </div>
  )
}
