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
    title: 'PAT Raid Map — Session Bias & Run Timing for NQ, backed by 10 years of data',
    description:
      'A TradingView indicator that maps which liquidity level gets raided first, when the run typically starts, and what happens after the purge — every number tested against random placebos on 10 years of NQ 1-minute data.',
  },
  de: {
    title: 'PAT Raid Map — Session-Bias & Run-Timing für NQ, belegt mit 10 Jahren Daten',
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
  urgency: string
  finePrint: string
}> = {
  en: {
    badge: 'TradingView indicator · NQ · invite-only · out-of-sample tested',
    title: 'Stop guessing the bias. Read the session like a map.',
    subtitle:
      'See the likely first raid, the validated run window, and the post-purge path directly on your TradingView chart — backed by 10 years of NQ data.',
    bullets: [
      'First-target map: the most likely first stop of the session, ranked by 10 years of level races',
      'Run-timing windows: the validated minutes when the move actually tends to happen',
      'Purge-then-run detection: know when the counter-side raid is fuel, not failure',
    ],
    ctaPrimary: 'Start 7-day free trial',
    ctaSecondary: 'Read the documentation',
    urgency: `Launch offer: first ${c.launchSpots} members · 7-day free trial · prices rise ${c.priceIncreasePct}% after`,
    finePrint:
      'Historical statistics (NQ futures, 2016–2025, in-sample). Not financial advice. No performance guarantee. Not an entry signal — a context layer.',
  },
  de: {
    badge: 'TradingView-Indikator · NQ · invite-only · Out-of-Sample getestet',
    title: 'Hör auf, den Bias zu raten. Lies die Session wie eine Karte.',
    subtitle:
      'Sieh den wahrscheinlichen ersten Raid, das validierte Run-Fenster und den Weg nach dem Purge direkt in deinem TradingView-Chart — belegt mit 10 Jahren NQ-Daten.',
    bullets: [
      'First-Target-Karte: der wahrscheinlichste erste Stopp der Session, gerankt aus 10 Jahren Level-Rennen',
      'Run-Timing-Fenster: die validierten Minuten, in denen die Bewegung typischerweise passiert',
      'Purge-then-Run-Erkennung: erkenne, wann der Gegenseiten-Raid Treibstoff ist — nicht Versagen',
    ],
    ctaPrimary: '7 Tage kostenlos testen',
    ctaSecondary: 'Dokumentation lesen',
    urgency: `Launch-Angebot: die ersten ${c.launchSpots} Mitglieder · 7 Tage kostenlos · danach ${c.priceIncreasePct}% teurer`,
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
        title: 'Session structure can be measured. So we measured it.',
        body:
          'Most tools guess where the day will close. We asked 10 years of NQ data (2,327 trading days, 575,439 confirmed swing levels) two smaller, sharper questions instead: which level gets hit first in each session — and when does the run start? Asked that way, the data answers with real, repeatable numbers.',
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
        title: 'Session-Struktur kann man messen. Also haben wir gemessen.',
        body:
          'Die meisten Tools raten, wo der Tag schließt. Wir haben 10 Jahre NQ-Daten (2.327 Handelstage, 575.439 bestätigte Swing-Level) stattdessen zwei kleinere, schärfere Fragen gestellt: Welches Level fällt in jeder Session zuerst — und wann startet der Run? So gefragt, antworten die Daten mit echten, wiederholbaren Zahlen.',
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

// Chart-Tour: ein echter Live-Chart mit kompakter Legende. Bewusst ohne
// Zahlen — alle Statistiken bleiben im Claims-Inventar-geprüften Content.
export const raidmapChartTour: L<{
  title: string
  subtitle: string
  imageAlt: string
  items: { label: string; body: string }[]
  pricingCta: string
}> = {
  en: {
    title: 'A real session, annotated',
    subtitle: 'One live NQ chart, straight from TradingView. Here’s how to read the map in ten seconds.',
    imageAlt:
      'PAT Raid Map on a live NQ 1-minute chart: red DoL line with traffic-light tag, validated EQH labels, safe and typical distance bands, and shaded session zones',
    items: [
      {
        label: '🔴🟡🟢 The traffic light',
        body: 'Green = strong stats (held in both market eras), yellow = decent, red = careful. Hover any label and it tells you why in one sentence.',
      },
      {
        label: 'DoL line (red)',
        body: 'The level price most likely runs to FIRST this session.',
      },
      {
        label: 'EQH / EQL tags',
        body: 'Only the equal highs/lows that beat a random level in testing — the map refuses to draw the ones that failed.',
      },
      {
        label: 'safe / typical',
        body: 'How far the move typically carried after the DoL broke — distance bands, not reversal targets.',
      },
      {
        label: 'Shaded zones',
        body: 'Your session and the validated run-window minutes.',
      },
    ],
    pricingCta: 'Try it on your own chart — 7 days free',
  },
  de: {
    title: 'Eine echte Session, erklärt',
    subtitle: 'Ein echter NQ-Chart, direkt aus TradingView. So liest du die Karte in zehn Sekunden.',
    imageAlt:
      'PAT Raid Map auf einem echten NQ-1-Minuten-Chart: rote DoL-Linie mit Ampel-Tag, validierte EQH-Labels, safe- und typical-Bänder und schattierte Session-Zonen',
    items: [
      {
        label: '🔴🟡🟢 Die Ampel',
        body: 'Grün = starke Statistik (hielt in beiden Marktepochen), Gelb = ordentlich, Rot = Vorsicht. Fahr über ein Label und es sagt dir in einem Satz, warum.',
      },
      {
        label: 'DoL-Linie (rot)',
        body: 'Das Level, zu dem der Preis in dieser Session am wahrscheinlichsten ZUERST läuft.',
      },
      {
        label: 'EQH-/EQL-Tags',
        body: 'Nur die Equal Highs/Lows, die im Test ein Zufalls-Level geschlagen haben — die durchgefallenen weigert sich die Karte zu zeichnen.',
      },
      {
        label: 'safe / typical',
        body: 'Wie weit die Bewegung nach dem DoL-Bruch typischerweise trug — Distanz-Bänder, keine Reversal-Ziele.',
      },
      {
        label: 'Schattierte Zonen',
        body: 'Deine Session und die validierten Run-Window-Minuten.',
      },
    ],
    pricingCta: 'Teste es auf deinem eigenen Chart — 7 Tage kostenlos',
  },
}

// Testimonials-Sektion: zeigt ausschliesslich approved Mitglieder-Stimmen
// (Review-Gate im Owner-Bereich) — bei 0 approved rendert die Sektion nichts.
export const raidmapTestimonials: L<{ title: string }> = {
  en: { title: 'What members say' },
  de: { title: 'Was Mitglieder sagen' },
}

export const raidmapFeatures: L<{
  title: string
  subtitle: string
  cards: FeatureCard[]
  sourceNote: string
}> = {
  en: {
    title: 'The five layers of the map',
    subtitle: 'Five layers. Each one carries its own validated number and a plain-English confidence tag.',
    sourceNote:
      'Behind every card: NQ futures, 1-minute data, 2016–2025, tested against fair random-placebo benchmarks — and confirmed on a one-shot out-of-sample year (Jul 2025 – Jun 2026). Exact numbers live in the docs and in every chart tooltip.',
    cards: [
      {
        title: 'First-Target Map (DoL compass)',
        stat: 'Up to 2.1× random',
        statNote: 'Our top-ranked targets got hit first up to 2.1× more often than a random level at the same distance — statistically confirmed.',
        body:
          'At every session open the map answers one question: which level got hit FIRST in ten years of races? Sessions cascade — each hunts the extremes of the one before it. You get one line and a plain confidence tag. No more staring at five levels wondering which one matters.',
      },
      {
        title: 'Run-Timing Windows',
        stat: 'The first 20 minutes',
        statNote: 'The window where runs actually happened — confirmed against random time windows of the same width.',
        body:
          'If the run comes, it comes early: in the NY morning, half of all session targets that fell, fell inside the first 20 minutes — and the odds decay fast after that. The validated windows sit on your chart as time zones, including London’s second wake-up in the early morning. Now “waiting for the move” has a clock.',
      },
      {
        title: 'Purge-then-Run Detection',
        stat: '~2× the odds',
        statNote: 'After an opening shakeout, the run followed about twice as often as random.',
        body:
          'Before the run, the other side often gets swept — the move that shakes most traders out. The map marks the purge candidate in advance, shows your session’s purge risk, and flips to “PURGE DONE — ignition” live. You also learn what a NORMAL shakeout looks like, how fast and how deep, so it stops scaring you out.',
      },
      {
        title: 'Validated Micro Pools',
        stat: '6 / 6 sessions',
        statNote: 'Only equal-high/low pools that beat their placebo in every single session make it onto your chart.',
        body:
          'Small equal highs and lows are the classic ignition targets — and most of them are noise. We tested them all against random look-alikes: only the statistically confirmed band gets drawn, each pool with its own track record one hover away. The tempting ones that failed the test? Deleted.',
      },
      {
        title: 'Terminus Bands',
        stat: '2–3× further',
        statNote: 'How much further the NY morning travels after the break, compared to every other session.',
        body:
          'Once the target breaks — how far does it usually run? The map projects safe / typical / stretch bands from the break, scaled live by current volatility. Fixed point targets age badly; these don’t.',
      },
      {
        title: 'The Honesty Engine',
        stat: '“No signal”',
        statNote: 'When the data doesn’t back a number, the map says exactly that — and downgrades itself.',
        body:
          'Target sitting far away? The map drops its own confidence to LOW and tells you that on most of those days it never got hit. No validated rule for your setup? It shows “no signal” instead of inventing one. Every number on the chart carries its full statistic, one hover away.',
      },
    ],
  },
  de: {
    title: 'Die fünf Ebenen der Karte',
    subtitle: 'Fünf Ebenen. Jede trägt ihre eigene validierte Zahl und ein Klartext-Confidence-Tag.',
    sourceNote:
      'Hinter jeder Karte: NQ-Futures, 1-Minuten-Daten, 2016–2025, getestet gegen faire Zufalls-Placebo-Benchmarks — und bestätigt auf einem einmaligen Out-of-Sample-Jahr (Jul 2025 – Jun 2026). Die exakten Zahlen stehen in der Doku und in jedem Chart-Tooltip.',
    cards: [
      {
        title: 'First-Target-Karte (DoL-Kompass)',
        stat: 'Bis zu 2,1× Zufall',
        statNote: 'Unsere Top-Ziele wurden bis zu 2,1× öfter zuerst getroffen als ein Zufalls-Level in gleicher Entfernung — statistisch bestätigt.',
        body:
          'Zu jedem Session-Open beantwortet die Karte eine Frage: Welches Level wurde in zehn Jahren ZUERST getroffen? Sessions kaskadieren — jede jagt die Extreme der Session davor. Du bekommst eine Linie und ein Klartext-Confidence-Tag. Schluss mit fünf Leveln anstarren und raten, welches zählt.',
      },
      {
        title: 'Run-Timing-Fenster',
        stat: 'Die ersten 20 Minuten',
        statNote: 'Das Fenster, in dem Runs wirklich passierten — bestätigt gegen Zufalls-Zeitfenster gleicher Breite.',
        body:
          'Wenn der Run kommt, kommt er früh: Am NY-Vormittag fiel die Hälfte aller Session-Ziele, die überhaupt fielen, in die ersten 20 Minuten — danach sinken die Chancen schnell. Die validierten Fenster liegen als Zeitzonen auf deinem Chart, inklusive Londons zweitem Aufwachen am frühen Morgen. „Auf die Bewegung warten“ hat jetzt eine Uhr.',
      },
      {
        title: 'Purge-then-Run-Erkennung',
        stat: '~2× die Chance',
        statNote: 'Nach einem Eröffnungs-Shakeout folgte der Run etwa doppelt so oft wie bei Zufall.',
        body:
          'Vor dem Run wird oft erst die andere Seite abgeholt — genau die Bewegung, die die meisten Trader rausschüttelt. Die Karte markiert den Purge-Kandidaten im Voraus, nennt dein Session-Purge-Risiko und schaltet live auf „PURGE DONE — ignition“. Du lernst außerdem, wie ein NORMALER Shakeout aussieht — wie schnell, wie tief — damit er dich nicht mehr rauswirft.',
      },
      {
        title: 'Validierte Mikro-Pools',
        stat: '6 / 6 Sessions',
        statNote: 'Nur Equal-High/Low-Pools, die ihr Placebo in jeder einzelnen Session schlagen, kommen auf deinen Chart.',
        body:
          'Kleine Equal Highs/Lows sind die klassischen Zünd-Ziele — und die meisten sind Rauschen. Wir haben alle gegen Zufalls-Doppelgänger getestet: Nur das statistisch bestätigte Band wird gezeichnet, jeder Pool mit eigener Bilanz einen Hover entfernt. Die verlockenden, die durchfielen? Gelöscht.',
      },
      {
        title: 'Terminus-Bänder',
        stat: '2–3× weiter',
        statNote: 'So viel weiter läuft der NY-Vormittag nach dem Bruch — verglichen mit jeder anderen Session.',
        body:
          'Wenn das Ziel bricht — wie weit läuft es dann typisch? Die Karte projiziert safe / typical / stretch-Bänder ab dem Bruch, live skaliert mit der aktuellen Volatilität. Feste Punktziele altern schlecht; diese nicht.',
      },
      {
        title: 'Die Ehrlichkeits-Engine',
        stat: '„No signal“',
        statNote: 'Wenn die Daten eine Zahl nicht tragen, sagt die Karte genau das — und stuft sich selbst herab.',
        body:
          'Ziel weit weg? Die Karte senkt ihre eigene Confidence auf LOW und sagt dir, dass es an den meisten dieser Tage nie erreicht wurde. Keine validierte Regel für dein Setup? Dann steht da „no signal“ statt einer erfundenen Zahl. Jede Zahl auf dem Chart trägt ihre volle Statistik, einen Hover entfernt.',
      },
    ],
  },
}

export const raidmapPricing: L<{
  title: string
  subtitle: string
  launchBadge: string
  trialNote: string
  lockNote: string
  monthly: { name: string; period: string; note: string; cta: string; strike: string }
  annual: { name: string; period: string; note: string; badge: string; cta: string; strike: string }
  included: string[]
  loginNote: string
  legalNote: string
}> = {
  en: {
    title: 'Launch offer — first 300 members',
    subtitle: `7-day free trial on both plans. After the first ${c.launchSpots} members, prices rise ${c.priceIncreasePct}%.`,
    launchBadge: `First ${c.launchSpots} members only`,
    trialNote: 'Cancel during the 7-day trial and you pay nothing.',
    lockNote: 'Your launch price stays locked for as long as your subscription stays active.',
    monthly: {
      name: 'Monthly',
      period: '/month',
      note: 'Billed monthly after trial · cancel anytime',
      cta: 'Start 7-day free trial',
      strike: c.monthlyPriceAfterFormatted,
    },
    annual: {
      name: 'Annual',
      period: `/month · billed ${c.annualTotalFormatted}/year`,
      note: 'Billed yearly after trial · cancel anytime',
      badge: `Save ${c.annualSavingsPct}%`,
      cta: 'Start 7-day free trial',
      strike: c.annualMonthlyAfterFormatted,
    },
    included: [
      'PAT Raid Map on TradingView (invite-only access)',
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
    title: 'Launch-Angebot — die ersten 300 Mitglieder',
    subtitle: `7 Tage kostenlos testen, bei beiden Plänen. Nach den ersten ${c.launchSpots} Mitgliedern steigen die Preise um ${c.priceIncreasePct}%.`,
    launchBadge: `Nur die ersten ${c.launchSpots} Mitglieder`,
    trialNote: 'Kündigst du in den 7 Test-Tagen, zahlst du nichts.',
    lockNote: 'Dein Launch-Preis bleibt gesperrt, solange dein Abo aktiv ist.',
    monthly: {
      name: 'Monatlich',
      period: '/Monat',
      note: 'Monatliche Abrechnung nach dem Test · jederzeit kündbar',
      cta: '7 Tage kostenlos testen',
      strike: c.monthlyPriceAfterFormatted,
    },
    annual: {
      name: 'Jährlich',
      period: `/Monat · ${c.annualTotalFormatted}/Jahr`,
      note: 'Jährliche Abrechnung nach dem Test · jederzeit kündbar',
      badge: `${c.annualSavingsPct}% sparen`,
      cta: '7 Tage kostenlos testen',
      strike: c.annualMonthlyAfterFormatted,
    },
    included: [
      'PAT Raid Map auf TradingView (Invite-only-Zugang)',
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
        q: 'Has this been tested out-of-sample?',
        a: 'Yes — the hard way. Everything was built on 2016–2025 data, and we deliberately reserved one untouched year (Jul 2025 – Jun 2026). On July 7, 2026 it was tested exactly once, with pass criteria frozen in advance: 96% of the robust cells held their edge on data the research had never seen. Where the test disagreed, we adjusted the numbers we quote — one follow-through band now uses the more conservative out-of-sample value. That test can never be repeated, and that is exactly what makes it honest.',
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
        q: 'How does the 7-day free trial work?',
        a: 'You check out normally (card required), but nothing is charged for 7 days. Cancel anytime during the trial with one click and you pay nothing. If you keep it, billing starts automatically after day 7.',
      },
      {
        q: 'What happens after the first 300 members?',
        a: `Prices rise by ${c.priceIncreasePct}% (${c.monthlyPriceFormatted} → ${c.monthlyPriceAfterFormatted} monthly, ${c.annualMonthlyPriceFormatted} → ${c.annualMonthlyAfterFormatted} on the annual plan). Early members keep their launch price for as long as their subscription stays active.`,
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
        q: 'Wurde das out-of-sample getestet?',
        a: 'Ja — auf die harte Tour. Alles wurde auf Daten von 2016–2025 gebaut, und wir haben bewusst ein unangetastetes Jahr reserviert (Jul 2025 – Jun 2026). Am 7. Juli 2026 wurde genau einmal getestet, mit vorab eingefrorenen Kriterien: 96% der robusten Zellen hielten ihren Edge auf Daten, die die Research nie gesehen hatte. Wo der Test widersprach, haben wir die zitierten Zahlen angepasst — ein Follow-Through-Band nutzt jetzt den konservativeren Out-of-Sample-Wert. Dieser Test ist unwiederholbar — genau das macht ihn ehrlich.',
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
        q: 'Wie funktioniert der 7-Tage-Test?',
        a: 'Du gehst normal durch den Checkout (Karte erforderlich), aber 7 Tage lang wird nichts abgebucht. Kündige jederzeit während des Tests mit einem Klick — dann zahlst du nichts. Behältst du das Abo, startet die Abrechnung automatisch nach Tag 7.',
      },
      {
        q: 'Was passiert nach den ersten 300 Mitgliedern?',
        a: `Die Preise steigen um ${c.priceIncreasePct}% (${c.monthlyPriceFormatted} → ${c.monthlyPriceAfterFormatted} monatlich, ${c.annualMonthlyPriceFormatted} → ${c.annualMonthlyAfterFormatted} im Jahresplan). Frühe Mitglieder behalten ihren Launch-Preis, solange ihr Abo aktiv bleibt.`,
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
      'All statistics shown are historical, in-sample results on NQ futures (1-minute data, 2016–2025) against random-placebo benchmarks, validated separately in two market eras, and confirmed on a reserved out-of-sample year (Jul 2025 – Jun 2026) that was tested exactly once with preregistered criteria. Past behavior does not guarantee future behavior. This product is a charting/context tool — it is not financial advice, not an entry system, and makes no profit claims. Futures trading involves substantial risk of loss.',
  },
  de: {
    title: 'Risiko & Transparenz',
    body:
      'Alle gezeigten Statistiken sind historische In-Sample-Ergebnisse auf NQ-Futures (1-Minuten-Daten, 2016–2025) gegen Zufalls-Placebo-Benchmarks, getrennt in zwei Marktepochen validiert und auf einem reservierten Out-of-Sample-Jahr bestätigt (Jul 2025 – Jun 2026), das genau einmal mit vorregistrierten Kriterien getestet wurde. Vergangenes Verhalten garantiert kein zukünftiges Verhalten. Dieses Produkt ist ein Chart-/Kontext-Werkzeug — keine Anlageberatung, kein Entry-System, keine Gewinnversprechen. Futures-Handel birgt erhebliches Verlustrisiko.',
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
