// Zweisprachiger Content für die PAT-Raid-Map-Seiten (EN + DE).
// Zahlen-Governance: Jede Statistik stammt aus dem Claims-Inventar
// (trading-bot-workspace/docs/PAT_RAIDMAP_CLAIMS_INVENTORY_20260706.md).
// Keine neuen Zahlen hier erfinden — erst dort belegen, dann verwenden.

import { RAIDMAP_CONFIG, type RaidMapLang } from './raidmap-config'

type L<T> = Record<RaidMapLang, T>

export type FeatureCard = {
  title: string
  stat: string
  statNote: string
  body: string
}

export type FaqItem = { q: string; a: string }

const c = RAIDMAP_CONFIG

export const raidmapMeta: L<{ title: string; description: string }> = {
  en: {
    title: 'PAT Raid Map [BETA] — Session Bias & Run Timing for NQ, backed by 10 years of data',
    description:
      'A TradingView indicator that maps which liquidity level gets raided first, when the run typically starts, and what happens after the purge — every number tested against random placebos on 10 years of NQ 1-minute data.',
  },
  de: {
    title: 'PAT Raid Map [BETA] — Session-Bias & Run-Timing für NQ, belegt mit 10 Jahren Daten',
    description:
      'Ein TradingView-Indikator, der zeigt, welches Liquiditäts-Level zuerst geraidet wird, wann der Run typischerweise startet und was nach dem Purge passiert — jede Zahl gegen Zufalls-Placebos auf 10 Jahren NQ-1-Minuten-Daten getestet.',
  },
}

export const raidmapHero: L<{
  badge: string
  title: string
  subtitle: string
  bullets: string[]
  ctaPrimary: string
  ctaSecondary: string
  finePrint: string
}> = {
  en: {
    badge: 'TradingView indicator · NQ · invite-only · [BETA]',
    title: 'Stop guessing the bias. Read the session like a map.',
    subtitle:
      'The PAT Raid Map shows the three things that actually decide your session: which level gets raided first, when the run typically starts, and what happens after the purge. Every number on your chart survived a placebo test on 10 years of NQ data — or it was deleted.',
    bullets: [
      'First-target map: the most likely first stop of the session, ranked by 10 years of level races',
      'Run-timing windows: the validated minutes when the move actually tends to happen',
      'Purge-then-run detection: know when the counter-side raid is fuel, not failure',
    ],
    ctaPrimary: 'Get access',
    ctaSecondary: 'Read the documentation',
    finePrint:
      'Historical statistics (NQ futures, 2016–2025, in-sample). Not financial advice. No performance guarantee. Not an entry signal — a context layer.',
  },
  de: {
    badge: 'TradingView-Indikator · NQ · invite-only · [BETA]',
    title: 'Hör auf, den Bias zu raten. Lies die Session wie eine Karte.',
    subtitle:
      'Die PAT Raid Map zeigt dir die drei Dinge, die deine Session wirklich entscheiden: welches Level zuerst geraidet wird, wann der Run typischerweise startet und was nach dem Purge passiert. Jede Zahl auf deinem Chart hat einen Placebo-Test auf 10 Jahren NQ-Daten überlebt — oder sie wurde gelöscht.',
    bullets: [
      'First-Target-Karte: der wahrscheinlichste erste Stopp der Session, gerankt aus 10 Jahren Level-Rennen',
      'Run-Timing-Fenster: die validierten Minuten, in denen die Bewegung typischerweise passiert',
      'Purge-then-Run-Erkennung: erkenne, wann der Gegenseiten-Raid Treibstoff ist — nicht Versagen',
    ],
    ctaPrimary: 'Zugang sichern',
    ctaSecondary: 'Dokumentation lesen',
    finePrint:
      'Historische Statistiken (NQ-Futures, 2016–2025, in-sample). Keine Anlageberatung. Kein Performance-Versprechen. Kein Entry-Signal — ein Kontext-Layer.',
  },
}

