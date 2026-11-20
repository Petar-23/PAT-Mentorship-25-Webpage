// Generated PAT Mentorship module covers in the PAT Dark Architekt style.
// Shared drawing logic with the iOS app (mobile/src/Art.tsx): drafting sheet, cream line work,
// red hatching on the core object, title block. Deterministic per module id.
import { useId, type ReactNode } from 'react'

const cream = '#ECE4D8';
const grey = '#9AA2A7';
const red = '#DE7461';
const ink = '#0E1316';

export type Motif = 'foundation' | 'structure' | 'calendar' | 'tape' | 'zone' | 'compass';

function hash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number) {
  let s = seed || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

function clip(text: string, n: number) { return text.length > n ? text.slice(0, n - 1) + '…' : text; }

const motifs: Motif[] = ['foundation', 'structure', 'calendar', 'tape', 'zone', 'compass'];

/** Picks the drawing for a course from its name, falling back to a stable choice. */
export function motifFor(name: string, key: string): Motif {
  const n = name.toLowerCase();
  if (/core|kern|basis|grundlag|fundament/.test(n)) return 'foundation';
  if (/advanced|fortgeschritt|profi|master/.test(n)) return 'structure';
  if (/model|setup|strateg/.test(n)) return 'zone';
  if (/daily|täglich|tages/.test(n)) return 'tape';
  if (/weekly|review|woche|monat|januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember/.test(n)) return 'calendar';
  if (/live|tape|session|stream/.test(n)) return 'tape';
  if (/fvg|gap|order ?block|zone|liquid/.test(n)) return 'zone';
  if (/psych|mindset|plan|risk|risiko|algo|indikator|code/.test(n)) return 'compass';
  return motifs[hash(key) % motifs.length];
}

type DrawProps = { r: () => number; W: number; H: number };

let hatchSeq = 0;
function Hatch({ x, y, w, h, id, accent = true }: { x: number; y: number; w: number; h: number; id?: string; accent?: boolean }) {
  // Drawn as clipped 45° lines: SVG patterns with transforms are unreliable in react-native-svg.
  const clip = (id ?? 'hz') + 'z' + (hatchSeq++);
  const stroke = accent ? red : cream;
  const lines = [];
  for (let d = -h; d < w; d += 7) lines.push(<line key={d} x1={x + d} y1={y + h} x2={x + d + h} y2={y} stroke={stroke} strokeWidth={1} opacity={accent ? .85 : .45}/>);
  return <g>
    <defs><clipPath id={clip}><rect x={x} y={y} width={w} height={h}/></clipPath></defs>
    <rect x={x} y={y} width={w} height={h} fill={ink}/>
    <g clipPath={`url(#${clip})`}>{lines}</g>
    <rect x={x} y={y} width={w} height={h} fill="none" stroke={stroke} strokeWidth={1.6}/>
  </g>;
}

function Dim({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const vertical = x1 === x2;
  const a = 5;
  return <g>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={grey} strokeWidth={1}/>
    {vertical ? <>
      <path d={`M${x1 - a} ${y1 + a} L${x1} ${y1} L${x1 + a} ${y1 + a}`} stroke={grey} fill="none" strokeWidth={1}/>
      <path d={`M${x2 - a} ${y2 - a} L${x2} ${y2} L${x2 + a} ${y2 - a}`} stroke={grey} fill="none" strokeWidth={1}/>
    </> : <>
      <path d={`M${x1 + a} ${y1 - a} L${x1} ${y1} L${x1 + a} ${y1 + a}`} stroke={grey} fill="none" strokeWidth={1}/>
      <path d={`M${x2 - a} ${y2 - a} L${x2} ${y2} L${x2 - a} ${y2 + a}`} stroke={grey} fill="none" strokeWidth={1}/>
    </>}
  </g>;
}

/** Core Content: a foundation section — footing, hatched slab, pillars carrying a beam. */
function Foundation({ r, W, H, id }: DrawProps & { id: string }) {
  const base = H - 62, left = 70, right = W - 150;
  const pillars = 3 + Math.floor(r() * 3);
  const span = (right - left) / (pillars - 1);
  const top = 70 + r() * 30;
  return <g>
    <line x1={left - 30} y1={base + 22} x2={right + 30} y2={base + 22} stroke={cream} strokeWidth={1.4}/>
    <Hatch x={left - 18} y={base} w={right - left + 36} h={20} id={id}/>
    {Array.from({ length: pillars }, (_, i) => {
      const x = left + i * span;
      return <g key={i}>
        <rect x={x - 9} y={top + 16} width={18} height={base - top - 16} fill={ink} stroke={cream} strokeWidth={1.4}/>
        <line x1={x} y1={top + 16} x2={x} y2={base} stroke={cream} strokeWidth={.6} opacity={.45} strokeDasharray="3 4"/>
      </g>;
    })}
    <rect x={left - 24} y={top} width={right - left + 48} height={16} fill={ink} stroke={cream} strokeWidth={1.4}/>
    <Dim x1={right + 44} y1={top} x2={right + 44} y2={base + 20}/>
    <circle cx={left + span} cy={base + 10} r={3} fill={cream}/>
    <line x1={left + span} y1={base + 10} x2={left + span + 46} y2={base - 26} stroke={cream} strokeWidth={1}/>
  </g>;
}

/** Advanced: nested timeframes — three frames stepping in, with a hatched core box. */
function Structure({ r, W, H, id }: DrawProps & { id: string }) {
  const x0 = 60, y0 = 56, w0 = W - 230, h0 = H - 120;
  const s1 = .62 + r() * .1, s2 = .36 + r() * .08;
  const boxes = [1, s1, s2].map((s, i) => {
    const w = w0 * s, h = h0 * s;
    return { x: x0 + (w0 - w) * (.55 + i * .05), y: y0 + (h0 - h) * (.35 + i * .1), w, h };
  });
  return <g>
    {boxes.slice(0, 2).map((b, i) => <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill="none" stroke={cream} strokeWidth={1.4} opacity={i === 0 ? .7 : 1}/>)}
    <Hatch x={boxes[2].x} y={boxes[2].y} w={boxes[2].w} h={boxes[2].h} id={id}/>
    {boxes.slice(0, 2).map((b, i) => {
      const n = boxes[i + 1];
      return <g key={'l' + i} opacity={.6}>
        <line x1={b.x + b.w} y1={b.y} x2={n.x + n.w} y2={n.y} stroke={grey} strokeWidth={1} strokeDasharray="4 4"/>
        <line x1={b.x + b.w} y1={b.y + b.h} x2={n.x + n.w} y2={n.y + n.h} stroke={grey} strokeWidth={1} strokeDasharray="4 4"/>
      </g>;
    })}
    <Dim x1={boxes[0].x} y1={boxes[0].y + boxes[0].h + 16} x2={boxes[0].x + boxes[0].w} y2={boxes[0].y + boxes[0].h + 16}/>
  </g>;
}

/** Weekly / monthly reviews: a five-day sheet with one hatched day and the week's path. */
function Calendar({ r, W, H, id }: DrawProps & { id: string }) {
  const x0 = 56, y0 = 62, cols = 5, cw = (W - 220) / cols, ch = H - 128;
  const pick = Math.floor(r() * cols);
  const pts = Array.from({ length: cols + 1 }, (_, i) => [x0 + i * cw, y0 + ch * (.25 + r() * .55)]);
  return <g>
    {Array.from({ length: cols }, (_, i) => i === pick ?
      <Hatch key={i} x={x0 + i * cw} y={y0} w={cw} h={ch} id={id}/> :
      <rect key={i} x={x0 + i * cw} y={y0} width={cw} height={ch} fill={ink} fillOpacity={.6} stroke={cream} strokeWidth={1.2} opacity={.8}/>)}
    <path d={'M' + pts.map(p => p.join(' ')).join(' L')} stroke={cream} strokeWidth={1.8} fill="none"/>
    {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={2.6} fill={i === pick || i === pick + 1 ? red : cream}/>)}
    <Dim x1={x0} y1={y0 + ch + 16} x2={x0 + cols * cw} y2={y0 + ch + 16}/>
  </g>;
}

/** Live / tape reading: a time axis with tick marks, outlined candles and a red session marker. */
function Tape({ r, W, H, id }: DrawProps & { id: string }) {
  const x0 = 56, x1 = W - 170, mid = H / 2 + 6;
  const n = 11;
  const step = (x1 - x0) / n;
  let p = mid;
  const marker = 3 + Math.floor(r() * (n - 5));
  return <g>
    <Hatch x={x0 + marker * step - 4} y={52} w={step * 2 + 8} h={H - 116} id={id} accent/>
    <line x1={x0} y1={H - 52} x2={x1} y2={H - 52} stroke={cream} strokeWidth={1.2}/>
    {Array.from({ length: n + 1 }, (_, i) => <line key={'t' + i} x1={x0 + i * step} y1={H - 52} x2={x0 + i * step} y2={H - (i % 3 === 0 ? 62 : 57)} stroke={cream} strokeWidth={1}/>)}
    {Array.from({ length: n }, (_, i) => {
      const o = p, c = p + (r() - .5) * 46;
      p = Math.min(H - 80, Math.max(70, c));
      const hi = Math.min(o, c) - 6 - r() * 12, lo = Math.max(o, c) + 6 + r() * 12;
      const x = x0 + i * step + step / 2;
      const bear = c > o;
      return <g key={i}>
        <line x1={x} y1={hi} x2={x} y2={lo} stroke={cream} strokeWidth={1.2}/>
        <rect x={x - step * .26} y={Math.min(o, c)} width={step * .52} height={Math.max(3, Math.abs(c - o))} fill={bear ? grey : ink} fillOpacity={bear ? .55 : 1} stroke={cream} strokeWidth={1.2}/>
      </g>;
    })}
  </g>;
}

/** Zones / concepts: the FVG construction — three candles and a hatched gap with CE line. */
function Zone({ r, W, H, id }: DrawProps & { id: string }) {
  const cx = 70, gapTop = 96 + r() * 20, gapBot = gapTop + 42 + r() * 16;
  const cw = 30, gap = 64;
  return <g>
    <Hatch x={cx - 10} y={gapTop} w={W - 250} h={gapBot - gapTop} id={id}/>
    <line x1={cx - 10} y1={(gapTop + gapBot) / 2} x2={cx - 10 + W - 250} y2={(gapTop + gapBot) / 2} stroke={cream} strokeDasharray="3 4" strokeWidth={.8} opacity={.6}/>
    <line x1={cx + cw / 2} y1={gapBot} x2={cx + cw / 2} y2={gapBot + 24} stroke={cream} strokeWidth={1.2}/>
    <rect x={cx} y={gapBot + 24} width={cw} height={30} fill={ink} stroke={cream} strokeWidth={1.4}/>
    <rect x={cx + gap} y={gapTop - 34} width={cw} height={gapBot - gapTop + 88} fill={ink} stroke={cream} strokeWidth={1.4}/>
    <line x1={cx + gap * 2 + cw / 2} y1={gapTop} x2={cx + gap * 2 + cw / 2} y2={gapTop - 28} stroke={cream} strokeWidth={1.2}/>
    <rect x={cx + gap * 2} y={gapTop - 62} width={cw} height={30} fill={ink} stroke={cream} strokeWidth={1.4}/>
    <Dim x1={cx - 26} y1={gapTop} x2={cx - 26} y2={gapBot}/>
  </g>;
}

/** Mindset / planning: a compass rose with range rings and a red bearing. */
function Compass({ r, W, H, id }: DrawProps & { id: string }) {
  const cx = (W - 150) / 2 + 20, cy = H / 2 + 2, R = H / 2 - 50;
  const angle = r() * Math.PI * 2;
  return <g>
    {[1, .7, .4].map((k, i) => <circle key={i} cx={cx} cy={cy} r={R * k} fill="none" stroke={cream} strokeWidth={i === 0 ? 1.4 : 1} opacity={i === 0 ? 1 : .6}/>)}
    <line x1={cx - R - 18} y1={cy} x2={cx + R + 18} y2={cy} stroke={grey} strokeWidth={1}/>
    <line x1={cx} y1={cy - R - 18} x2={cx} y2={cy + R + 18} stroke={grey} strokeWidth={1}/>
    <path d={`M${cx} ${cy} L${cx + Math.cos(angle) * R} ${cy + Math.sin(angle) * R}`} stroke={red} strokeWidth={2}/>
    <circle cx={cx + Math.cos(angle) * R} cy={cy + Math.sin(angle) * R} r={4} fill={red}/>
    <Hatch x={cx - R * .28} y={cy - R * .28} w={R * .56} h={R * .56} id={id}/>
  </g>;
}

const drawings: Record<Motif, (p: DrawProps & { id: string }) => ReactNode> = {
  foundation: Foundation, structure: Structure, calendar: Calendar, tape: Tape, zone: Zone, compass: Compass,
};

const fonts = {
  mono: "var(--font-geist-mono), ui-monospace, 'SFMono-Regular', monospace",
  serif: "var(--font-mentorship-serif, Georgia), 'Times New Roman', serif",
}

export function ModuleCover({ seed, motif, index, code, title, compact = false, className }: {
  seed: string; motif: Motif; index?: string | null; code?: string; title?: string; compact?: boolean; className?: string
}) {
  const W = 400, H = 250
  const id = 'mc' + useId().replace(/[^a-zA-Z0-9]/g, '')
  hatchSeq = 0
  const art = drawings[motif]({ r: rng(hash(seed)), W, H, id: id + 'h' })
  return <svg className={className} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true"
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}>
    <defs>
      <radialGradient id={id + 'r'} cx="55%" cy="42%" r="80%">
        <stop offset="0" stopColor="#172025"/>
        <stop offset=".55" stopColor="#0F1518"/>
        <stop offset="1" stopColor="#0A0E10"/>
      </radialGradient>
      <clipPath id={id + 'c'}><rect x={14} y={14} width={W - 28} height={H - 28}/></clipPath>
    </defs>
    <rect width={W} height={H} fill={`url(#${id}r)`}/>
    {!compact ? <g>
      {Array.from({ length: Math.ceil(W / 12) }, (_, i) => <line key={'fv' + i} x1={i * 12} y1={0} x2={i * 12} y2={H} stroke="rgba(251,241,231,0.045)" strokeWidth={.6}/>)}
      {Array.from({ length: Math.ceil(H / 12) }, (_, i) => <line key={'fh' + i} x1={0} y1={i * 12} x2={W} y2={i * 12} stroke="rgba(251,241,231,0.045)" strokeWidth={.6}/>)}
      {Array.from({ length: Math.ceil(W / 60) }, (_, i) => <line key={'cv' + i} x1={i * 60} y1={0} x2={i * 60} y2={H} stroke="rgba(251,241,231,0.085)" strokeWidth={.8}/>)}
      {Array.from({ length: Math.ceil(H / 60) }, (_, i) => <line key={'ch' + i} x1={0} y1={i * 60} x2={W} y2={i * 60} stroke="rgba(251,241,231,0.085)" strokeWidth={.8}/>)}
    </g> : null}
    <rect x={8} y={8} width={W - 16} height={H - 16} fill="none" stroke={cream} strokeOpacity={.28} strokeWidth={1.2}/>
    <rect x={14} y={14} width={W - 28} height={H - 28} fill="none" stroke={cream} strokeOpacity={.16} strokeWidth={.8}/>
    <g clipPath={`url(#${id}c)`}>{art}</g>
    {!compact ? <g>
      <rect x={W - 150} y={H - 62} width={134} height={46} fill="#0E1316" fillOpacity={.92} stroke={cream} strokeWidth={1}/>
      <line x1={W - 150} y1={H - 47} x2={W - 16} y2={H - 47} stroke={cream} strokeWidth={.8}/>
      <line x1={W - 150} y1={H - 32} x2={W - 16} y2={H - 32} stroke={cream} strokeWidth={.8}/>
      <text x={W - 144} y={H - 51} fill={cream} fontFamily={fonts.mono} fontSize={6.2} style={{ letterSpacing: '.3px' }}>PRICE ACTION TRADER · MENTORSHIP</text>
      <text x={W - 144} y={H - 36} fill={cream} fontFamily={fonts.mono} fontSize={8} style={{ letterSpacing: '.6px' }}>{'DWG ' + (code ?? 'M-01')}</text>
      <text x={W - 144} y={H - 21} fill={grey} fontFamily={fonts.mono} fontSize={8} style={{ letterSpacing: '.6px' }}>{clip((title ?? '').toUpperCase(), 24)}</text>
    </g> : null}
    {index ? <text x={compact ? 28 : 30} y={compact ? 62 : 70} fill={cream} fontFamily={fonts.serif} fontWeight={600} fontSize={compact ? 46 : 52} style={{ letterSpacing: '-1.5px' }}>{index}</text> : null}
  </svg>
}

/** "01 - Core Content" → { number: '01', title: 'Core Content' } */
export function splitModuleName(name: string) {
  const m = /^\s*(\d{1,3})\s*[-–.:]\s*(.+)$/.exec(name)
  return m ? { number: m[1].padStart(2, '0'), title: m[2] } : { number: null, title: name }
}
