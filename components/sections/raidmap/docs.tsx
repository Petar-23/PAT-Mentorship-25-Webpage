import Link from 'next/link'
import { RAIDMAP_CONFIG, type RaidMapLang } from '@/lib/raidmap-config'
import { raidmapUi } from '@/lib/raidmap-content'

// Doku-Inhalte. BEWUSST ohne Konstruktions-Details (Schwellen, Cluster-Regeln,
// Regel-Tabellen, Validierungs-Mechanik im Detail) — die Doku erklärt Bedienung
// und Lesart, nicht das Rezept.

type DocSection = { title: string; blocks: { h?: string; p?: string; list?: string[] }[] }

const docs: Record<RaidMapLang, { title: string; intro: string; sections: DocSection[] }> = {
  en: {
    title: 'PAT Raid Map — Documentation',
    intro:
      'Everything you need to read the map with confidence. The indicator is a context layer: it ranks likely first targets, marks validated timing windows and tracks the purge scenario. It never gives entries, stops or position sizes.',
    sections: [
      {
        title: 'Quick start',
        blocks: [
          {
            list: [
              'Add the indicator to an NQ futures chart (built and validated on NQ). Intraday timeframes work best; 1–5 minutes is the intended range.',
              'At each session open (London 02:00, Premarket 07:00, NY AM 09:30, Lunch 11:30, NY PM 13:30, Last Hour 15:00 — all ET, DST handled) the map freezes the standing liquidity levels and draws its layers.',
              'Everything session-bound disappears when the session ends. Overnight and Asia stay clean on purpose — old levels invite bad trades. The only all-day line is midnight 00:00 ET.',
            ],
          },
        ],
      },
      {
        title: 'The layers, and how to read them',
        blocks: [
          {
            h: 'DoL line (Draw on Liquidity)',
            p: 'The level that historically won the “which gets hit first” race for this session setup, with a confidence tag. Read it as the session’s magnet — not as a promise. When the target sits far away, the map itself downgrades to LOW CONFIDENCE because most of those days it never got hit.',
          },
          {
            h: 'Run windows (shaded time zones)',
            p: 'The validated minutes in which open targets historically fell more often than in any random window of the same width. If a window passes without the run, the odds decay — the NY AM panel is explicit about how fast.',
          },
          {
            h: 'Purge candidate & “PURGE DONE”',
            p: 'The nearest opposite-side level, with the session’s purge risk. If it breaks before the DoL, the label flips to PURGE DONE and shows what typically followed (how soon the run started, how deep the dip went). A purge is a scenario change, not a failure.',
          },
          {
            h: 'Micro pools (EQL / EQH)',
            p: 'Small relative equal highs/lows on the opposite side of the DoL — but only those in the statistically validated distance band. Each label carries its own raided-first number. When one gets raided, an ignition note appears where the data supports it.',
          },
          {
            h: 'Terminus bands (safe / typical / stretch)',
            p: 'Projected from the DoL, scaled live by current volatility (ADR). They answer “if it breaks, how far did such runs typically travel before the session closed”. They are descriptive ranges, not targets to force.',
          },
          {
            h: 'Unhit DoL memory',
            p: 'If a session’s DoL never got hit, it stays on the chart greyed out and gets marked “HIT (late)” if a later session takes it. Toggle it off in settings if you prefer a cleaner chart.',
          },
        ],
      },
      {
        title: 'The confidence system',
        blocks: [
          {
            p: 'Every number on the chart carries a tag: HIGH CONFIDENCE (survived all validation checks in both market eras), MID CONFIDENCE (survived the main check, borderline on one control), LOW CONFIDENCE (informational — distance explains it, or the map is warning you). Where no validated rule exists you will see “no signal” instead of a number. Hover any label for the full statistic behind it.',
          },
        ],
      },
      {
        title: 'Settings reference',
        blocks: [
          {
            list: [
              'Core: timezone (keep America/New_York), ADR length, max rows in the exceed panel.',
              'Visibility toggles: session panel table (off by default — the chart labels carry the story), session zones + labels, midnight line, DoL compass, terminus projection, unhit DoLs, run windows, purge candidate, liquidity pools.',
              'Liquidity pools: sensitivity, equality tolerance and max pools shown control how busy the pool layer is. Defaults match the validated configuration — change them for readability, not for “more signals”.',
              'Sizes & colors: label text size (tiny → large), table text size, and a full color group so the map fits your chart theme.',
            ],
          },
        ],
      },
      {
        title: 'Honest limits',
        blocks: [
          {
            list: [
              'All statistics are historical (NQ futures, 1-minute data, 2016–2025) and were additionally confirmed on a reserved out-of-sample year (Jul 2025 – Jun 2026) — tested exactly once, criteria frozen in advance, 96% of robust cells held.',
              'Validated on NQ only. The indicator draws on other symbols, but no number was validated there.',
              'Depending on the session, 27–51% of days the session target never gets hit. The map shows probabilities, not certainties.',
              'No entries, no stops, no sizing, no financial advice.',
            ],
          },
        ],
      },
      {
        title: 'Access & support',
        blocks: [
          {
            p: 'Access is invite-only on TradingView and tied to your TradingView username (a free TradingView account is enough). Questions: kontakt@price-action-trader.de — or join the weekly live streams where we read the map on live sessions.',
          },
        ],
      },
    ],
  },
  de: {
    title: 'PAT Raid Map — Dokumentation',
    intro:
      'Alles, was du brauchst, um die Karte souverän zu lesen. Der Indikator ist ein Kontext-Layer: Er rankt wahrscheinliche erste Ziele, markiert validierte Zeitfenster und trackt das Purge-Szenario. Er gibt niemals Entries, Stops oder Positionsgrößen.',
    sections: [
      {
        title: 'Schnellstart',
        blocks: [
          {
            list: [
              'Füge den Indikator einem NQ-Futures-Chart hinzu (gebaut und validiert auf NQ). Intraday-Timeframes funktionieren am besten; 1–5 Minuten ist der gedachte Bereich.',
              'Zu jedem Session-Open (London 02:00, Premarket 07:00, NY AM 09:30, Lunch 11:30, NY PM 13:30, Last Hour 15:00 — alles ET, DST wird behandelt) friert die Karte die stehenden Liquiditäts-Level ein und zeichnet ihre Ebenen.',
              'Alles Session-Gebundene verschwindet mit dem Session-Ende. Overnight und Asia bleiben absichtlich leer — alte Level verleiten zu schlechten Trades. Die einzige Ganztages-Linie ist Mitternacht 00:00 ET.',
            ],
          },
        ],
      },
      {
        title: 'Die Ebenen — und wie du sie liest',
        blocks: [
          {
            h: 'DoL-Linie (Draw on Liquidity)',
            p: 'Das Level, das historisch das „Wer wird zuerst getroffen“-Rennen für dieses Session-Setup gewann, mit Confidence-Tag. Lies es als Magnet der Session — nicht als Versprechen. Steht das Ziel weit weg, stuft sich die Karte selbst auf LOW CONFIDENCE herab, weil es an den meisten dieser Tage nie erreicht wurde.',
          },
          {
            h: 'Run-Fenster (schattierte Zeitzonen)',
            p: 'Die validierten Minuten, in denen offene Ziele historisch öfter fielen als in jedem Zufallsfenster gleicher Breite. Verstreicht ein Fenster ohne Run, sinken die Chancen — das NY-AM-Panel sagt dir explizit, wie schnell.',
          },
          {
            h: 'Purge-Kandidat & „PURGE DONE“',
            p: 'Das nächste Gegenseiten-Level, mit dem Purge-Risiko deiner Session. Bricht es vor dem DoL, springt das Label auf PURGE DONE und zeigt, was typischerweise folgte (wie schnell der Run kam, wie tief der Dip ging). Ein Purge ist ein Szenario-Wechsel, kein Versagen.',
          },
          {
            h: 'Mikro-Pools (EQL / EQH)',
            p: 'Kleine relative Equal Highs/Lows auf der Gegenseite des DoL — aber nur die im statistisch validierten Distanzband. Jedes Label trägt seine eigene Zuerst-geraidet-Zahl. Wird einer geraidet, erscheint dort, wo die Daten es stützen, ein Zünd-Hinweis.',
          },
          {
            h: 'Terminus-Bänder (safe / typical / stretch)',
            p: 'Projiziert ab dem DoL, live skaliert mit der aktuellen Volatilität (ADR). Sie beantworten: „Wenn es bricht — wie weit liefen solche Runs typischerweise bis Session-Ende?“ Deskriptive Spannen, keine Ziele, die man erzwingt.',
          },
          {
            h: 'Unhit-DoL-Gedächtnis',
            p: 'Wurde der DoL einer Session nie erreicht, bleibt er ausgegraut auf dem Chart und wird mit „HIT (late)“ markiert, falls eine spätere Session ihn holt. In den Einstellungen abschaltbar, wenn du es aufgeräumter magst.',
          },
        ],
      },
      {
        title: 'Das Confidence-System',
        blocks: [
          {
            p: 'Jede Zahl auf dem Chart trägt ein Tag: HIGH CONFIDENCE (alle Validierungs-Checks in beiden Marktepochen bestanden), MID CONFIDENCE (Haupt-Check bestanden, eine Kontrolle grenzwertig), LOW CONFIDENCE (informativ — Distanz erklärt es, oder die Karte warnt dich). Wo keine validierte Regel existiert, steht „no signal“ statt einer Zahl. Fahre über ein Label, um die volle Statistik dahinter zu sehen.',
          },
        ],
      },
      {
        title: 'Einstellungen im Überblick',
        blocks: [
          {
            list: [
              'Core: Zeitzone (America/New_York lassen), ADR-Länge, maximale Zeilen im Exceed-Panel.',
              'Sichtbarkeit: Session-Panel-Tabelle (default aus — die Chart-Labels tragen die Story), Session-Zonen + Labels, Mitternachtslinie, DoL-Kompass, Terminus-Projektion, Unhit-DoLs, Run-Fenster, Purge-Kandidat, Liquidity-Pools.',
              'Liquidity-Pools: Sensitivität, Gleichheits-Toleranz und maximale Pool-Anzahl steuern, wie voll die Pool-Ebene ist. Die Defaults entsprechen der validierten Konfiguration — ändere sie für Lesbarkeit, nicht für „mehr Signale“.',
              'Größen & Farben: Label-Textgröße (tiny → large), Tabellen-Textgröße und eine komplette Farbgruppe, damit die Karte zu deinem Chart-Theme passt.',
            ],
          },
        ],
      },
      {
        title: 'Ehrliche Grenzen',
        blocks: [
          {
            list: [
              'Alle Statistiken sind historisch (NQ-Futures, 1-Minuten-Daten, 2016–2025) und wurden zusätzlich auf einem reservierten Out-of-Sample-Jahr bestätigt (Jul 2025 – Jun 2026) — genau einmal getestet, Kriterien vorab eingefroren, 96% der robusten Zellen hielten.',
              'Validiert nur auf NQ. Der Indikator zeichnet auch auf anderen Symbolen, aber dort wurde keine Zahl validiert.',
              'Je nach Session wird das Session-Ziel an 27–51% der Tage nie erreicht. Die Karte zeigt Wahrscheinlichkeiten, keine Gewissheiten.',
              'Keine Entries, keine Stops, kein Sizing, keine Anlageberatung.',
            ],
          },
        ],
      },
      {
        title: 'Zugang & Support',
        blocks: [
          {
            p: 'Der Zugang ist invite-only auf TradingView und an deinen TradingView-Usernamen gebunden (ein kostenloser TradingView-Account reicht). Fragen: kontakt@price-action-trader.de — oder komm in die wöchentlichen Livestreams, in denen wir die Karte an echten Sessions lesen.',
          },
        ],
      },
    ],
  },
}

