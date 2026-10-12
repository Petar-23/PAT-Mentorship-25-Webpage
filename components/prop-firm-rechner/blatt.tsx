'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { EASE } from './bewegung'

/**
 * Vollbild-Blatt über dem Rechner (Methode und Quellen, andere Konten, Annahmen): fährt von unten herein, scrollt nur in
 * sich, Schließen per Knopf oder Escape. Der Fokus springt auf den Schließen-Knopf und danach zurück.
 */
export function Blatt({ offen, onClose, titel, schliessen, children, id }: {
  offen: boolean
  onClose: () => void
  titel: string
  schliessen: string
  children: ReactNode
  id: string
}) {
  const ruhig = useReducedMotion()
  const knopf = useRef<HTMLButtonElement>(null)
  const vorher = useRef<Element | null>(null)
  useEffect(() => {
    if (!offen) return
    vorher.current = document.activeElement
    const id = window.setTimeout(() => knopf.current?.focus(), 30)
    const taste = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', taste)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('keydown', taste)
      if (vorher.current instanceof HTMLElement) vorher.current.focus()
    }
  }, [offen, onClose])
  return (
    <AnimatePresence>
      {offen && (
        <motion.div
          className="blatt"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${id}-titel`}
          initial={ruhig ? { opacity: 0 } : { y: '100%' }}
          animate={ruhig ? { opacity: 1 } : { y: 0 }}
          exit={ruhig ? { opacity: 0 } : { y: '100%' }}
          transition={{ duration: 0.32, ease: EASE }}
        >
          <div className="blatt-kopf">
            <h2 id={`${id}-titel`}>{titel}</h2>
            <button type="button" ref={knopf} className="blatt-zu" onClick={onClose} aria-label={schliessen}>
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <div className="blatt-inhalt">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
