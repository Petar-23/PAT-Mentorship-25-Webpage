'use client'

import { useEffect } from 'react'

/**
 * Abschnitt Warum: verstreutes Material ordnet sich beim Scrollen zu einer Treppe.
 * Arbeitet imperativ auf dem serverseitig gerenderten SVG (#wc-plan), ohne React-State pro Frame.
 * Ohne JS und bei reduzierter Bewegung bleibt die fertige Treppe stehen.
 */

type Sheet = {
  el: SVGGraphicsElement
  c: SVGElement | null
  k: number[]
  f: number[]
  t0: number
  end: string
  last: string
  drop: number
  op: number
  cop: number
}
type Block = { path: SVGElement | null; cap: SVGElement | null; capEnd: string; h: number; list: Sheet[]; last: string; capLast: string; capOp: number }
type Timed = { el: SVGElement; a: number; b: number; last: number }

const RAD = Math.PI / 180
const LIFT = 18
const HOVER = 0.8
// Absätze: der Schmerz tritt zurück, die Ordnung tritt hervor. Mindestdeckkraft 0.7 hält den Kontrast über 4.5:1.
const TEXT_MIN_OPACITY = 0.7

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(2 - 2 * t, 3) / 2)
const smooth = (t: number) => t * t * (3 - 2 * t)
const fx = (v: number) => Math.round(v * 1000) / 1000

function rot(x: number, y: number, z: number, yaw: number, pitch: number, roll: number): [number, number, number] {
  let c = Math.cos(roll)
  let s = Math.sin(roll)
  let t = x * c + z * s
  z = -x * s + z * c
  x = t
  c = Math.cos(pitch)
  s = Math.sin(pitch)
  t = y * c - z * s
  z = y * s + z * c
  y = t
  c = Math.cos(yaw)
  s = Math.sin(yaw)
  t = x * c - y * s
  y = x * s + y * c
  x = t
  return [x, y, z]
}

