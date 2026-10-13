'use client'

import { motion, useReducedMotion } from 'motion/react'
import { EASE } from './bewegung'
import { woerterbuch, type Sprache } from './texte'

/**
 * Kleine Skizze zum CRV im Stil der Landing-Zeichnungen: Einstieg, Stopp 1 R darunter, Ziel CRV × R darüber.
 * Beim Wechsel des CRV gleitet die Ziel-Linie an ihren neuen Platz, auch live beim Ziehen am Regler. Ab CRV 3,5 wird der
 * Maßstab kleiner, damit das Ziel im Bild bleibt (Verhältnis Stopp zu Ziel stimmt immer).
 */
export function CrvSkizze({ crv, sprache }: { crv: number; sprache: Sprache }) {
  const t = woerterbuch(sprache)
  const S = t.wz.crvSkizze
  const ruhig = useReducedMotion()
  const einstieg = 118
  const einheit = Math.min(26, 90 / Math.max(crv, 0.5))
  const stopp = einstieg + einheit
  const ziel = einstieg - crv * einheit
  const ueberg = ruhig ? { duration: 0 } : { duration: 0.18, ease: EASE }
  const r = (x: number) => t.f.zahlText(x, 1)
  return (
    <svg className="crv-skizze" viewBox="0 0 320 170" role="img" aria-label={`${S.ziel} +${r(crv)} R, ${S.stopp} −1 R`}>
      {/* Kurs: erst leicht gegen die Position, dann Richtung Ziel */}
      <motion.path
        className="crv-kurs"
        initial={false}
        animate={{ d: `M40 ${einstieg} L80 ${einstieg + 12} L120 ${einstieg - 6} L170 ${(einstieg + ziel) / 2 + 8} L220 ${ziel + 10} L262 ${ziel}` }}
        transition={ueberg}
      />
      <line className="crv-linie" x1="30" x2="290" y1={einstieg} y2={einstieg} />
      <motion.line className="crv-linie crv-stopp" x1="30" x2="290" initial={false} animate={{ y1: stopp, y2: stopp }} transition={ueberg} />
      <motion.line className="crv-linie crv-ziel" x1="30" x2="290" initial={false} animate={{ y1: ziel, y2: ziel }} transition={ueberg} />
      {/* Bemaßung rechts */}
      <motion.line className="crv-mass" x1="300" x2="300" y1={einstieg} initial={false} animate={{ y2: stopp }} transition={ueberg} />
      <motion.line className="crv-mass" x1="300" x2="300" y1={einstieg} initial={false} animate={{ y2: ziel }} transition={ueberg} />
      {/* unter CRV 1 liegt das Ziel so nah am Einstieg, dass dessen Beschriftung unter die Linie wandert */}
      <text className="crv-text" x="34" y={crv < 0.95 ? einstieg + 15 : einstieg - 6}>{S.einstieg}</text>
      <motion.text className="crv-text crv-stopp-text" x="34" initial={false} animate={{ y: stopp + 14 }} transition={ueberg}>{`${S.stopp} −1 R`}</motion.text>
      <motion.text className="crv-text crv-ziel-text" x="34" initial={false} animate={{ y: ziel - 6 }} transition={ueberg}>
        {`${S.ziel} +${r(crv)} R`}
      </motion.text>
    </svg>
  )
}
