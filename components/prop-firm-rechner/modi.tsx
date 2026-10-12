'use client'

import { useState } from 'react'
import { PropFirmRechner } from './rechner'
import { Rueckwaerts } from './rueckwaerts'
import { woerterbuch, type Sprache } from './texte'

type Modus = 'rueck' | 'vor'

/**
 * Zwei Rechenarten als Tabs. Rückwärts ist Standard („So herum denken die meisten“). Der Vorwärts-Rechner startet
 * seine Worker erst, wenn der Tab zum ersten Mal geöffnet wird, und bleibt danach erhalten (Eingaben gehen nicht verloren).
 */
export function Modi({ sprache }: { sprache: Sprache }) {
  const t = woerterbuch(sprache)
  const M = t.modi
  const [modus, setModus] = useState<Modus>('rueck')
  const [vorBesucht, setVorBesucht] = useState(false)
  const waehle = (m: Modus) => {
    setModus(m)
    if (m === 'vor') setVorBesucht(true)
  }
  const tab = (m: Modus, titel: string, kurz: string) => (
    <button
      type="button"
      role="tab"
      id={`tab-${m}`}
      aria-selected={modus === m}
      aria-controls={`panel-${m}`}
      tabIndex={modus === m ? 0 : -1}
      onClick={() => waehle(m)}
      onKeyDown={(ev) => {
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
          ev.preventDefault()
          const n: Modus = m === 'rueck' ? 'vor' : 'rueck'
          waehle(n)
          document.getElementById(`tab-${n}`)?.focus()
        }
      }}
    >
      <b>{titel}</b>
      <small>{kurz}</small>
    </button>
  )
  return (
    <section className="wrap modi" id="rechner" aria-label={M.aria}>
      <div className="modus-wahl" role="tablist" aria-label={M.aria}>
        {tab('rueck', M.rueck, M.rueckKurz)}
        {tab('vor', M.vor, M.vorKurz)}
      </div>
      <div role="tabpanel" id="panel-rueck" aria-labelledby="tab-rueck" hidden={modus !== 'rueck'}>
        <Rueckwaerts sprache={sprache} />
      </div>
      {(vorBesucht || modus === 'vor') && (
        <div role="tabpanel" id="panel-vor" aria-labelledby="tab-vor" hidden={modus !== 'vor'}>
          <PropFirmRechner sprache={sprache} />
        </div>
      )}
    </section>
  )
}
