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
      `Sag, was du in welcher Zeit ausgezahlt haben willst, oder gib Trefferquote und CRV ein. Der Rechner spielt zufällige ` +
      `Handelsjahre aus diesen Zahlen gegen die Regeln von ${anzahl} Kontotypen durch, mit allen Gebühren. Simulation, keine Kursdaten.`,
  },

  /** Zwei Rechenarten: rückwärts (Standard) und vorwärts. */
  modi: {
    aria: 'Rechenart',
    rueck: 'Was brauche ich?',
    rueckKurz: 'Ziel in USD → nötige Trefferquote je Konto',
    vor: 'Was bringen meine Zahlen?',
    vorKurz: 'Trefferquote und CRV → Ergebnis je Konto',
    eingabe: 'Eingabe',
    ergebnis: 'Ergebnis',
    warum: 'Warum?',
  },

  /** Rückwärts-Modus: Ziel → nötige Trefferquote je Kontotyp und CRV. */
  rueck: {
    ziel: 'Ausgezahlt, netto',
    zielHilfe: 'Alle Auszahlungen nach Split minus alle Gebühren (Käufe, Abos, Resets, Aktivierung).',
    zeitraum: 'Bis wann',
    monate: (m: number) => (m === 1 ? '1 Monat' : `${m} Monaten`),
    monateChip: (m: number) => `${m} Mon.`,
    trades: 'Trades pro Woche',
    sicherheit: 'Wie sicher',
    sicherheitOption: (x: number) => `${x} von 10`,
    sicherheitHilfe: 'In wie vielen von 10 simulierten Fällen das Ziel erreicht sein soll.',
    soGerechnet: 'So ist gerechnet',
    soGerechnetText: (pfade: string) =>
      `Ein Konto-Platz mit Nachkauf nach jedem verlorenen Konto, Auszahlungsweg „Nimm und geh“. Verlierer −1 R, Gewinner +CRV R. ` +
      `MNQ mit 20 Punkten Stopp, Risiko je Trade als Anteil am Drawdown (2,5, 5, 7,5 oder 10 %), es zählt der Anteil, mit dem das ` +
      `Ziel am leichtesten erreicht wird. Je Rasterpunkt ${pfade} simulierte Konto-Plätze, vorab gerechnet. Regeln in der ` +
      'Standard-Lesart, nur aktuell angebotene Kontotypen mit bekanntem Preis.',
    zielGrenze: (min: string, max: string) => `Vorgerechnet sind Ziele von ${min} bis ${max}.`,
    laden: 'Lade Tabelle …',
    ladeFehler: 'Die Tabelle ließ sich nicht laden. Bitte Seite neu laden.',
    zusammenfassung: (name: string, p: string, crv: string, risiko: string) =>
      `Am leichtesten: ${name} braucht ${p} Trefferquote bei CRV ${crv}, mit ${risiko}.`,
    erwartung: (e: string, betrag: string, risiko: string) =>
      `Das sind ${e} je Trade: Auf lange Sicht bringt jeder Trade im Schnitt ${e} deines Risikos, bei ${risiko} Risiko also etwa ${betrag}.`,
    keinKonto: 'Mit diesen Regeln kaum erreichbar: Kein Kontotyp schafft dieses Ziel in dieser Zeit mit höchstens 80 % Trefferquote.',
    sortiert: 'Sortiert nach der leichtesten Anforderung, also der kleinsten nötigen Erwartung je Trade. Karte antippen für Details.',
    crv: (c: string) => `CRV ${c}`,
    kaum: 'kaum erreichbar',
    risikoKurz: (anteil: string, betrag: string) => `${betrag} · ${anteil} DD`,
    risikoSatz: (anteil: string, betrag: string) => `${betrag} Risiko je Trade (${anteil} des Drawdowns)`,
    leichteste: 'am leichtesten',
    erwartungKurz: (e: string) => `Erwartung ${e}`,
    mehr: (n: number) => `Alle ${n} Kontotypen anzeigen`,
    weniger: 'Weniger anzeigen',
    detailsRechnen: 'Rechnet die Details …',
    detailsFuer: (crv: string, p: string, risiko: string) => `Mit CRV ${crv}, ${p} Trefferquote und ${risiko}:`,
    kurzBester: 'am leichtesten',
    erreicht: (anteil: string, ziel: string, zeit: string) => `${anteil} der simulierten Fälle haben nach ${zeit} mindestens ${ziel} netto.`,
    median: (betrag: string, zeit: string) => `Mittlerer Netto-Stand nach ${zeit}: ${betrag}.`,
    vergleich: (betrag: string, zeit: string) =>
      `Zum Vergleich: Ein Trader ohne Vorteil (Erwartung 0) hätte mit diesem Konto nach ${zeit} im Mittel ${betrag} netto. ` +
      'Das zeigt, wie viel vom Ergebnis die Regeln allein ausmachen.',
    regelnZeigen: 'Regeln, Kosten und Quellen',
  },

  /** Woran ein Kauf scheitert bzw. wo er nach 12 Monaten steht (Codes aus simulation.ENDEN). */
  enden: {
    titel: 'Woran es scheitert',
    unter: 'Ein Kauf über 12 Monate, ohne Nachkauf: wie er endet oder wo er steht.',
    pruefung: 'in der Prüfung',
    funded: 'im Funded-Konto',
    name: {
      dd: 'Maximaler Drawdown',
      dll: 'Tagesverlustgrenze',
      zeitlimit: 'Zeitlimit',
      inaktivitaet: 'Inaktivität',
      offen_eval: 'Prüfung nach 12 Monaten offen',
      funded_laeuft: 'Funded-Konto läuft noch',
      weiter: 'Regulär weiter',
    },
    erklaerung: {
      dd: 'Das Konto fiel weiter unter seinen Höchststand (oder Start), als der Drawdown erlaubt. Dann ist es weg.',
      dll: 'An einem Tag mehr verloren als erlaubt. Bei dieser Firma kostet das das Konto.',
      zeitlimit: 'Das Gewinnziel war nicht innerhalb der erlaubten Tage erreicht.',
      inaktivitaet: 'Zu lange nicht gehandelt.',
      offen_eval: 'Weder bestanden noch gesprengt: Gewinnziel, Consistency oder Mindesttage noch nicht erfüllt.',
      funded_laeuft: 'Bestanden und nach 12 Monaten noch aktiv.',
      weiter: 'Ins Live-Konto gewechselt, die Höchstzahl an Auszahlungen erreicht oder bestanden ohne Funded-Teil.',
    },
    consHebt: (a: string) => `Consistency hat bei ${a} der Käufe das Prüfungsziel angehoben: Ein einzelner sehr guter Tag darf nur einen Teil des Gewinns ausmachen.`,
    consSperre: (a: string) => `Consistency hat bei ${a} der Käufe eine Auszahlung aufgeschoben.`,
    hauptgrund: (name: string, anteil: string) => `meist: ${name} (${anteil})`,
    keinScheitern: 'scheitert selten',
  },

  /** Geführter Ablauf (eine Frage je Schritt) und Ergebnis. */
  wz: {
    aria: 'Prop-Firm-Rechner, Schritt für Schritt',
    schritt: (i: number, n: number) => `Schritt ${i} von ${n}`,
    zurueck: 'Zurück',
    weiter: 'Weiter',
    ergebnisZeigen: 'Ergebnis zeigen',
    neu: 'Neu starten',
    aendern: 'Antworten ändern',
    wasHeisst: 'Was heißt das?',
    kenneZahlen: 'Ich kenne meine Zahlen',
    kenneZahlenKurz: 'Trefferquote und CRV eingeben und sehen, was sie bei jedem Konto bringen',
    vomZiel: 'Lieber vom Ziel aus rechnen',
    rechnet: (n: number) => `Rechne ${n} Kontotypen mit deinen Antworten durch …`,
    rechnetZeilen: ['Regeln je Firma', 'Gebühren, Resets und Nachkauf', 'nötige Trefferquote je Konto'],
    fragen: {
      ziel: {
        frage: 'Wie viel willst du ausgezahlt bekommen?',
        unter: 'Netto, also nach allen Gebühren.',
        erklaerung:
          'Gemeint ist die Summe aller Auszahlungen nach dem Split der Firma, minus alles, was du bezahlst: Kauf oder Abo, Resets, ' +
          'Aktivierung. Geht ein Konto verloren, kauft der Rechner ein neues, und das kostet mit.',
      },
      zeit: {
        frage: 'Bis wann?',
        unter: 'Gerechnet ab dem ersten Kauf.',
        erklaerung:
          'Prüfung, Funded-Konto und Auszahlungsregeln brauchen Zeit: Viele Firmen zahlen erst nach mehreren Gewinntagen aus. ' +
          'Kurze Zeiträume verlangen deshalb deutlich mehr.',
      },
      tpw: {
        frage: 'Wie oft handelst du?',
        unter: 'Trades pro Woche, im Schnitt.',
        erklaerung:
          'Mehr Trades bringen dich schneller ans Ziel, aber auch schneller an den Drawdown. Der Rechner verteilt die Trades ' +
          'zufällig auf die Handelstage.',
      },
      crv: {
        frage: 'Mit welchem CRV handelst du?',
        unter: 'Ziel-Abstand geteilt durch Stopp-Abstand.',
        erklaerung:
          'CRV 2 heißt: Dein Ziel liegt doppelt so weit weg wie dein Stopp. Ein Gewinner bringt dann 2 R, ein Verlierer kostet 1 R, ' +
          'also dein Risiko. Je höher das CRV, desto seltener musst du richtig liegen.',
      },
      sicher: {
        frage: 'Wie sicher soll es sein?',
        unter: 'In wie vielen von 10 simulierten Fällen das Ziel erreicht sein soll.',
        erklaerung:
          '5 von 10 heißt: In der Hälfte der simulierten Fälle klappt es, in der anderen Hälfte nicht. 9 von 10 ist deutlich ' +
          'vorsichtiger und verlangt eine höhere Trefferquote.',
      },
      treffer: {
        frage: 'Wie oft liegst du richtig?',
        unter: 'Deine Trefferquote in Prozent.',
        erklaerung: 'Der Anteil deiner Trades, die im Gewinn enden. Am besten aus vielen echten Trades, nicht aus einer Handvoll.',
      },
      risiko: {
        frage: 'Wie viel riskierst du pro Trade?',
        unter: 'In USD. Das ist 1 R.',
        erklaerung:
          'Der Betrag, den du verlierst, wenn der Stopp greift. Bei Futures rechnet der Rechner daraus ganze Kontrakte (MNQ mit ' +
          '20 Punkten Stopp, im Ergebnis änderbar).',
      },
    },
    sicherHinweis: { '5': 'jeder zweite Fall', '7': 'vorsichtig', '9': 'sehr vorsichtig' } as Record<string, string>,
    proWoche: 'pro Woche',
    crvSkizze: { stopp: 'Stopp', ziel: 'Ziel', einstieg: 'Einstieg' },
    crvAnders: 'anderer Wert',
    ergebnisKicker: 'Dein bestes Konto für diese Antworten',
    braucht: 'braucht',
    trefferquote: 'Trefferquote',
    beiCrv: (c: string) => `bei CRV ${c}`,
    antworten: (ziel: string, zeit: string, tpw: string, sicher: number) =>
      `${ziel} netto in ${zeit} · ${tpw} Trades pro Woche · ${sicher} von 10 Fällen`,
    weitere: 'Weitere Konten',
    weitereUnter: 'Sortiert nach der nötigen Trefferquote bei deinem CRV. Antippen für Details.',
    andereCrv: 'Bei anderem CRV',
    keinKonto: (crv: string) =>
      `Mit CRV ${crv} kaum erreichbar: Kein Kontotyp schafft dieses Ziel in dieser Zeit mit höchstens 80 % Trefferquote. ` +
      'Probier ein höheres CRV, mehr Zeit oder ein kleineres Ziel.',
    vorKicker: 'Was deine Zahlen bringen',
    annahmen: 'Annahmen anpassen',
  },

  /** Bildschirm-App: Kopfleiste, Blätter, Rechtliches, Fertig-Schirm und Ergebnis in Klartext. */
  app: {
    titel: 'Prop-Firm-Rechner',
    start: 'Price Action Trader, zur Startseite',
    soRechnet: 'So rechnet der Rechner',
    impressum: 'Impressum',
    datenschutz: 'Datenschutz',
    keineBeratung: 'Keine Finanzberatung',
    schliessen: 'Schließen',
    rechtliches: 'Rechtliches und Kontakt',
    punkte: 'Fortschritt',
    punkt: (i: number, n: number) => `Schritt ${i} von ${n}`,
    groesse: {
      frage: 'Wie groß darf das Konto sein?',
      unter: 'Optional. Größere Konten verzeihen mehr, kosten aber mehr.',
      erklaerung:
        'Gemeint ist die Kontogröße bei der Firma, zum Beispiel 50K. Größere Konten haben mehr Drawdown und erlauben mehr ' +
        'Risiko je Trade, kosten aber mehr. „Alle“ rechnet mit jeder Größe.',
    },
    groessen: { alle: 'Alle', k50: 'bis 50K', k100: 'bis 100K', k150: 'bis 150K' } as Record<string, string>,
    fertigTitel: 'Dein Ergebnis ist fertig.',
    fertigUnter: 'Bevor du es ansiehst: drei Wege, wie es weitergehen kann. Das Ergebnis ist schon freigeschaltet.',
    ergebnisAnsehen: 'Ergebnis ansehen',
    rechnetVor: (n: string) => `Rechne ${n} simulierte Jahre je Kontotyp …`,
    // Rückwärts in Klartext
    intro: (zeit: string, ziel: string, s: number) => `Du willst in ${zeit} ${ziel} ausgezahlt bekommen, in ${s} von 10 Fällen.`,
    muss: 'Dann muss deine Strategie das leisten:',
    trefferMin: 'Trefferquote mindestens',
    beiCrv: (c: string) => `bei CRV ${c}`,
    tradesProWoche: 'Trades pro Woche',
    risikoJeTrade: 'Risiko je Trade',
    risikoAnteil: (a: string) => `${a} des Drawdowns`,
    erwartung: (e: string) => `Das sind mindestens ${e} pro Trade nach Kosten.`,
    leichtesten: 'Am leichtesten schaffst du das bei',
    ddArt: {
      eod_trailing: 'nur am Tagesende nachgezogen',
      intraday_trailing: 'in Echtzeit nachgezogen',
      statisch: 'fest, ohne Nachziehen',
      keiner: 'ohne Drawdown-Grenze',
    } as Record<string, string>,
    warum: (dd: string, art: string, preis: string) => `Warum dort: ${dd} Drawdown, ${art}, bei ${preis}.`,
    preisEinmalig: (b: string) => `${b} einmalig`,
    preisMonatlich: (b: string) => `${b} pro Monat bis zum Bestehen`,
    darunter: (punkte: number, p: string, x: number) =>
      x === 0
        ? `Liegt deine Trefferquote ${punkte} Punkte darunter (${p}), schaffst du dieses Ziel bei diesem Konto in keinem von 10 Fällen.`
        : `Liegt deine Trefferquote ${punkte} Punkte darunter (${p}), schaffst du dieses Ziel bei diesem Konto nur noch in ${x} von 10 Fällen.`,
    scheitert: (name: string, anteil: string) => `Woran es meist scheitert: ${name} (${anteil} der Käufe).`,
    keinScheitern: 'Gescheitert sind in der Simulation nur wenige Käufe.',
    andereKonten: 'Andere Konten ansehen',
    andereTitel: 'Andere Konten',
    neuRechnen: 'Neu rechnen',
    keinKonto: (crv: string) =>
      `Mit CRV ${crv} ist dieses Ziel in dieser Zeit bei keinem passenden Konto mit höchstens 80 % Trefferquote erreichbar. ` +
      'Probier ein höheres CRV, mehr Zeit, ein größeres Konto oder ein kleineres Ziel.',
    // Vorwärts in Klartext
    vorIntro: (p: string, crv: string, risiko: string, tpw: string) =>
      `Mit ${p} Trefferquote bei CRV ${crv}, ${risiko} Risiko je Trade und ${tpw} Trades pro Woche bringt dir am meisten:`,
    proMonat: 'pro Monat netto',
    bei: 'bei',
    nachGebuehren: 'Nach allen Gebühren, im Schnitt über 12 Monate mit Nachkauf nach jedem verlorenen Konto.',
    imPlus: (x: number) => `In ${x} von 10 simulierten Jahren liegst du dort im Plus.`,
    vorErwartung: (e: string) => `Deine Zahlen ergeben ${e} pro Trade nach Kosten.`,
    vorMinus: 'Kein Konto liegt mit diesen Zahlen im Plus. Am wenigsten verlierst du:',
    annahmen: 'Annahmen anpassen',
    vomZiel: 'Vom Ziel aus rechnen',
  },

  /** CTA-Karte am Ende: genau drei Wege weiter. */
  cta: {
    titel: 'Wie es weitergeht',
    folgen: { titel: 'Folge mir auf X und YouTube', text: 'Was ich gerade teste, was trägt und was nicht.', x: 'X', yt: 'YouTube' },
    lab: {
      titel: 'Werde Mitglied im AI Lab',
      text: 'Mein Forschungs-Newsletter auf Substack, englischsprachig: KI-Agenten testen Strategien auf Daten, die sie nie gesehen haben.',
    },
    etoro: {
      titel: 'Erster Monat Mentorship gratis, gesponsert von eToro',
      zusatz: '',
      bedingung: (min: string) =>
        `So geht’s: eToro-Konto über meinen Partnerlink eröffnen und ${min} einzahlen, dann bekommst du deinen Code für den ` +
        'ersten Monat. Traden musst du nicht.',
      knopf: 'Konto bei eToro eröffnen',
      wie: 'Alle Schritte',
      anzeige: 'Anzeige',
      risikoTitel: 'Risikohinweis:',
    },
  },

  eingaben: {
    titel: 'Deine Eingaben',
    trades: 'Deine Trades',
    trefferquote: 'Trefferquote',
    crv: 'CRV',
    crvHilfe: 'Chance-Risiko-Verhältnis: Ein Gewinner bringt das CRV-Fache deines Risikos, ein Verlierer kostet dein Risiko (−1 R).',
    rHinweis: 'Gewinne und Verluste netto, also nach Gebühren und Slippage.',
    tradesProWoche: 'Trades pro Woche',
    mehrEinstellungen: 'Mehr Einstellungen',
    gewinner: 'Gewinner',
    streuung: { gleich: 'immer +CRV', gemischt: 'gemischt', wenige_grosse: 'wenige große' },
    streuungHilfe: 'Gleicher Durchschnitt, andere Verteilung: „wenige große“ heißt viele kleine Gewinner und ab und zu ein Ausreißer.',
    verlustStreuung: 'Verluste schwanken (kein fester Stopp)',
    verlustStreuungHilfe: 'Verlierer kosten im Schnitt dein Risiko, manchmal weniger, gelegentlich deutlich mehr (etwa jeder 10. über 1,8 R). Wichtig bei Tagesverlustgrenzen.',
    groesse: 'Positionsgröße',
    risiko: 'Risiko pro Trade',
    instrument: 'Instrument',
    stopp: 'Stopp',
    punkte: 'Punkte',
    stoppSatz:
      'Die Stopp-Größe ändert das Ergebnis nur über die Zahl der Kontrakte (ganze Kontrakte, Kontraktgrenzen der Firma) und die Kosten bei Perps. Gewinn und Verlust in R bleiben gleich.',
    futuresHinweis: (k: number, instrument: string, echt: string, perp: string) =>
      `Futures: ${k} ${instrument} je Trade (${echt} echtes Risiko, ganze Kontrakte, gedeckelt durch die Firmengrenzen). Perps: ${perp}.`,
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
    pfade: { '500': 'schnell', '1500': 'genau', '3000': 'sehr genau' },
    pfadeHilfe: (n: string) => `${n} simulierte Jahre je Kontotyp.`,
    erwartung: 'Erwartung je Trade',
    streuungJeTrade: 'Streuung je Trade',
    belegTitel: 'Beleg für eine Kante',
    beleg: (n: string) => `rund ${n} Trades`,
    belegText: 'brauchst du, um diese Kante sicher von null zu unterscheiden.',
    keineKante: 'Ohne positive Erwartung gibt es keine Kante. Ein Plus käme dann nicht aus deinen Trades.',
    keineKanteWert: 'keine Kante',
    bittePruefen: 'Bitte prüfen:',
    fehler: {
      trefferquote: 'Trefferquote zwischen 1 und 99 %',
      crv: 'CRV größer 0 und höchstens 20',
      trades: 'Trades pro Woche zwischen 0,2 und 60',
      stopp: 'Stopp zwischen 1 und 500 Punkten',
      risiko: 'Risiko pro Trade zwischen 1 und 100.000 USD',
    },
    berechnen: 'Neu rechnen',
    fortschritt: (a: string, b: string) => `Rechne ${a} von ${b} simulierten Jahren …`,
    fertig: (pfade: string, varianten: number, sekunden: string) =>
      `${pfade} Jahre × ${varianten} Regelvarianten in ${sekunden} s, direkt in deinem Browser.`,
    fehlerPrefix: 'Fehler:',
    workerAbbruch: 'Die Rechnung im Hintergrund ist abgebrochen.',
  },

  ergebnis: {
    groessen: { k10: 'bis 10K', k25: '20K bis 25K', k50: '50K', k100: '100K', k150: 'ab 150K' },
    unter: (pfade: string, weg: string, faktor: number | null, bot: boolean) =>
      `${pfade} simulierte Jahre je Kontotyp, Auszahlungsweg „${weg}“${faktor ? ` mit ${faktor}x Drawdown Polster` : ''}` +
      `${bot ? ', Handel per Bot' : ''}. Netto pro Monat heißt: alle Auszahlungen nach Split minus alle Gebühren (Kauf, Abo, ` +
      'Reset, Aktivierung, Fixkosten) über zwölf Monate, mit Nachkauf nach jedem verlorenen Konto.',
    proMonatKurz: '/ Monat',
    zusammenfassung: (name: string, netto: string) => `Bester Kontotyp: ${name} mit ${netto} pro Monat netto.`,
    zusammenfassungMinus: (name: string, netto: string) =>
      `Kein Kontotyp liegt im Plus. Am wenigsten verlierst du bei ${name} (${netto} pro Monat netto).`,
    erwartungSatz: (e: string) => `Deine Zahlen ergeben ${e} je Trade.`,
    rechnet: 'Rechnet …',
    sicherTitel: 'Wie sicher ist deine Kante?',
    sicherText: (erw: string, sd: string) => `Deine Eingaben ergeben ${erw} je Trade bei einer Streuung von ${sd}.`,
    sicherBand: (lo: string, hi: string, n: string) =>
      ` Aus 100 Trades geschätzt, kann die echte Erwartung irgendwo zwischen ${lo} und ${hi} liegen. Erst ab rund ${n} Trades ist ` +
      'sie mit 95 % Sicherheit größer als null.',
    sicherOhne: ' Ohne positive Erwartung kommt kein Plus aus deinen Trades. Über viele Konten gehen dann die Gebühren verloren.',
    schaetzung:
      'Deine Trefferquote und dein CRV sind selbst Schätzungen. Stammen sie aus wenigen Trades oder aus einem Backtest, der ' +
      'nach dem Ergebnis ausgesucht wurde, stammt ein Teil davon aus der Auswahl und nicht aus einer echten Kante. Der Rechner kann nur so ' +
      'gut sein wie diese Zahlen.',
    topTitel: 'Die drei besten Kontotypen',
    topUnter:
      'Sortiert nach Netto pro Monat in der vorsichtigeren Lesart, wenn eine Regel der Firma nicht eindeutig ist. Der beste Wert ' +
      'aus vielen Kontotypen ist immer etwas zu gut geschätzt: Auch die Simulation streut (± Angabe).',
    platz: (i: number) => `Platz ${i}`,
    proMonatPlusMinus: (x: string) => `pro Monat, ± ${x} USD`,
    bestehen60: 'Bestehen in 60 Handelstagen',
    ohnePruefung: 'ohne Prüfung',
    ausz6: 'Erste Auszahlung in 6 Monaten',
    gesprengt12: 'Gesprengt in 12 Monaten',
    gerechnetMit: (v: string) => `Gerechnet mit: ${v}.`,
    alleTitel: 'Alle Kontotypen',
    angezeigt: (a: number, b: number, bot: number) =>
      `${a} von ${b} Kontotypen in der Auswahl${bot ? `, ${bot} ausgeblendet (Firma erlaubt keine Bots)` : ''}. Zeile antippen für Gründe, Regeln, Kosten und Quellen.`,
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
    vergleich: (betrag: string) =>
      `Zum Vergleich: Ein Trader ohne Vorteil (Erwartung 0) käme mit diesem Konto auf ${betrag} pro Monat netto. Das zeigt, wie viel vom Ergebnis die Regeln allein ausmachen.`,
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
        'Für jeden Kontotyp erzeugt der Rechner 1.000 zufällige Handelsjahre aus deinen Eingaben, keine echten Kursdaten. Ein Jahr ' +
          'hat rund 260 Handelstage. Wie viele ' +
          'Trades an einem Tag fallen, ist zufällig, im Schnitt so viele wie du pro Woche angibst. Jeder Trade gewinnt mit deiner ' +
          'Trefferquote. Ein Gewinner bringt dein CRV in R, ein Verlierer kostet 1 R, also dein Risiko. Unter „Annahmen anpassen“ ' +
          'lassen sich Gewinner und Verluste streuen.',
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
          'bleiben gleich, die Erwartung ist null. So siehst du, was die Regeln und die Streuung allein liefern, ganz ohne Kante. Die Rechenregeln ' +
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
