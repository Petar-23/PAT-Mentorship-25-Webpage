'use client'

import { useEffect, useId, useRef, type CSSProperties } from 'react'

type ReglerProps = {
  /** sichtbare Beschriftung, zugleich Name für Screenreader */
  label: string
  wert: number
  /** Rasterwerte: der Regler rastet nur dort ein (Rückwärts-Modus). Ohne Raster: stufenlos von min bis max. */
  stufen?: readonly number[]
  min?: number
  max?: number
  schritt?: number
  /** großer Wert neben der Beschriftung, dazu klein die Einheit */
  anzeige: (x: number) => string
  einheit?: string
  /** Text für Screenreader (aria-valuetext), etwa „5 Trades pro Woche“ */
  sprechText: (x: number) => string
  /** Beschriftungen unter der Spur */
  marken: { wert: number; text: string }[]
  onChange: (x: number) => void
}

/** Rasterstelle, die einem Wert am nächsten liegt */
export function naechsteStufe(stufen: readonly number[], x: number): number {
  let beste = 0
  stufen.forEach((s, i) => {
    if (Math.abs(s - x) < Math.abs(stufen[beste] - x)) beste = i
  })
  return beste
}

/**
 * Regler mit großem, gut greifbarem Daumen (44 px Trefferfläche) und dem aktuellen Wert groß daneben.
 * Natives <input type="range">: Pfeiltasten, Pos1/Ende und Screenreader funktionieren ohne Zusatz, aria-valuetext nennt den
 * Wert in Worten. Mit Raster arbeitet die Spur auf den Positionen des Rasters (gleich weit auseinander), sonst stufenlos.
 */
export function Regler({ label, wert, stufen, min = 0, max = 1, schritt = 1, anzeige, einheit, sprechText, marken, onChange }: ReglerProps) {
  const id = useId()
  const rahmen = useRef<HTMLDivElement>(null)

  // Ziehen am Daumen darf nicht die Bühne wischen (motion drag="x" hört auf pointerdown am Schritt)
  useEffect(() => {
    const el = rahmen.current
    if (!el) return
    const halt = (e: Event) => e.stopPropagation()
    el.addEventListener('pointerdown', halt)
    return () => el.removeEventListener('pointerdown', halt)
  }, [])

  const unten = stufen ? 0 : min
  const oben = stufen ? stufen.length - 1 : max
  const pos = stufen ? naechsteStufe(stufen, wert) : Math.min(oben, Math.max(unten, wert))
  const anteil = (x: number) => (oben > unten ? (x - unten) / (oben - unten) : 0)
  const stelle = (x: number) => (stufen ? anteil(naechsteStufe(stufen, x)) : anteil(Math.min(oben, Math.max(unten, x))))
  const nachkomma = Math.max(0, -Math.floor(Math.log10(schritt) + 1e-9))

  return (
    <div className="regler" ref={rahmen} style={{ '--f': anteil(pos) } as CSSProperties}>
      <div className="regler-kopf">
        <label htmlFor={id}>{label}</label>
        <span className="regler-wert" aria-hidden="true">
          <b>{anzeige(wert)}</b>
          {einheit && <small>{einheit}</small>}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={unten}
        max={oben}
        step={stufen ? 1 : schritt}
        value={pos}
        aria-valuetext={sprechText(wert)}
        onChange={(e) => {
          const v = Number(e.target.value)
          onChange(stufen ? stufen[v] : Number(v.toFixed(nachkomma)))
        }}
      />
      <div className="regler-marken" aria-hidden="true">
        {marken.map((m) => (
          <span key={m.wert} style={{ '--f': stelle(m.wert) } as CSSProperties} data-an={m.wert === wert ? '' : undefined}>
            {m.text}
          </span>
        ))}
      </div>
    </div>
  )
}