export const raidmapProof: L<{ items: { value: string; label: string }[] }> = {
  en: {
    items: [
      { value: `${c.yearsOfData} years`, label: 'of NQ 1-minute data' },
      { value: c.trainingDays.toLocaleString('en-US'), label: 'trading days analyzed' },
      { value: c.sessionEvents.toLocaleString('en-US'), label: 'session events measured' },
      { value: `${c.validatedRules}+`, label: 'placebo-tested rules' },
    ],
  },
  de: {
    items: [
      { value: `${c.yearsOfData} Jahre`, label: 'NQ-1-Minuten-Daten' },
      { value: c.trainingDays.toLocaleString('de-DE'), label: 'analysierte Handelstage' },
      { value: c.sessionEvents.toLocaleString('de-DE'), label: 'gemessene Session-Events' },
      { value: `${c.validatedRules}+`, label: 'placebo-getestete Regeln' },
    ],
  },
}

export const raidmapStory: L<{
  title: string
  subtitle: string
  steps: { n: string; title: string; body: string }[]
}> = {
  en: {
    title: 'Why this exists',
    subtitle: 'Three findings from ten years of data — explained so simply your younger self would get it.',
    steps: [
      {
        n: '01',
        title: 'Daily direction can’t be predicted. Session structure can.',
        body:
          'We tested every popular “daily bias” predictor — previous day, gap, overnight position, Asia, London — against 10 years of data. All of them landed at 48–53% against a 55.9% base rate. Dead. But when we asked smaller, sharper questions — which level gets hit first, and when — the data started answering with real, repeatable numbers.',
      },
      {
        n: '02',
        title: 'Every number beat a placebo — in two market eras separately.',
        body:
          'A stat is easy to fake: almost any level “works” if you look at it kindly. So every rule had to beat 200 random look-alikes (random levels at the same distance, random time windows of the same width) — and it had to hold in 2016–2021 AND 2021–2026 separately. What failed was thrown out, and we tell you what failed.',
      },
      {
        n: '03',
        title: 'We deleted our most tempting feature.',
        body:
          'Equal lows sitting right under price look like perfect magnets. The data says: they got raided LESS often than a random level at the same distance — in all six sessions. So the Raid Map doesn’t draw them. Tools that paint every “liquidity pool” are showing you noise. We show you what survived.',
      },
    ],
  },
  de: {
    title: 'Warum es das gibt',
    subtitle: 'Drei Befunde aus zehn Jahren Daten — so einfach erklärt, dass es dein jüngeres Ich verstehen würde.',
    steps: [
      {
        n: '01',
        title: 'Tagesrichtung kann man nicht vorhersagen. Session-Struktur schon.',
        body:
          'Wir haben jeden beliebten „Daily-Bias“-Prädiktor getestet — Vortag, Gap, Overnight-Lage, Asia, London — gegen 10 Jahre Daten. Alle landeten bei 48–53% gegen eine Basisrate von 55,9%. Tot. Aber als wir kleinere, schärfere Fragen stellten — welches Level fällt zuerst, und wann — begannen die Daten mit echten, wiederholbaren Zahlen zu antworten.',
      },
      {
        n: '02',
        title: 'Jede Zahl schlug ein Placebo — in zwei Marktepochen getrennt.',
        body:
          'Eine Statistik ist leicht gefälscht: Fast jedes Level „funktioniert“, wenn man wohlwollend hinschaut. Deshalb musste jede Regel 200 zufällige Doppelgänger schlagen (Zufalls-Level in gleicher Entfernung, Zufalls-Zeitfenster gleicher Breite) — und sie musste in 2016–2021 UND 2021–2026 einzeln halten. Was durchfiel, flog raus — und wir sagen dir, was durchfiel.',
      },
      {
        n: '03',
        title: 'Wir haben unser verlockendstes Feature gelöscht.',
        body:
          'Equal Lows direkt unter dem Preis sehen aus wie perfekte Magneten. Die Daten sagen: Sie wurden SELTENER geholt als ein Zufallsniveau gleicher Entfernung — in allen sechs Sessions. Also zeichnet die Raid Map sie nicht. Tools, die jeden „Liquidity Pool“ anmalen, zeigen dir Rauschen. Wir zeigen dir, was überlebt hat.',
      },
    ],
  },
}

