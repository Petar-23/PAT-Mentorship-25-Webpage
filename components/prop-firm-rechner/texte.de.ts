/**
 * Prop-Firm-Rechner, Wörterbuch Deutsch. Alle sichtbaren Texte der deutschen Seite stehen hier.
 * Regeln: Du-Ansprache, keine Gedankenstriche (U+2013, U+2014), keine Gewinnversprechen.
 * Das englische Wörterbuch (texte.en.ts) hat dieselbe Form (Typ Woerterbuch).
 */
import type { Konto, Phase } from '@/lib/prop-firm/kern'
import { BOT_TEXT, KO_TEXT, VERBOT_TEXT, feldText } from '@/lib/prop-firm/konten'
import { formatierer } from './format'

const f = formatierer('de')
const { usd } = f

/** Absatz mit fetten Stellen: Text oder { b: 'fett' }. */
export type Absatz = (string | { b: string })[]
export type Quellenzeile = { id: string; url: string; titel: string }

const DD_ART: Record<string, string> = {
  eod_trailing: 'nachziehend zum Tagesschluss',
  intraday_trailing: 'nachziehend in Echtzeit',
  statisch: 'fest',
  keiner: 'keiner',
}

function phaseName(p: Phase, i: number, k: Konto): string {
  if (p.typ === 'eval') {
    const n = k.phasen.filter((x) => x.typ === 'eval').length
    return n > 1 ? `Prüfung, Stufe ${p.stufe}` : 'Prüfung'
  }
  return i === 0 ? 'Funded (sofort, ohne Prüfung)' : 'Funded'
}

function dllText(p: Phase): string | null {
  if (p.dll_betrag === null && p.dll_anteil === null) return null
  let b: string
  if (p.dll_stufen && p.dll_stufen.length) b = `${usd(p.dll_betrag)}, steigt mit dem Kontostand`
  else if (p.dll_anteil !== null) b = `${f.prozent(p.dll_anteil * 100)} ${p.dll_anteil_bezug === 'tagesbeginn' ? 'des Stands bei Tagesbeginn' : 'des Startsaldos'}`
  else b = usd(p.dll_betrag)
  const w = p.dll_wirkung === 'tagessperre' ? 'weich: Handel für den Rest des Tages gesperrt' : 'hart: Konto verloren'
  return `Tagesverlustgrenze ${b} (${w})`
}

