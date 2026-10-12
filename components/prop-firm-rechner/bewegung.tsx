'use client'

/**
 * Bewegung im Prop-Firm-Rechner: ruhig und schnell (150 bis 400 ms), mit motion (schon im Repo, components/ui nutzt es).
 * Bei „Bewegung reduzieren“ springen Zahlen, Balken und Aufklapp-Felder ohne Animation an ihr Ziel.
 */
import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

export const EASE = [0.2, 0, 0, 1] as const
export const DAUER = 0.28

/** „Was heißt das?“: Knopf mit Pfeil, Inhalt klappt mit Höhen-Animation auf. */
export function Erklaerung({ titel, children, klasse = '' }: { titel: string; children: ReactNode; klasse?: string }) {
  const [offen, setOffen] = useState(false)
  const id = useId()
  const ruhig = useReducedMotion()
  return (
    <div className={`erkl ${klasse}`} data-offen={offen ? '' : undefined}>
      <button type="button" className="erkl-knopf" aria-expanded={offen} aria-controls={id} onClick={() => setOffen(!offen)}>
        <span>{titel}</span>
        <i aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {offen && (
          <motion.div
            id={id}
            className="erkl-inhalt"
            initial={ruhig ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={ruhig ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
          >
            <div className="erkl-text">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Zahl, die vom letzten Wert (beim ersten Mal von 0) hochzählt. */
export function Zaehler({ wert, format, dauer = 0.6 }: { wert: number; format: (x: number) => string; dauer?: number }) {
  const ruhig = useReducedMotion()
  const [text, setText] = useState(() => format(0))
  const letzter = useRef(0)
  // Formatierer per Ref: eine neue Funktion je Render soll die Animation nicht neu starten
  const fmt = useRef(format)
  useEffect(() => {
    fmt.current = format
  })
  useEffect(() => {
    if (ruhig) {
      letzter.current = wert
      return
    }
    const steuerung = animate(letzter.current, wert, {
      duration: dauer,
      ease: EASE,
      onUpdate: (x) => setText(fmt.current(x)),
      onComplete: () => {
        letzter.current = wert
      },
    })
    return () => steuerung.stop()
  }, [wert, dauer, ruhig])
  return <>{ruhig ? format(wert) : text}</>
}

/** Balken, der von 0 auf seine Breite wächst (Anteil 0 bis 1). */
export function Wachsen({ anteil, verzoegerung = 0, klasse = '' }: { anteil: number; verzoegerung?: number; klasse?: string }) {
  const ruhig = useReducedMotion()
  return (
    <motion.i
      className={klasse}
      initial={ruhig ? false : { width: 0 }}
      animate={{ width: `${Math.max(0, Math.min(1, anteil)) * 100}%` }}
      transition={{ duration: 0.4, delay: verzoegerung, ease: EASE }}
    />
  )
}

/** Listen-Eintrag, der gestaffelt hereinkommt (Index i). */
export function Herein({ i, children, klasse, als = 'li' }: { i: number; children: ReactNode; klasse?: string; als?: 'li' | 'div' }) {
  const ruhig = useReducedMotion()
  const Tag = als === 'li' ? motion.li : motion.div
  return (
    <Tag
      className={klasse}
      initial={ruhig ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(i, 10) * 0.045, ease: EASE }}
    >
      {children}
    </Tag>
  )
}

/** Satzteil des Ergebnisses: kommt nach seinem Vorgänger herein (Index i, je 120 ms später). */
export function Satz({ i, children, klasse, als = 'p' }: { i: number; children: ReactNode; klasse?: string; als?: 'p' | 'div' }) {
  const ruhig = useReducedMotion()
  const Tag = als === 'p' ? motion.p : motion.div
  return (
    <Tag
      className={klasse}
      initial={ruhig ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, delay: 0.08 + i * 0.12, ease: EASE }}
    >
      {children}
    </Tag>
  )
}