export const raidmapFeatures: L<{
  title: string
  subtitle: string
  cards: FeatureCard[]
  sourceNote: string
}> = {
  en: {
    title: 'What you see on the chart',
    subtitle: 'Five layers. Each one carries its own validated number and a plain-English confidence tag.',
    sourceNote: 'All statistics: NQ futures, 1-minute data, 2016–2025, in-sample, vs. fair random-placebo benchmarks.',
    cards: [
      {
        title: 'First-Target Map (DoL compass)',
        stat: '54.1% vs 25.7%',
        statNote: 'London High as first premarket target vs. a random level at the same distance',
        body:
          'At every session open the Raid Map ranks the standing liquidity levels by one question: which one got hit FIRST, historically? Sessions cascade — each one prefers the extremes of the session before it. The top candidate becomes your Draw on Liquidity line, with a HIGH / MID / LOW confidence tag.',
      },
      {
        title: 'Run-Timing Windows',
        stat: '50.4% vs 43.5%',
        statNote: 'NY AM: share of open targets hit in the first 20 minutes vs. any random 20-min window',
        body:
          'If the run comes, it usually comes early: the conditional hit-rate in NY AM steps down 43.6% → 18.9% → 10.5% after the open. The validated windows are drawn on your chart as time zones — including London’s second window at 03:00–03:20 ET. “Waiting longer” is a scenario the data rarely rewards in NY AM (2.5% of days).',
      },
      {
        title: 'Purge-then-Run Detection',
        stat: '19.7% vs 10.0%',
        statNote: 'NY AM: odds of the target falling within 10 minutes after an opening purge — about 2× random',
        body:
          'Before the run, the other side often gets swept. The Raid Map marks the purge candidate, tells you the purge risk for your session, and flips to “PURGE DONE — ignition” the moment it happens. In NY AM the median purge comes at minute 6 with a median dip of 0.14 ADR — then the map expects the run.',
      },
      {
        title: 'Validated Micro Pools',
        stat: '6 / 6 sessions',
        statNote: 'Equal-high/low pools in the validated distance band beat their placebo in every session',
        body:
          'Small relative equal highs/lows are the classic ignition targets. The Raid Map only draws the ones in the statistically validated distance band (raided-first 38.5–46.3% vs. 35.9–41.9% random) — and when one gets raided, it shows the ignition odds for your session.',
      },
      {
        title: 'Terminus Bands',
        stat: '2–3×',
        statNote: 'NY AM median extension after the break vs. every other session',
        body:
          'Once the target breaks, how far does it usually run? The map projects safe / typical / stretch bands from the break — scaled live by current volatility (ADR), because fixed point targets age badly. NY AM is the outlier session where breaks travel furthest.',
      },
      {
        title: 'The Honesty Engine',
        stat: '59–90%',
        statNote: 'no-hit rate when the target sits far away — the map downgrades itself',
        body:
          'When your target sits far away, the map tells you it historically did NOT get hit on most of those days and drops its own confidence to LOW. Where no validated rule exists, it says “no signal” instead of inventing a number. The NY-AM level-identity caveat is printed right on the panel.',
      },
    ],
  },
  de: {
    title: 'Was du auf dem Chart siehst',
    subtitle: 'Fünf Ebenen. Jede trägt ihre eigene validierte Zahl und ein Klartext-Confidence-Tag.',
    sourceNote: 'Alle Statistiken: NQ-Futures, 1-Minuten-Daten, 2016–2025, in-sample, gegen faire Zufalls-Placebo-Benchmarks.',
    cards: [
      {
        title: 'First-Target-Karte (DoL-Kompass)',
        stat: '54,1% vs 25,7%',
        statNote: 'London-High als erstes Premarket-Ziel vs. ein Zufalls-Level in gleicher Entfernung',
        body:
          'Zu jedem Session-Open rankt die Raid Map die stehenden Liquiditäts-Level nach einer Frage: Welches wurde historisch ZUERST getroffen? Sessions kaskadieren — jede bevorzugt die Extreme der Session davor. Der Top-Kandidat wird deine Draw-on-Liquidity-Linie, mit HIGH / MID / LOW Confidence-Tag.',
      },
      {
        title: 'Run-Timing-Fenster',
        stat: '50,4% vs 43,5%',
        statNote: 'NY AM: Anteil offener Ziele, die in den ersten 20 Minuten fielen, vs. ein beliebiges 20-Minuten-Fenster',
        body:
          'Wenn der Run kommt, kommt er meist früh: Die bedingte Trefferrate in NY AM fällt nach dem Open 43,6% → 18,9% → 10,5%. Die validierten Fenster liegen als Zeitzonen auf deinem Chart — inklusive Londons zweitem Fenster 03:00–03:20 ET. „Später warten“ belohnt NY AM fast nie (2,5% der Tage).',
      },
      {
        title: 'Purge-then-Run-Erkennung',
        stat: '19,7% vs 10,0%',
        statNote: 'NY AM: Chance, dass das Ziel binnen 10 Minuten nach dem Eröffnungs-Purge fällt — etwa 2× Zufall',
        body:
          'Vor dem Run wird oft erst die andere Seite abgeholt. Die Raid Map markiert den Purge-Kandidaten, nennt dir das Purge-Risiko deiner Session und schaltet in dem Moment auf „PURGE DONE — ignition“ um. In NY AM kommt der Median-Purge bei Minute 6 mit einem Median-Dip von 0,14 ADR — danach erwartet die Karte den Run.',
      },
      {
        title: 'Validierte Mikro-Pools',
        stat: '6 / 6 Sessions',
        statNote: 'Equal-High/Low-Pools im validierten Distanzband schlagen ihr Placebo in jeder Session',
        body:
          'Kleine relative Equal Highs/Lows sind die klassischen Zünd-Ziele. Die Raid Map zeichnet nur die im statistisch validierten Distanzband (zuerst geraidet 38,5–46,3% vs. 35,9–41,9% Zufall) — und wenn einer geraidet wird, zeigt sie dir die Zünd-Wahrscheinlichkeit deiner Session.',
      },
      {
        title: 'Terminus-Bänder',
        stat: '2–3×',
        statNote: 'NY-AM-Median-Extension nach dem Bruch vs. jede andere Session',
        body:
          'Wenn das Ziel bricht — wie weit läuft es dann typisch? Die Karte projiziert safe / typical / stretch-Bänder ab dem Bruch, live skaliert mit der aktuellen Volatilität (ADR), denn feste Punktziele altern schlecht. NY AM ist die Ausreißer-Session, in der Brüche am weitesten tragen.',
      },
      {
        title: 'Die Ehrlichkeits-Engine',
        stat: '59–90%',
        statNote: 'No-Hit-Rate bei weit entferntem Ziel — die Karte stuft sich selbst herab',
        body:
          'Steht dein Ziel weit weg, sagt dir die Karte, dass es an den meisten dieser Tage historisch NICHT erreicht wurde — und setzt ihre eigene Confidence auf LOW. Wo keine validierte Regel existiert, steht „no signal“ statt einer erfundenen Zahl. Der NY-AM-Level-Identitäts-Caveat steht direkt im Panel.',
      },
    ],
  },
}