/** Regeln eines Kontotyps in kurzen Sätzen, je Phase. */
function regelSaetze(k: Konto): { titel: string; saetze: string[] }[] {
  return k.phasen.map((p, i) => {
    const s: string[] = []
    if (p.typ === 'eval' && p.ziel !== null) s.push(`Gewinnziel ${usd(p.ziel)}`)
    if (p.dd_art !== 'keiner' && p.dd_betrag !== null) {
      let t = `Drawdown ${usd(p.dd_betrag)}, ${DD_ART[p.dd_art] ?? p.dd_art}`
      if (p.lock !== null && p.dd_art !== 'statisch') {
        const ueber = p.lock - p.start
        t += ueber === 0 ? ', zieht nur bis zum Startsaldo nach' : `, zieht nur bis Start ${usd(ueber, true)} nach`
      }
      s.push(t)
    }
    const d = dllText(p)
    if (d) s.push(d)
    if (p.cons_anteil) s.push(`Consistency: bester Tag höchstens ${f.prozent(Math.round(p.cons_anteil * 100))} des Gesamtgewinns (sonst steigt das Ziel)`)
    if (p.min_tage) s.push(`mindestens ${p.min_tage} Handelstage`)
    if (p.max_tage) s.push(`Zeitlimit ${p.max_tage} Kalendertage`)
    if (p.max_micro !== null || p.max_mini !== null) s.push(`höchstens ${p.max_mini ?? f.ka} Mini bzw. ${p.max_micro ?? f.ka} Micro${p.skalierung ? ' (Scaling-Plan nach Kontostand)' : ''}`)
    if (p.hebel) s.push(`Hebel bis ${p.hebel}x`)
    if (p.inaktiv_art === 'kalenderwoche') s.push('mindestens ein Trade je Kalenderwoche')
    else if (p.inaktiv_tage) s.push(`höchstens ${p.inaktiv_tage} Tage ohne Trade`)
    const a = p.ausz
    if (a) {
      const t: string[] = [`Split ${f.prozent(Math.round(a.split * 100))} für dich`]
      if (a.gewinntage) t.push(`${a.gewinntage} Gewinntage${a.min_tagesgewinn ? ` ab ${usd(a.min_tagesgewinn)}` : ''} je Auszahlung`)
      if (a.handelstage) t.push(`${a.handelstage} Handelstage je Auszahlung`)
      if (a.erste_ab_tag) t.push(`erste Auszahlung frühestens nach ${a.erste_ab_tag} Tagen`)
      if (a.kalendertage) t.push(`Abstand ${a.kalendertage} Tage`)
      if (a.puffer) t.push(`Puffer ${usd(a.puffer)} bleibt stehen`)
      if (a.max_anteil !== null && a.max_anteil < 1) t.push(`höchstens ${f.prozent(Math.round(a.max_anteil * 100))} des Gewinns`)
      if (a.max_betrag && a.max_betrag.length) t.push(`höchstens ${a.max_betrag.map((x) => usd(x)).join(' / ')} je Auszahlung`)
      if (a.min_betrag) t.push(`mindestens ${usd(a.min_betrag)}`)
      if (a.cons_anteil) t.push(`Consistency ${a.cons_anteil.map((x) => f.prozent(Math.round(x * 100))).join(' / ')}`)
      if (a.max_anzahl) t.push(`nach ${a.max_anzahl} Auszahlungen ${a.ende_nach_max === 'geschlossen' ? 'Konto geschlossen' : 'Wechsel ins Live-Konto'}`)
      if (a.max_summe_brutto) t.push(`ab ${usd(a.max_summe_brutto)} Auszahlungen Wechsel ins Live-Konto`)
      if (a.lebenszeit_deckel) t.push(`insgesamt höchstens ${usd(a.lebenszeit_deckel)}`)
      s.push(`Auszahlung: ${t.join(', ')}`)
    }
    return { titel: phaseName(p, i, k), saetze: s }
  })
}

function kostenSaetze(k: Konto, botBetrieb: boolean): string[] {
  const s: string[] = []
  if (k.preis === null) s.push('Preis: von der Firma nicht öffentlich genannt')
  else s.push(`Preis ${usd(k.preis)} ${k.rhythmus === 'monatlich' ? 'pro Monat bis zum Bestehen' : 'einmalig'}`)
  if (k.aktivierung) s.push(`Aktivierung ${usd(k.aktivierung)}`)
  if (k.reset !== null) s.push(`Reset ${usd(k.reset)}${k.reset_setzt_abo_zurueck ? ' (verschiebt das Abo um 30 Tage)' : ''}`)
  for (const [name, betrag, nurBot] of k.fixkosten) {
    if (betrag && (botBetrieb || !nurBot)) s.push(`${name}: ${usd(betrag)} pro Monat${nurBot ? ' (nur mit Bot)' : ''}`)
  }
  if (k.auszahlung_gebuehr) s.push(`Gebühr je Auszahlung ${usd(k.auszahlung_gebuehr)}`)
  return s
}