function startWarum(sec: HTMLElement, svg: SVGSVGElement): () => void {
  const track = sec.querySelector<HTMLElement>('.wc-track')
  const stage = sec.querySelector<HTMLElement>('.wc-stage')
  if (!track || !stage) return () => {}
  const p1 = sec.querySelector<HTMLElement>('.wc-p1')
  const p2 = sec.querySelector<HTMLElement>('.wc-p2')
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  const num = (a: string) => Number(svg.getAttribute(a))
  const C = num('data-c'), OX = num('data-ox'), OY = num('data-oy'), W = num('data-w'), D = num('data-d'), S = num('data-s')
  const DUR = num('data-dur') || 0.18
  const nums = (el: Element, a: string) => (el.getAttribute(a) || '').split(' ').map(Number)

  const sheets: Sheet[] = Array.from(svg.querySelectorAll<SVGGraphicsElement>('.wc-s')).map((el) => ({
    el,
    c: el.querySelector<SVGElement>('.wc-c'),
    k: nums(el, 'data-k'),
    f: nums(el, 'data-f'),
    t0: Number(el.getAttribute('data-t')),
    end: el.getAttribute('transform') || '',
    last: '',
    drop: 0,
    op: -1,
    cop: -1,
  }))
  // Blöcke: Deckfläche und Körper wachsen mit den landenden Blättern (Deckfläche und Clip werden verschoben)
  const blocks: Block[] = Array.from(svg.querySelectorAll<SVGGElement>('.wc-blk')).map((g) => {
    const cp = svg.querySelector('#wc-k' + g.getAttribute('data-b'))
    const path = (cp?.firstElementChild as SVGElement | null) ?? null
    const cap = g.querySelector<SVGElement>('.wc-cap')
    return {
      path,
      cap,
      capEnd: cap ? cap.getAttribute('transform') || '' : '',
      h: path ? Number(path.getAttribute('data-h')) : 0,
      list: sheets.filter((s) => s.el.parentNode === g),
      last: '',
      capLast: '',
      capOp: -1,
    }
  })
  const timed = (sel: string): Timed[] =>
    Array.from(svg.querySelectorAll<SVGElement>(sel)).map((el) => ({
      el,
      a: Number(el.getAttribute('data-t0')),
      b: Number(el.getAttribute('data-t1')),
      last: -1,
    }))
  const draws = timed('.wc-draw')
  const fades = timed('.wc-fade')

  function vis(sh: Sheet, t: number) {
    const o = t >= 1 ? 0 : 1
    const co = sh.c ? fx(1 - smooth(clamp((t - 0.15) / 0.35))) : 0
    if (o !== sh.op) {
      sh.el.style.opacity = String(o)
      sh.op = o
    }
    if (sh.c && co !== sh.cop) {
      sh.c.style.opacity = String(co)
      sh.cop = co
    }
  }
  // Flug eines Blatts: gleitet zur Schwebeposition über seinem Platz, legt sich dabei flach, dann senkt es sich ab
  function place(sh: Sheet, t: number) {
    vis(sh, t)
    if (t >= 1) {
      sh.drop = 1
      if (sh.last !== sh.end) {
        sh.el.setAttribute('transform', sh.end)
        sh.last = sh.end
      }
      return
    }
    t = t < 0 ? 0 : t
    const k = sh.k, f = sh.f
    let X: number, Y: number, Z: number, r: number, sc: number
    if (t < HOVER) {
      const a = ease(t / HOVER), g = ease(clamp(t / HOVER)), gs = ease(clamp(t / 0.6))
      X = k[0] + (f[0] - k[0]) * a
      Y = k[1] + (f[1] - k[1]) * a
      Z = k[2] + (f[2] + LIFT - k[2]) * a + 14 * Math.sin(Math.PI * a)
      r = 1 - g
      sc = k[6] + (1 - k[6]) * gs
      sh.drop = 0
    } else {
      const d = smooth((t - HOVER) / (1 - HOVER))
      X = f[0]
      Y = f[1]
      Z = f[2] + LIFT * (1 - d)
      r = 0
      sc = 1
      sh.drop = d
    }
    const e1 = rot(W * sc, 0, 0, k[3] * r * RAD, k[4] * r * RAD, k[5] * r * RAD)
    const e2 = rot(0, D * sc, 0, k[3] * r * RAD, k[4] * r * RAD, k[5] * r * RAD)
    const cx = X - e1[0] / 2 - e2[0] / 2, cy = Y - e1[1] / 2 - e2[1] / 2, cz = Z - e1[2] / 2 - e2[2] / 2
    const m =
      'matrix(' + fx(e1[0] - e1[1] * C) + ' ' + fx(-e1[2] - e1[1] * C) + ' ' + fx(e2[0] - e2[1] * C) + ' ' + fx(-e2[2] - e2[1] * C) + ' ' +
      fx(OX + cx - cy * C) + ' ' + fx(OY - cz - cy * C) + ')'
    if (m !== sh.last) {
      sh.el.setAttribute('transform', m)
      sh.last = m
    }
  }
  const local = (o: Timed, q: number) => clamp((q - o.a) / (o.b - o.a))

  let p = 1
  let live = false
  function render(q: number) {
    p = q
    for (const sheet of sheets) place(sheet, (q - sheet.t0) / DUR)
    for (const bl of blocks) {
      if (!bl.path) continue
      let z = 0
      for (const s of bl.list) z += S * s.drop
      const done = z >= bl.h - 1e-3
      const tr = 'translate(0 ' + fx(0.7 - z) + ')'
      if (tr !== bl.last) {
        bl.path.setAttribute('transform', tr)
        bl.last = tr
      }
      if (bl.cap) {
        const ct = done ? bl.capEnd : 'translate(0 ' + fx(-z) + ')'
        const co = z > 0.3 ? 1 : 0
        if (ct !== bl.capLast) {
          bl.cap.setAttribute('transform', ct)
          bl.capLast = ct
        }
        if (co !== bl.capOp) {
          bl.cap.style.opacity = String(co)
          bl.capOp = co
        }
      }
    }
    for (const o of fades) {
      const v = fx(ease(local(o, q)))
      if (v !== o.last) {
        o.el.style.opacity = String(v)
        o.last = v
      }
    }
    for (const o of draws) {
      const v = fx(1 - ease(local(o, q)))
      if (v !== o.last) {
        o.el.style.strokeDashoffset = String(v)
        o.el.style.opacity = v > 0.999 ? '0' : '1'
        o.last = v
      }
    }
    // Absätze: erst der Schmerz, dann die Ordnung (stetig an den Fortschritt gekoppelt)
    const e = smooth(clamp((q - 0.3) / 0.4))
    const span = 1 - TEXT_MIN_OPACITY
    if (p1) p1.style.opacity = String(fx(1 - span * e))
    if (p2) p2.style.opacity = String(fx(TEXT_MIN_OPACITY + span * e))
  }

  // Fortschritt aus der Scrollposition. Ab 1000 px Breite steht der Abschnitt kurz (60vh Zusatzstrecke), sonst nie.
  let vh = 0
  let pin = false
  function measure() {
    vh = window.innerHeight
    const want = live && window.innerWidth >= 1000
    // Die Höhe der Bühne hängt nicht am Anpinnen (sticky ändert die eigene Höhe nicht). Deshalb nicht erst lösen und
    // wieder anpinnen wie im Entwurf: Das kurze Schrumpfen der Seite verschiebt per Scroll-Anchoring die Position
    // (etwa bei /lp-v3#ablauf nach dem Laden oder beim Ändern der Fenstergröße).
    const h = stage!.offsetHeight
    pin = want && h + 150 <= vh
    if (pin) {
      if (sec.style.getPropertyValue('--wc-h') !== h + 'px') sec.style.setProperty('--wc-h', h + 'px')
      sec.setAttribute('data-pin', '')
    } else sec.removeAttribute('data-pin')
  }
  function progress() {
    if (pin) {
      const t = track!.getBoundingClientRect().top
      const h = stage!.offsetHeight
      const top = parseFloat(getComputedStyle(stage!).top) || 84
      const extra = track!.offsetHeight - h
      const y0 = vh - 0.95 * h, y1 = top - 0.82 * extra
      return clamp((y0 - t) / (y0 - y1))
    }
    // ohne Anpinnen: Start, wenn die Zeichnung ganz im Bild ist, fertig, wenn ihre Oberkante bei 16 % steht
    const r = svg.getBoundingClientRect()
    let a = vh - 20 - r.height
    const b = Math.max(0.16 * vh, 70)
    if (a - b < 260) a = b + 260
    return clamp((a - r.top) / (a - b))
  }
  let frame = 0
  function tick() {
    frame = 0
    const q = progress()
    if (Math.abs(q - p) > 1e-4) render(q)
  }
  function onScroll() {
    if (!frame) frame = window.requestAnimationFrame(tick)
  }
  function onResize() {
    measure()
    onScroll()
  }

  function start() {
    if (live) return
    live = true
    sec.setAttribute('data-live', '')
    const scrollBefore = document.documentElement.scrollHeight
    measure()
    p = -1
    render(progress())
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })
    // Die Zusatzstrecke verschiebt alles darunter. Kam die Seite mit Anker (etwa /lp-v3#preis), das Ziel neu ansteuern.
    if (document.documentElement.scrollHeight !== scrollBefore) realignHash()
  }
  function realignHash() {
    const id = window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : ''
    if (!id || window.scrollY <= 0) return
    const target = document.getElementById(id)
    if (!target || !(sec.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING)) return
    target.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior })
  }
  function stop() {
    if (!live) return
    live = false
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onResize)
    if (frame) window.cancelAnimationFrame(frame)
    frame = 0
    render(1)
    sec.removeAttribute('data-live')
    sec.removeAttribute('data-pin')
    if (p1) p1.style.opacity = ''
    if (p2) p2.style.opacity = ''
  }

  if (!mq.matches) start()
  const onPref = (e: MediaQueryListEvent) => (e.matches ? stop() : start())
  mq.addEventListener('change', onPref)
  // Anders als im Entwurf (Schriften inline) laden die Schriften hier nach: danach Höhe und Anpinnen neu messen
  let disposed = false
  const remeasure = () => {
    if (!disposed && live) onResize()
  }
  window.addEventListener('load', remeasure)
  document.fonts?.ready.then(remeasure)

  return () => {
    disposed = true
    mq.removeEventListener('change', onPref)
    window.removeEventListener('load', remeasure)
    stop()
  }
}

export function WarumMotion() {
  useEffect(() => {
    const sec = document.getElementById('warum')
    const svg = document.getElementById('wc-plan')
    if (!sec || !(svg instanceof SVGSVGElement)) return
    return startWarum(sec, svg)
  }, [])
  return null
}