export const raidmapPricing: L<{
  title: string
  subtitle: string
  monthly: { name: string; period: string; note: string; cta: string }
  annual: { name: string; period: string; note: string; badge: string; cta: string }
  included: string[]
  loginNote: string
  legalNote: string
}> = {
  en: {
    title: 'Pricing',
    subtitle: 'One indicator. Two ways to pay. Cancel anytime.',
    monthly: {
      name: 'Monthly',
      period: '/month',
      note: 'Billed monthly · cancel anytime',
      cta: 'Start monthly',
    },
    annual: {
      name: 'Annual',
      period: `/month · billed ${c.annualTotalFormatted}/year`,
      note: 'Billed yearly · cancel anytime',
      badge: `Save ${c.annualSavingsPct}%`,
      cta: 'Start annual',
    },
    included: [
      'PAT Raid Map [BETA] on TradingView (invite-only access)',
      'All five layers: first-target map, timing windows, purge detection, micro pools, terminus bands',
      'Plain-English confidence tags with the full statistics one hover away',
      'Weekly live streams reading the map on real sessions',
      'All future rule updates while subscribed',
    ],
    loginNote: 'You’ll create an account at checkout — access is granted to your TradingView username.',
    legalNote:
      'Historical statistics, in-sample (NQ futures, 2016–2025). Not financial advice. No performance guarantee. The indicator provides context, not entry signals.',
  },
  de: {
    title: 'Preise',
    subtitle: 'Ein Indikator. Zwei Zahlweisen. Jederzeit kündbar.',
    monthly: {
      name: 'Monatlich',
      period: '/Monat',
      note: 'Monatliche Abrechnung · jederzeit kündbar',
      cta: 'Monatlich starten',
    },
    annual: {
      name: 'Jährlich',
      period: `/Monat · ${c.annualTotalFormatted}/Jahr`,
      note: 'Jährliche Abrechnung · jederzeit kündbar',
      badge: `${c.annualSavingsPct}% sparen`,
      cta: 'Jährlich starten',
    },
    included: [
      'PAT Raid Map [BETA] auf TradingView (Invite-only-Zugang)',
      'Alle fünf Ebenen: First-Target-Karte, Timing-Fenster, Purge-Erkennung, Mikro-Pools, Terminus-Bänder',
      'Klartext-Confidence-Tags — die volle Statistik einen Hover entfernt',
      'Wöchentliche Livestreams, in denen wir die Karte an echten Sessions lesen',
      'Alle künftigen Regel-Updates, solange du dabei bist',
    ],
    loginNote: 'Beim Checkout erstellst du einen Account — der Zugang wird deinem TradingView-Usernamen freigeschaltet.',
    legalNote:
      'Historische Statistiken, in-sample (NQ-Futures, 2016–2025). Keine Anlageberatung. Kein Performance-Versprechen. Der Indikator liefert Kontext, keine Entry-Signale.',
  },
}

