'use client'

import { useEffect } from 'react'

/**
 * Lehrplan: das 12-Monats-Lineal zeichnet sich beim Durchscrollen, die erreichte Phase wird aktiv und ihre Zeichnung entsteht.
 * Nie angepinnt, kein Eingriff ins Scrollen. Ohne JS und bei reduzierter Bewegung bleibt der fertige Zustand stehen.
 */

type Timed = { el: SVGElement; a: number; b: number; last: number }
type PhaseText = { el: HTMLElement; k: number; n: number; thr: number; on: boolean | null }
type Phase = {
  li: HTMLElement
  i: number
  rule: HTMLElement
  prog: HTMLElement
  dot: HTMLElement
  sl: HTMLElement | null
  end: HTMLElement | null
  mo: HTMLElement[]
  fig: HTMLElement
  draws: Timed[]
  fades: Timed[]
  texts: PhaseText[]
  len: number
  fT: number
  fH: number
  c: Record<string, string>
}

// waagerecht: Lineal fertig bei RULER; Zeichnung i entsteht zwischen STEP*i - LEAD und STEP*i - LEAD + WIN (überlappend)
const RULER = 0.9, STEP = 0.225, LEAD = 0.1, WIN = 0.42, READ = 0.66

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(2 - 2 * t, 3) / 2)
const fx = (v: number) => Math.round(v * 1000) / 1000