export default function RaidMapDocs({ lang }: { lang: RaidMapLang }) {
  const t = docs[lang]
  const ui = raidmapUi[lang]
  const salesHref = lang === 'en' ? RAIDMAP_CONFIG.salesPathEn : RAIDMAP_CONFIG.salesPathDe
  const otherDocsHref = lang === 'en' ? RAIDMAP_CONFIG.docsPathDe : RAIDMAP_CONFIG.docsPathEn

  return (
    <main className="py-16 px-4 md:px-6 bg-white">
      <div className="container mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4 mb-10">
          <Link
            href={salesHref}
            className="text-sm text-gray-500 underline underline-offset-4 hover:text-gray-900"
          >
            ← {ui.backToSales}
          </Link>
          <Link
            href={otherDocsHref}
            className="text-sm text-gray-500 underline underline-offset-4 hover:text-gray-900"
          >
            {ui.langSwitch}
          </Link>
        </div>

        <h1 className="text-3xl md:text-5xl font-bold text-gray-900 text-balance">{t.title}</h1>
        <p className="mt-5 text-lg text-gray-600 text-pretty">{t.intro}</p>

        {t.sections.map((section) => (
          <section key={section.title} className="mt-14">
            <h2 className="text-2xl font-bold text-gray-900 text-balance">{section.title}</h2>
            {section.blocks.map((block, i) => (
              <div key={i} className="mt-5">
                {block.h ? (
                  <h3 className="text-lg font-semibold text-gray-900 text-balance">{block.h}</h3>
                ) : null}
                {block.p ? (
                  <p className="mt-2 text-gray-600 leading-relaxed text-pretty">{block.p}</p>
                ) : null}
                {block.list ? (
                  <ul className="mt-2 space-y-3 list-disc pl-5">
                    {block.list.map((item) => (
                      <li key={item} className="text-gray-600 leading-relaxed text-pretty">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </section>
        ))}
      </div>
    </main>
  )
}