export const raidmapFaq: L<{ title: string; items: FaqItem[] }> = {
  en: {
    title: 'Honest questions, honest answers',
    items: [
      {
        q: 'Is this an entry signal?',
        a: 'No. The Raid Map is a context layer: it tells you the most likely first target, the validated timing windows, and the scenario you are in. Entries, stops and risk are your job. Anyone selling you “validated entries” from bar data should worry you.',
      },
      {
        q: 'Why [BETA]? What does that mean?',
        a: 'All statistics are in-sample (2016–2025). We deliberately reserved a final untouched out-of-sample period — it gets tested exactly once, and the BETA tag only comes off if the numbers hold. That is how seriously we take overfitting.',
      },
      {
        q: 'Which markets does it work on?',
        a: 'It was built and validated on NQ futures only. It will draw on other symbols, but none of the numbers were validated there — so we don’t claim they hold. NQ is the honest answer.',
      },
      {
        q: 'How strong are these edges really?',
        a: 'Modest and real: most premiums are single-digit percentage points above a fair random benchmark; the best cells reach roughly double the random odds. It is a probability compass, not a money printer. And 27–51% of days the session target simply never gets hit — the map tells you that too.',
      },
      {
        q: 'How do I get access after paying?',
        a: 'The indicator is invite-only on TradingView. After checkout you enter your TradingView username and access is granted to it. A free TradingView account is enough.',
      },
      {
        q: 'Can I cancel?',
        a: 'Yes, anytime — monthly at the end of the month, annual at the end of the year. Access ends with the subscription.',
      },
    ],
  },
  de: {
    title: 'Ehrliche Fragen, ehrliche Antworten',
    items: [
      {
        q: 'Ist das ein Entry-Signal?',
        a: 'Nein. Die Raid Map ist ein Kontext-Layer: Sie zeigt dir das wahrscheinlichste erste Ziel, die validierten Zeitfenster und das Szenario, in dem du bist. Entries, Stops und Risiko sind dein Job. Wer dir „validierte Entries“ aus Bar-Daten verkauft, sollte dich stutzig machen.',
      },
      {
        q: 'Warum [BETA]? Was heißt das?',
        a: 'Alle Statistiken sind in-sample (2016–2025). Wir haben bewusst einen finalen, unangetasteten Out-of-Sample-Zeitraum reserviert — der wird genau einmal getestet, und das BETA-Tag fällt nur, wenn die Zahlen halten. So ernst nehmen wir Overfitting.',
      },
      {
        q: 'Für welche Märkte funktioniert das?',
        a: 'Gebaut und validiert wurde ausschließlich auf NQ-Futures. Der Indikator zeichnet auch auf anderen Symbolen, aber dort wurde keine einzige Zahl validiert — also behaupten wir es auch nicht. NQ ist die ehrliche Antwort.',
      },
      {
        q: 'Wie stark sind diese Edges wirklich?',
        a: 'Moderat und echt: Die meisten Prämien liegen im einstelligen Prozentpunkt-Bereich über einem fairen Zufalls-Benchmark; die besten Zellen erreichen etwa die doppelte Zufalls-Chance. Es ist ein Wahrscheinlichkeits-Kompass, kein Gelddrucker. Und an 27–51% der Tage wird das Session-Ziel schlicht nie erreicht — auch das sagt dir die Karte.',
      },
      {
        q: 'Wie bekomme ich nach dem Kauf Zugriff?',
        a: 'Der Indikator ist invite-only auf TradingView. Nach dem Checkout hinterlegst du deinen TradingView-Usernamen und der Zugang wird freigeschaltet. Ein kostenloser TradingView-Account reicht.',
      },
      {
        q: 'Kann ich kündigen?',
        a: 'Ja, jederzeit — monatlich zum Monatsende, jährlich zum Jahresende. Der Zugang endet mit dem Abo.',
      },
    ],
  },
}