function startLehrplan(root: HTMLElement): () => void {
  const mqR = window.matchMedia('(prefers-reduced-motion: reduce)')
  const mqV = window.matchMedia('(max-width: 1199px)')
  const all = <T extends Element>(el: Element, sel: string) => Array.from(el.querySelectorAll<T>(sel))
  const timed = (el: Element, sel: string): Timed[] =>
    all<SVGElement>(el, sel).map((e) => ({ el: e, a: Number(e.getAttribute('data-t0')), b: Number(e.getAttribute('data-t1')), last: -1 }))

  const phases: Phase[] = []
  all<HTMLElement>(root, '.lz-ph').forEach((li, i) => {
    const q = <T extends Element>(s: string) => li.querySelector<T>(s)
    const rule = q<HTMLElement>('.lz-rule'), prog = q<HTMLElement>('.lz-prog'), dot = q<HTMLElement>('.lz-dot'), fig = q<HTMLElement>('.lz-fig')
    if (!rule || !prog || !dot || !fig) return
    const items = all<HTMLElement>(li, '.lz-body li')
    phases.push({
      li,
      i,
      rule,
      prog,
      dot,
      fig,
      sl: q<HTMLElement>('.lz-sl:not(.lz-end)'),
      end: q<HTMLElement>('.lz-end'),
      mo: all<HTMLElement>(li, '.lz-mo'),
      draws: timed(li, '.lz-dw'),
      fades: timed(li, '.lz-fd'),
      texts: all<HTMLElement>(li, '.lz-t').map((el) => ({ el, k: items.indexOf(el), n: items.length, thr: 0, on: null })),
      len: 0,
      fT: 0,
      fH: 1,
      c: {},
    })
  })
  if (!phases.length) return () => {}

  let p = 1, m = 12, live = false, vert = false, vh = 0

  function set(ph: Phase, key: string, el: HTMLElement, prop: 'transform' | 'opacity', v: string) {
    if (ph.c[key] !== v) {
      el.style[prop] = v
      ph.c[key] = v
    }
  }
  function drawOf(ph: Phase, loc: number) {
    // waagerecht: fester, überlappender Abschnitt je Zeichnung; senkrecht: an die Lage der Zeichnung im Fenster gekoppelt
    if (!vert) return clamp((p - (STEP * ph.i - LEAD)) / WIN)
    const o = Math.max(0, ph.fT - 0.08)
    return clamp((loc - o) / Math.max(0.2, Math.min(1 - o, ph.fH * 0.8)))
  }
  function render(q: number) {
    p = q
    m = 12 * (vert ? clamp(q) : clamp(q / RULER))
    const act = Math.min(3, Math.floor(m / 3 + 1e-6))
    for (const ph of phases) {
      const i = ph.i
      const loc = clamp((m - 3 * i) / 3)
      set(ph, 'pr', ph.prog, 'transform', (vert ? 'scaleY(' : 'scaleX(') + fx(loc) + ')')
      set(ph, 'dt', ph.dot, 'transform', (vert ? 'translateY(' : 'translateX(') + fx(loc * ph.len) + 'px)')
      set(ph, 'do', ph.dot, 'opacity', i === act ? '1' : '0')
      if (ph.sl) set(ph, 'sl', ph.sl, 'opacity', m >= 3 * i - 1e-6 ? '1' : '0')
      if (ph.end) set(ph, 'en', ph.end, 'opacity', m >= 12 - 1e-6 ? '1' : '0')
      ph.mo.forEach((el, k) => set(ph, 'm' + k, el, 'opacity', loc >= (k + 1) / 3 - 1e-6 ? '1' : '0'))
      for (const t of ph.texts) {
        // die erste Phase steht von Anfang an voll da; kommende Phasen werden aktiv, sobald das Lineal sie erreicht
        const on =
          i === 0 && !vert
            ? true
            : vert
              ? (i === 0 && t.k < 0) || (m >= 3 * i - 1e-6 && loc >= t.thr)
              : m >= 3 * i + (t.k < 0 ? -1e-6 : 0.15 + (t.k * 2.1) / t.n)
        if (on !== t.on) {
          t.el.toggleAttribute('data-on', on)
          t.on = on
        }
      }
      const s = drawOf(ph, loc)
      for (const o of ph.draws) {
        const v = fx(1 - ease(clamp((s - o.a) / (o.b - o.a))))
        if (v !== o.last) {
          o.el.style.strokeDashoffset = String(v)
          o.el.style.opacity = v > 0.999 ? '0' : '1'
          o.last = v
        }
      }
      for (const o of ph.fades) {
        const v = fx(ease(clamp((s - o.a) / (o.b - o.a))))
        if (v !== o.last) {
          o.el.style.opacity = String(v)
          o.last = v
        }
      }
    }
  }

  // Maße: waagerechtes Lineal ab 1200 px, darunter senkrecht
  function measure() {
    vh = window.innerHeight
    vert = mqV.matches
    for (const ph of phases) {
      ph.len = vert ? ph.rule.offsetHeight : ph.rule.offsetWidth
      if (!vert) continue
      const r = ph.li.getBoundingClientRect()
      const top = r.top + ph.rule.offsetTop
      const span = Math.max(1, r.height - ph.rule.offsetTop)
      for (const t of ph.texts) t.thr = (t.el.getBoundingClientRect().top - top) / span - 0.02
      const fr = ph.fig.getBoundingClientRect()
      ph.fT = (fr.top - top) / span
      ph.fH = fr.height / span
    }
    for (const ph of phases) {
      ph.c = {}
      for (const t of ph.texts) t.on = null
    }
  }
  function progress() {
    if (vert) {
      // Leselinie bei zwei Dritteln der Fensterhöhe: das Lineal reicht bis dorthin
      const y = READ * vh
      let sum = 0
      for (const ph of phases) {
        const r = ph.li.getBoundingClientRect()
        const top = r.top + ph.rule.offsetTop
        sum += clamp((y - top) / Math.max(1, r.height - ph.rule.offsetTop))
      }
      return sum / phases.length
    }
    // waagerecht: Start, wenn die Zeichnungsreihe unten ins Bild kommt, fertig, wenn sie oben unter der Navigation steht
    const r = phases[0].fig.getBoundingClientRect()
    let a = vh - 70
    const b = Math.max(84, 0.18 * vh)
    if (a - b < 320) a = b + 320
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
    if (!live) return
    measure()
    p = -1
    onScroll()
  }

  function start() {
    if (live) return
    live = true
    root.setAttribute('data-live', '')
    measure()
    p = -1
    render(progress())
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })
  }
  function stop() {
    if (!live) return
    live = false
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onResize)
    if (frame) window.cancelAnimationFrame(frame)
    frame = 0
    root.removeAttribute('data-live')
    for (const ph of phases) {
      for (const el of [ph.prog, ph.dot, ph.sl, ph.end, ...ph.mo]) {
        if (el) {
          el.style.transform = ''
          el.style.opacity = ''
        }
      }
      for (const o of [...ph.draws, ...ph.fades]) {
        o.el.style.strokeDashoffset = ''
        o.el.style.opacity = ''
        o.last = -1
      }
      for (const t of ph.texts) {
        t.el.removeAttribute('data-on')
        t.on = null
      }
      ph.c = {}
    }
    p = 1
  }

  if (!mqR.matches) start()
  const onMotionPref = (e: MediaQueryListEvent) => (e.matches ? stop() : start())
  mqR.addEventListener('change', onMotionPref)
  mqV.addEventListener('change', onResize)
  // Schriften und Bilder verändern die Höhen: danach neu messen
  let disposed = false
  window.addEventListener('load', onResize)
  document.fonts?.ready.then(() => {
    if (!disposed) onResize()
  })

  return () => {
    disposed = true
    mqR.removeEventListener('change', onMotionPref)
    mqV.removeEventListener('change', onResize)
    window.removeEventListener('load', onResize)
    stop()
  }
}

export function LehrplanMotion() {
  useEffect(() => {
    const root = document.getElementById('lehrplan-zeit')
    if (!root) return
    return startLehrplan(root)
  }, [])
  return null
}
