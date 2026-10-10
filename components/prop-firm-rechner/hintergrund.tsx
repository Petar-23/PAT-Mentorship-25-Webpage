import type { RegelDaten } from '@/lib/prop-firm/konten'
import { FIRMEN } from '@/lib/prop-firm/konten'
import { datum } from './texte'

/** Statischer Teil unter dem Rechner (Server Component): Methode, Annahmen, Regelstand und Quellen, Rechtliches. */
export function Hintergrund({ daten }: { daten: RegelDaten }) {
  const stand = datum(daten.stand)
  const quellenJeFirma = FIRMEN.map((firma) => {
    const keys = new Set<string>()
    for (const k of [...daten.konten, ...daten.nicht_simulierbar]) if (k.firma === firma) k.quellen.forEach((q) => keys.add(q))
    return { firma, quellen: [...keys].sort().map((q) => daten.quellen[q]).filter(Boolean) }
  })
  return (
    <>
      <section className="wrap abschnitt" aria-labelledby="methode-titel">
        <h2 id="methode-titel">So rechnet der Rechner</h2>
        <div className="text-grid">
          <div>
            <p>
              Für jeden Kontotyp spielt der Rechner viele mögliche Handelsjahre durch. Ein Jahr hat rund 260 Handelstage.
              Wie viele Trades an einem Tag fallen, ist zufällig, im Schnitt so viele wie du pro Woche angibst. Jeder Trade
              gewinnt mit deiner Trefferquote. Gewinner streuen um deinen Durchschnittsgewinn, Verlierer verlieren deinen
              Durchschnittsverlust.
            </p>
            <p>
              Tag für Tag laufen dabei die Regeln der Firma mit: Drawdown (nachziehend zum Tagesschluss, in Echtzeit oder
              fest), Tagesverlustgrenze (weich oder hart), Consistency-Regeln, Gewinnziel, Mindesthandelstage,
              Kontraktgrenzen und Scaling-Plan, Inaktivität, Auszahlungsregeln (Gewinntage, Puffer, Deckel, Split,
              Mindestbetrag, Abstand) und alle Gebühren.
            </p>
          </div>
          <div>
            <p>
              Du bekommst zwei Blickwinkel. <strong>Ein Kauf:</strong> Wie oft bestehst du die Prüfung, wie oft kommt die
              erste Auszahlung, wie oft ist das Konto weg. <strong>Ein Konto-Platz über zwölf Monate:</strong> Geht ein Konto
              verloren, wird neu gekauft oder die Prüfung zurückgesetzt, wo die Firma das anbietet. Daraus entsteht Netto pro
              Monat.
            </p>
            <p>
              <strong>Kante 0:</strong> Derselbe Lauf mit denselben Trades, nur ist jedes Ergebnis um deine Erwartung je Trade
              verschoben. Form und Streuung bleiben gleich, die Erwartung ist null. So siehst du, was Glück und die
              Regelstruktur allein liefern. Die Rechenregeln stimmen mit einem geprüften Referenz-Simulator überein;
              automatische Tests vergleichen beide auf festen Trade-Strömen.
            </p>
          </div>
        </div>

        <h3 style={{ marginTop: 36, marginBottom: 6 }}>Annahmen und Grenzen</h3>
        <details className="akk">
          <summary>Trades und Kosten</summary>
          <div>
            <ul className="liste">
              <li>Gewinn und Verlust in R sind netto: Gebühren und Slippage stecken schon drin.</li>
              <li>Bei Perp-Konten (Vest, MyFundedPerps) kommen auf Wunsch Spread 0,5 Punkte, Finanzierung 10 % im Jahr und die Kommission der Firma dazu. Kursniveau 20.000 Punkte.</li>
              <li>Verlauf im Trade: Verlierer laufen bis zum Stopp und lagen vorher bis 0,5 R im Plus. Gewinner lagen vorher bis 0,6 R im Minus und zwischendurch bis 25 % über dem Endergebnis. Bei Echtzeit-Drawdowns zählt erst der Hochpunkt, dann das Tief (vorsichtig).</li>
              <li>Trades laufen nacheinander in der US-Sitzung, immer nur eine Position. Feiertage sind nicht berücksichtigt.</li>
              <li>Futures handeln ganze Kontrakte (abgerundet und gedeckelt durch Kontraktgrenze und Scaling-Plan), Perps stufenlos bis zur Hebelgrenze.</li>
            </ul>
          </div>
        </details>
        <details className="akk">
          <summary>Prüfung, Auszahlung, Konto-Platz</summary>
          <div>
            <ul className="liste">
              <li>Ist das Gewinnziel erreicht, wird an dem Tag nicht weiter gehandelt. Bestanden heißt: Ziel, Consistency und Mindesttage erfüllt. Das Funded-Konto beginnt am nächsten Handelstag.</li>
              <li>Die Auszahlung kommt am Ende des ersten erlaubten Tages und ist sofort weg vom Konto. Bearbeitungszeiten und Ablehnungen nach Ermessen der Firma sind nicht eingerechnet.</li>
              <li>Droht eine Inaktivitätsregel, setzt der Rechner einen kleinen Trade für 3 USD.</li>
              <li>Ein späteres Live-Konto mit echtem Geld rechnet der Rechner nicht mit. Der Konto-Platz endet dort und wird neu gekauft. Steuern sind nicht eingerechnet.</li>
              <li>Abo-Preise laufen bis zum Bestehen weiter. Ein Monat hat 30,44 Tage.</li>
            </ul>
          </div>
        </details>
        <details className="akk">
          <summary>Was nicht abgebildet ist</summary>
          <div>
            <ul className="liste">
              <li>News-Sperren, Handelszeiten, die Höchstzahl an Konten je Person und Tagesgewinn-Deckel einzelner Programme.</li>
              <li>Verbote wie Microscalping, Kopierhandel oder „unrealistische Positionsgrößen“. Sie entscheiden, ob eine Strategie bei der Firma überhaupt erlaubt ist, und stehen deshalb je Kontotyp unter „Hinweise“.</li>
              <li>Sonderprogramme mit eigener Logik (zum Beispiel Level-Systeme) rechnet der Rechner nicht.</li>
              <li>Unklare Regeln rechnet der Rechner in beiden Lesarten. Für die Rangfolge zählt die ungünstigere. Aktionspreise und befristete Aktionen sind nicht eingerechnet.</li>
            </ul>
          </div>
        </details>
      </section>

      <section className="wrap abschnitt" aria-labelledby="quellen-titel">
        <h2 id="quellen-titel">Regelstand und Quellen</h2>
        <p className="unter">
          Stand der Regeln: {stand}. Regeln ändern sich. Prüfe vor jedem Kauf die aktuellen Bedingungen direkt bei der Firma.
          Die Links führen zu den Seiten der Firmen und sind keine Werbe- oder Affiliate-Links.
        </p>
        <details className="akk" style={{ marginTop: 18 }}>
          <summary>Alle Quellen anzeigen ({Object.keys(daten.quellen).length})</summary>
          <div className="quellen">
            {quellenJeFirma.map(({ firma, quellen }) => (
              <div key={firma}>
                <h3 style={{ fontSize: 18, marginBottom: 8 }}>{firma}</h3>
                <ul>
                  {quellen.map((q) => (
                    <li key={q.url}>
                      <a href={q.url} target="_blank" rel="noopener noreferrer nofollow">{q.titel}</a>
                      {q.abruf ? <span className="klein"> · abgerufen {datum(q.abruf)}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      </section>

      <footer className="wrap rechtlich">
        <p>
          Keine Finanzberatung und keine Anlageberatung. Der Rechner zeigt Simulationen unter Annahmen, keine Prognosen.
          Simulierte Ergebnisse garantieren keine künftigen Ergebnisse. Prop-Firm-Konten sind überwiegend simulierte Konten,
          Auszahlungen hängen von den Bedingungen und dem Ermessen der jeweiligen Firma ab.
        </p>
        <p>
          Die Reihenfolge ist keine Empfehlung einer Firma. Firmennamen sind Marken ihrer Inhaber. Alle Rechnungen laufen
          in deinem Browser, deine Eingaben werden nicht übertragen.
        </p>
      </footer>
    </>
  )
}