export const raidmapDisclaimer: L<{ title: string; body: string }> = {
  en: {
    title: 'Risk & transparency',
    body:
      'All statistics shown are historical, in-sample results on NQ futures (1-minute data, 2016–2025) against random-placebo benchmarks, validated separately in two market eras. Past behavior does not guarantee future behavior. The final out-of-sample test is deliberately reserved and has not been run. This product is a charting/context tool — it is not financial advice, not an entry system, and makes no profit claims. Futures trading involves substantial risk of loss.',
  },
  de: {
    title: 'Risiko & Transparenz',
    body:
      'Alle gezeigten Statistiken sind historische In-Sample-Ergebnisse auf NQ-Futures (1-Minuten-Daten, 2016–2025) gegen Zufalls-Placebo-Benchmarks, getrennt in zwei Marktepochen validiert. Vergangenes Verhalten garantiert kein zukünftiges Verhalten. Der finale Out-of-Sample-Test ist bewusst reserviert und wurde noch nicht durchgeführt. Dieses Produkt ist ein Chart-/Kontext-Werkzeug — keine Anlageberatung, kein Entry-System, keine Gewinnversprechen. Futures-Handel birgt erhebliches Verlustrisiko.',
  },
}

export const raidmapUi: L<{
  langSwitch: string
  langSwitchHref: string
  docsCta: string
  backToSales: string
}> = {
  en: {
    langSwitch: 'Deutsche Version',
    langSwitchHref: c.salesPathDe,
    docsCta: 'Documentation',
    backToSales: 'Back to PAT Raid Map',
  },
  de: {
    langSwitch: 'English version',
    langSwitchHref: c.salesPathEn,
    docsCta: 'Dokumentation',
    backToSales: 'Zurück zur PAT Raid Map',
  },
}