export const de = {
  sprache: 'de' as 'de' | 'en',
  f,
  regelSaetze,
  kostenSaetze,

  politik: {
    A: { name: 'Nimm und geh', kurz: 'Jede mögliche Auszahlung sofort in voller Höhe. Stirbt das Konto danach, wird neu gekauft.' },
    B: { name: 'Cash-Cow', kurz: 'Nur auszahlen, was über einem stehenden Polster liegt. Das Konto soll lange leben und regelmäßig zahlen.' },
    C: { name: 'Hybrid', kurz: 'Erst wie „Nimm und geh“, bis das Polster einmal steht. Danach wie „Cash-Cow“.' },
  },

  /** Kopfzeile, Sprachwahl und Hero. */
  seite: {
    markeLabel: 'Price Action Trader, zur Startseite',
    markeHref: '/',
    sprachwahl: 'Sprache',
    kopfKnopf: 'Mentorship ansehen',
    kopfKnopfHref: '/',
    kicker: 'Werkzeug · kostenlos · rechnet in deinem Browser',
    titelDim: 'Prop-Firm-Rechner.',
    titel: 'Welche Firma passt zu deinen Trades?',
    lead: (anzahl: number) =>
      `Gib Trefferquote, Gewinn und Verlust in R ein. Der Rechner spielt tausende Handelsjahre gegen die Regeln von ${anzahl} ` +
      'Kontotypen durch, mit allen Gebühren, und zeigt dir ehrlich, wie viel davon Glück wäre.',
    sprungRechner: 'Zum Rechner',
    aufEinenBlick: 'Auf einen Blick',
    eckdaten: (anzahl: number, firmen: readonly string[], stand: string) => [
      { wert: `${anzahl} Kontotypen`, text: firmen.join(', ') },
      { wert: stand, text: 'Regelstand, jede Regel mit Quelle' },
      { wert: 'Glücksvergleich', text: 'Derselbe Lauf mit Kante 0 daneben' },
      { wert: 'Im Browser', text: 'Deine Eingaben verlassen dein Gerät nicht' },
    ],
  },

  eingaben: {
    titel: 'Deine Eingaben',
    trades: 'Deine Trades',
    trefferquote: 'Trefferquote',
    gewinn: 'Ø Gewinn',
    verlust: 'Ø Verlust',
    rHinweis: 'In R nach Gebühren und Slippage. 1 R = dein Risiko je Trade.',
    tradesProWoche: 'Trades pro Woche',
    gewinner: 'Gewinner',
    streuung: { gleich: 'gleich groß', gemischt: 'gemischt', wenige_grosse: 'wenige große' },
    streuungHilfe: 'Gleicher Durchschnitt, andere Verteilung: „wenige große“ heißt viele kleine Gewinner und ab und zu ein Ausreißer.',
    groesse: 'Positionsgröße',
    groesseUeber: 'Größe festlegen über',
    modus: { risiko: 'Risiko in USD', kontrakte: 'Kontrakte', dd_anteil: 'Anteil Drawdown' },
    risiko: 'Risiko pro Trade',
    kontrakte: 'Kontrakte je Trade',
    ddAnteil: 'Risiko je Trade als Anteil vom Drawdown',
    ddHilfe: 'Passt die Größe automatisch an jede Kontogröße an. 10 % heißt: zehn Verlierer in Folge leeren den Drawdown.',
    instrument: 'Instrument',
    stopp: 'Stopp',
    punkte: 'Punkte',
    futuresHinweis: (k: number, instrument: string, echt: string, perp: string) =>
      `Futures: ${k} ${instrument} je Trade (${echt} echtes Risiko, ganze Kontrakte, gedeckelt durch die Firmengrenzen). Perps: ${perp}.`,
    kontrakteHinweis: (risiko: string) => `= ${risiko} Risiko je Trade (Perps rechnen mit demselben Betrag).`,
    keinKontrakt: 'Mit diesem Risiko und Stopp ist nicht einmal ein Kontrakt möglich. Futures-Konten handeln dann gar nicht.',
    rahmen: 'Auszahlungsweg und Rahmen',
    weg: 'Auszahlungsweg',
    polster: 'Polster',
    polsterOptionen: { '1': '1x Drawdown', '2': '2x Drawdown' },
    bot: 'Ich handle mit einem Bot (API)',
    botHilfe: 'Rechnet API-Gebühren ein und blendet Firmen aus, die Bots verbieten.',
    perp: 'Zusatzkosten bei Perps einrechnen',
    perpHilfe: 'Spread 0,5 Punkte, Finanzierung 10 % im Jahr, Kommission der Firma (Vest, MyFundedPerps).',
    genauigkeit: 'Genauigkeit',
    pfade: { '300': 'schnell', '1000': 'genau', '3000': 'sehr genau' },
    pfadeHilfe: (n: string) => `${n} simulierte Jahre je Kontotyp, jeweils mit und ohne Kante.`,
    erwartung: 'Erwartung je Trade',
    streuungJeTrade: 'Streuung je Trade',
    belegTitel: 'Beleg für eine Kante',
    beleg: (n: string) => `rund ${n} Trades`,
    belegText: 'brauchst du, um diese Kante sicher von null zu unterscheiden.',
    keineKante: 'Ohne positive Erwartung gibt es keine Kante. Jeder Gewinn wäre Glück.',
    keineKanteWert: 'keine Kante',
    bittePruefen: 'Bitte prüfen:',
    fehler: {
      trefferquote: 'Trefferquote zwischen 1 und 99 %',
      gewinn: 'Durchschnittsgewinn größer 0 und höchstens 20 R',
      verlust: 'Durchschnittsverlust größer 0 und höchstens 5 R',
      trades: 'Trades pro Woche zwischen 0,2 und 60',
      stopp: 'Stopp zwischen 1 und 500 Punkten',
      risiko: 'Risiko pro Trade zwischen 1 und 100.000 USD',
      kontrakte: 'Kontrakte als ganze Zahl von 1 bis 200',
      dd: 'Anteil vom Drawdown zwischen 1 und 100 %',
    },
    berechnen: 'Berechnen',
    neuStarten: 'Neu starten',
    fortschritt: (a: string, b: string) => `Rechne ${a} von ${b} simulierten Jahren …`,
    veraltet: 'Eingaben geändert. Für neue Zahlen bitte neu berechnen.',
    fertig: (pfade: string, varianten: number, sekunden: string) =>
      `Fertig: ${pfade} Jahre × ${varianten} Regelvarianten in ${sekunden} s, direkt in deinem Browser.`,
    fehlerPrefix: 'Fehler:',
    workerAbbruch: 'Die Rechnung im Hintergrund ist abgebrochen.',
    /** Startwerte im Zahlenformat der Sprache. */
    startGewinnR: '1,5',
  },

  ergebnis: {
    titel: 'Dein Ergebnis.',
    titelZusatz: 'Ehrlich gerechnet.',
    groessen: { k10: 'bis 10K', k25: '20K bis 25K', k50: '50K', k100: '100K', k150: 'ab 150K' },
    unter: (pfade: string, weg: string, faktor: number | null, bot: boolean) =>
      `${pfade} simulierte Jahre je Kontotyp, Auszahlungsweg „${weg}“${faktor ? ` mit ${faktor}x Drawdown Polster` : ''}` +
      `${bot ? ', Handel per Bot' : ''}. Netto pro Monat heißt: alle Auszahlungen nach Split minus alle Gebühren (Kauf, Abo, ` +
      'Reset, Aktivierung, Fixkosten) über zwölf Monate, mit Nachkauf nach jedem verlorenen Konto.',
    glueckTitel: 'So sähe es mit reinem Glück aus',
    bestMitWerten: 'Bester Kontotyp mit deinen Werten',
    keinerMitPreis: 'keiner mit Preis in der Auswahl',
    proMonatKurz: '/ Monat',
    bestNull: 'Bester Kontotyp mit Kante 0',
    bestNullKlein: 'gleiche Trades und Streuung, Erwartung je Trade genau null',
    mittelNull: (n: number) => `Mittel über alle ${n} Kontotypen mit Kante 0`,
    mittelNullKlein: 'Ohne echte Kante gehen über viele Konten die Gebühren verloren.',
    urteil: {
      keinPreis: 'In dieser Auswahl gibt es keinen Kontotyp mit bekanntem Preis.',
      keineKante: 'Deine Eingaben haben keine positive Kante. Was hier im Plus steht, ist Glück. Über viele Konten gehen die Gebühren verloren.',
      nichtBesser:
        'Dein bester Wert liegt nicht über dem besten Wert mit reinem Glück. Mit diesen Eingaben ist das Ergebnis von Glück nicht zu unterscheiden.',
      abstand: (betrag: string) =>
        `Dein bester Kontotyp liegt ${betrag} pro Monat über dem besten Kontotyp mit reinem Glück. Nur dieser Abstand kommt aus ` +
        'deiner Kante, und nur, wenn deine Trefferquote und deine R-Werte stimmen.',
      nullPlus:
        ' Dass auch mit Kante 0 ein Kontotyp leicht im Plus liegt, kommt aus den vereinfachten Annahmen (sofortige Auszahlung, ' +
        'keine Ablehnung durch die Firma) und der Streuung der Simulation, nicht aus einer Strategie.',
    },
    sicherTitel: 'Wie sicher ist deine Kante?',
    sicherText: (erw: string, sd: string) => `Deine Eingaben ergeben ${erw} je Trade bei einer Streuung von ${sd}.`,
    sicherBand: (lo: string, hi: string, n: string) =>
      ` Aus 100 Trades geschätzt, kann die echte Erwartung irgendwo zwischen ${lo} und ${hi} liegen. Erst ab rund ${n} Trades ist ` +
      'sie mit 95 % Sicherheit größer als null.',
    sicherOhne: ' Ohne positive Erwartung ist jedes Plus Glück. Über viele Konten gehen dann die Gebühren verloren.',
    schaetzung:
      'Deine Trefferquote und deine R-Werte sind selbst Schätzungen. Stammen sie aus wenigen Trades oder aus einem Backtest, der ' +
      'nach dem Ergebnis ausgesucht wurde, ist ein Teil davon Glück. Der Rechner kann nur so gut sein wie diese Zahlen.',
    topTitel: 'Die drei besten Kontotypen für deine Eingaben',
    topUnter:
      'Sortiert nach Netto pro Monat in der vorsichtigeren Lesart, wenn eine Regel der Firma nicht eindeutig ist. Der beste Wert ' +
      'aus vielen Kontotypen ist immer etwas zu gut geschätzt: Auch die Simulation streut (± Angabe).',
    platz: (i: number) => `Platz ${i}`,
    proMonatPlusMinus: (x: string) => `pro Monat, ± ${x} USD`,
    bestehen60: 'Bestehen in 60 Handelstagen',
    ohnePruefung: 'ohne Prüfung',
    ausz6: 'Erste Auszahlung in 6 Monaten',
    mitNull: 'Mit Kante 0',
    gesprengt12: 'Gesprengt in 12 Monaten',
    gerechnetMit: (v: string) => `Gerechnet mit: ${v}.`,
    alleTitel: 'Alle Kontotypen',
    angezeigt: (a: number, b: number, bot: number) =>
      `${a} von ${b} Kontotypen in der Auswahl${bot ? `, ${bot} ausgeblendet (Firma erlaubt keine Bots)` : ''}. Zeile antippen für Regeln, Kosten und Quellen.`,
    firmen: 'Firmen',
    kontogroesse: 'Kontogröße',
    nurAktiv: 'nur aktuell angebotene',
    scrollHinweis: 'Tabelle seitlich wischen für alle Spalten.',
    spalten: {
      name: 'Kontotyp',
      preis: 'Preis',
      fk30: 'Bestehen ≤ 30 HT',
      fk30Titel: 'Anteil der Käufe, die die Prüfung in höchstens 30 Handelstagen bestehen',
      fk60: '≤ 60 HT',
      fk90: '≤ 90 HT',
      ausz6: '1. Auszahlung ≤ 6 Mon.',
      ausz6Titel: 'Ein Kauf: Anteil mit erster Auszahlung innerhalb von 6 Monaten',
      median: 'HT bis 1. Auszahlung',
      medianTitel: 'Median der Handelstage ab Kauf, nur Käufe mit Auszahlung',
      bruch: 'Gesprengt',
      bruchTitel: 'Ein Kauf: Anteil verlorener Konten in 12 Monaten',
      netto: 'Netto / Monat',
      nettoTitel: 'Konto-Platz über 12 Monate mit Nachkauf, alle Gebühren. Darunter: 10 % bis 90 % der Jahre',
      null: 'Kante 0',
      nullTitel: 'Dasselbe mit reinem Glück: Erwartung je Trade null',
    },
    mehr: (n: number) => `Alle ${n} Kontotypen anzeigen`,
    weniger: (n: number) => `Nur die ersten ${n} anzeigen`,
    leer: 'Keine Kontotypen in dieser Auswahl.',
    marken: {
      perps: 'Perps',
      ohnePruefung: 'ohne Prüfung',
      stufen: (n: number) => `${n} Prüfungsstufen`,
      regelOffen: 'Regel offen',
      aktion: 'Aktion',
      nichtAngeboten: 'nicht mehr angeboten',
      preisUnbekannt: 'Preis unbekannt',
      wegA: 'Weg A gerechnet',
      nichtRechenbar: 'nicht rechenbar',
    },
    preisMonat: ' / Monat',
    aktivierung: (b: string) => `+ ${b} Aktivierung`,
    spanne: (lo: string, hi: string) => `${lo} bis ${hi}`,
    vorsichtig: (b: string) => `vorsichtig ${b}`,
    preisUnbekannt: 'Preis unbekannt',
    legende:
      'HT = Handelstage ab Kauf. Grau: nicht in der Rangfolge (nicht mehr angeboten, Preis unbekannt oder für Bots ausgeschlossen). ' +
      '„Regel offen“: Die Firma nennt zwei Werte, für die Rangfolge zählt der ungünstigere.',
    nichtGerechnet: (liste: string) => `Nicht gerechnet: ${liste} (Sonderregeln, die der Rechner nicht abbildet).`,
  },

  details: {
    regeln: 'Regeln',
    live: 'Ein späteres Live-Konto rechnet der Rechner nicht mit (der Konto-Platz endet dort und wird neu gekauft).',
    kosten: 'Kosten',
    weitere: 'Weitere Kennzahlen',
    bestanden12: (p: string, median: string | null) => `Bestanden in 12 Monaten: ${p}, Median ${median !== null ? `${median} Handelstage` : f.ka}`,
    bruchEval: (p: string) => `In der Prüfung gesprengt: ${p}`,
    ausz12: (p: string) => `Erste Auszahlung in 12 Monaten (ein Kauf): ${p}`,
    kAusz6: (p: string) => `Erste Auszahlung in 6 Monaten mit Nachkauf: ${p}`,
    jahrePlus: (p: string) => `Jahre mit Plus: ${p}`,
    gebuehren: (g: string, e: string) => `Gebühren im Schnitt: ${g} pro Monat, Auszahlungen netto ${e} pro Monat`,
    kaeufe: (k: string, a: string) => `Käufe im Jahr: ${k}, Auszahlungen im Jahr: ${a}`,
    einsatz: (b: string) => `Kapital, das du vorstrecken musst (9 von 10 Jahren): bis ${b}`,
    netto: (m: string, se: string, p50: string) => `Netto pro Monat: Mittel ${m} ± ${se} (Simulationsstreuung), Median ${p50}`,
    unklar: 'Unklare Regel, zweite Lesart',
    variante: (text: string, netto: string, ausz: string) => `${text}: Netto ${netto} pro Monat, erste Auszahlung in 6 Monaten ${ausz}`,
    hinweise: 'Hinweise',
    bots: 'Bots:',
    verboten: 'Verboten:',
    offen: 'Bei der Firma nicht eindeutig:',
    strenger: 'Strenger gerechnet, weil nicht genannt:',
    nichtRechenbar: 'Nicht rechenbar:',
    quellen: (stand: string) => `Quellen (abgerufen ${stand})`,
    weitereQuellen: (n: number) => `und ${n} weitere (siehe Quellen unten)`,
  },

  hintergrund: {
    methodeTitel: 'So rechnet der Rechner',
    methodeLead: 'Kein Orakel, sondern Regeln: Tag für Tag, Trade für Trade, mit allen Gebühren.',
    methode: [
      [
        'Für jeden Kontotyp spielt der Rechner viele mögliche Handelsjahre durch. Ein Jahr hat rund 260 Handelstage. Wie viele ' +
          'Trades an einem Tag fallen, ist zufällig, im Schnitt so viele wie du pro Woche angibst. Jeder Trade gewinnt mit deiner ' +
          'Trefferquote. Gewinner streuen um deinen Durchschnittsgewinn, Verlierer verlieren deinen Durchschnittsverlust.',
      ],
      [
        'Tag für Tag laufen dabei die Regeln der Firma mit: Drawdown (nachziehend zum Tagesschluss, in Echtzeit oder fest), ' +
          'Tagesverlustgrenze (weich oder hart), Consistency-Regeln, Gewinnziel, Mindesthandelstage, Kontraktgrenzen und ' +
          'Scaling-Plan, Inaktivität, Auszahlungsregeln (Gewinntage, Puffer, Deckel, Split, Mindestbetrag, Abstand) und alle Gebühren.',
      ],
      [
        'Du bekommst zwei Blickwinkel. ',
        { b: 'Ein Kauf:' },
        ' Wie oft bestehst du die Prüfung, wie oft kommt die erste Auszahlung, wie oft ist das Konto weg. ',
        { b: 'Ein Konto-Platz über zwölf Monate:' },
        ' Geht ein Konto verloren, wird neu gekauft oder die Prüfung zurückgesetzt, wo die Firma das anbietet. Daraus entsteht Netto pro Monat.',
      ],
      [
        { b: 'Kante 0:' },
        ' Derselbe Lauf mit denselben Trades, nur ist jedes Ergebnis um deine Erwartung je Trade verschoben. Form und Streuung ' +
          'bleiben gleich, die Erwartung ist null. So siehst du, was Glück und die Regelstruktur allein liefern. Die Rechenregeln ' +
          'stimmen mit einem geprüften Referenz-Simulator überein; automatische Tests vergleichen beide auf festen Trade-Strömen.',
      ],
    ] as Absatz[],
    annahmenTitel: 'Annahmen und Grenzen',
    annahmen: [
      {
        titel: 'Trades und Kosten',
        punkte: [
          'Gewinn und Verlust in R sind netto: Gebühren und Slippage stecken schon drin.',
          'Bei Perp-Konten (Vest, MyFundedPerps) kommen auf Wunsch Spread 0,5 Punkte, Finanzierung 10 % im Jahr und die Kommission der Firma dazu. Kursniveau 20.000 Punkte.',
          'Verlauf im Trade: Verlierer laufen bis zum Stopp und lagen vorher bis 0,5 R im Plus. Gewinner lagen vorher bis 0,6 R im Minus und zwischendurch bis 25 % über dem Endergebnis. Bei Echtzeit-Drawdowns zählt erst der Hochpunkt, dann das Tief (vorsichtig).',
          'Trades laufen nacheinander in der US-Sitzung, immer nur eine Position. Feiertage sind nicht berücksichtigt.',
          'Futures handeln ganze Kontrakte (abgerundet und gedeckelt durch Kontraktgrenze und Scaling-Plan), Perps stufenlos bis zur Hebelgrenze.',
        ],
      },
      {
        titel: 'Prüfung, Auszahlung, Konto-Platz',
        punkte: [
          'Ist das Gewinnziel erreicht, wird an dem Tag nicht weiter gehandelt. Bestanden heißt: Ziel, Consistency und Mindesttage erfüllt. Das Funded-Konto beginnt am nächsten Handelstag.',
          'Die Auszahlung kommt am Ende des ersten erlaubten Tages und ist sofort weg vom Konto. Bearbeitungszeiten und Ablehnungen nach Ermessen der Firma sind nicht eingerechnet.',
          'Droht eine Inaktivitätsregel, setzt der Rechner einen kleinen Trade für 3 USD.',
          'Ein späteres Live-Konto mit echtem Geld rechnet der Rechner nicht mit. Der Konto-Platz endet dort und wird neu gekauft. Steuern sind nicht eingerechnet.',
          'Abo-Preise laufen bis zum Bestehen weiter. Ein Monat hat 30,44 Tage.',
        ],
      },
      {
        titel: 'Was nicht abgebildet ist',
        punkte: [
          'News-Sperren, Handelszeiten, die Höchstzahl an Konten je Person und Tagesgewinn-Deckel einzelner Programme.',
          'Verbote wie Microscalping, Kopierhandel oder „unrealistische Positionsgrößen“. Sie entscheiden, ob eine Strategie bei der Firma überhaupt erlaubt ist, und stehen deshalb je Kontotyp unter „Hinweise“.',
          'Sonderprogramme mit eigener Logik (zum Beispiel Level-Systeme) rechnet der Rechner nicht.',
          'Unklare Regeln rechnet der Rechner in beiden Lesarten. Für die Rangfolge zählt die ungünstigere. Aktionspreise und befristete Aktionen sind nicht eingerechnet.',
        ],
      },
    ],
    quellenTitel: 'Regelstand und Quellen',
    quellenLead: (stand: string) =>
      `Stand der Regeln: ${stand}. Regeln ändern sich. Prüfe vor jedem Kauf die aktuellen Bedingungen direkt bei der Firma. ` +
      'Die Links führen zu den Seiten der Firmen und sind keine Werbe- oder Affiliate-Links.',
    quellenAnzahl: (n: number) => `${n} Quellen`,
    abgerufen: (d: string) => `abgerufen ${d}`,
    rechtlich: [
      'Keine Finanzberatung und keine Anlageberatung. Der Rechner zeigt Simulationen unter Annahmen, keine Prognosen. Simulierte ' +
        'Ergebnisse garantieren keine künftigen Ergebnisse. Prop-Firm-Konten sind überwiegend simulierte Konten, Auszahlungen hängen ' +
        'von den Bedingungen und dem Ermessen der jeweiligen Firma ab.',
      'Die Reihenfolge ist keine Empfehlung einer Firma. Firmennamen sind Marken ihrer Inhaber. Alle Rechnungen laufen in deinem ' +
        'Browser, deine Eingaben werden nicht übertragen.',
    ],
  },

  /** Texte aus der Regel-Datei: Deutsch ist die Sprache der Datei, hier nur durchgereicht. */
  daten: {
    variante: (s: string) => s,
    regelVariante: (_name: string, text: string) => text,
    aktion: (a: { name: string; text: string }) => a.text,
    quelleTitel: (q: Quellenzeile) => q.titel,
    grund: (g: string) => g,
    feld: (pfad: string) => feldText(pfad),
    bot: (code: string) => BOT_TEXT[code] ?? code,
    ko: (code: string) => KO_TEXT[code] ?? code,
    verbot: (code: string) => VERBOT_TEXT[code] ?? code,
  },
}

export type Woerterbuch = typeof de
