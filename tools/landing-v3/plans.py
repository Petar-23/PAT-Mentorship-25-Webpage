# Architektenzeichnungen für die Ladenfront als Inline-SVG.
# Klassen: l = Objektlinie (zeichnet sich), t = dünne Maß- und Hilfslinie (zeichnet sich),
# h = Schraffur, d = gestrichelt, dd = Strich-Punkt-Achse, f = gefüllt, a/af/at = Akzent.
import math, os

# Ausgabeordner für die Einzel-SVGs. export_drawings.py setzt ihn auf ein temporäres Verzeichnis.
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'plans')


def f(v):
    s = ('%.2f' % v).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def tick(x, y, k=3.4):
    return f'M{f(x - k)} {f(y + k)}L{f(x + k)} {f(y - k)}'


def circle(cx, cy, r):
    return f'M{f(cx - r)} {f(cy)}a{f(r)} {f(r)} 0 1 0 {f(2 * r)} 0a{f(r)} {f(r)} 0 1 0 {f(-2 * r)} 0'


class Plan:
    def __init__(s, name, w, h, label=None, extra=''):
        s.name, s.w, s.h, s.label, s.extra = name, w, h, label, extra
        s.body, s.defs = [], []

    def p(s, d, cls='l', dl=0.0, attrs=''):
        a = f'<path class="{cls}" d="{d}"'
        if cls.split()[0] in ('l', 't'):
            a += ' pathLength="1"'
        if dl:
            a += f' style="--dl:{dl:.2f}s"'
        s.body.append(a + attrs + '/>')

    def tx(s, x, y, txt, anchor='start', dl=0.0, cls='', rot=None):
        a = f'<text x="{f(x)}" y="{f(y)}"'
        if anchor != 'start':
            a += f' text-anchor="{anchor}"'
        if cls:
            a += f' class="{cls}"'
        if rot is not None:
            a += f' transform="rotate({rot} {f(x)} {f(y)})"'
        if dl:
            a += f' style="--dl:{dl:.2f}s"'
        s.body.append(a + f'>{txt}</text>')

    def chain_h(s, xs, y, labels=None, ext=None, dl=0.0, ldy=-6):
        s.p(f'M{f(xs[0])} {f(y)}H{f(xs[-1])}', 't', dl)
        if ext:
            s.p(''.join(f'M{f(x)} {f(ext[0])}V{f(ext[1])}' for x in xs), 't', dl)
        s.p(''.join(tick(x, y) for x in xs), 'l', dl + .25)
        for i, lab in enumerate(labels or []):
            if lab:
                s.tx((xs[i] + xs[i + 1]) / 2, y + ldy, lab, 'middle', dl + .45)

    def chain_v(s, ys, x, labels=None, ext=None, dl=0.0, ldx=-6):
        s.p(f'M{f(x)} {f(ys[0])}V{f(ys[-1])}', 't', dl)
        if ext:
            s.p(''.join(f'M{f(ext[0])} {f(y)}H{f(ext[1])}' for y in ys), 't', dl)
        s.p(''.join(tick(x, y) for y in ys), 'l', dl + .25)
        for i, lab in enumerate(labels or []):
            if lab:
                s.tx(x + ldx, (ys[i] + ys[i + 1]) / 2, lab, 'middle', dl + .45, rot=-90)

    def svg(s):
        aria = f' role="img" aria-label="{s.label}"' if s.label else ' aria-hidden="true" focusable="false"'
        defs = f'<defs>{"".join(s.defs)}</defs>' if s.defs else ''
        out = f'<svg class="plan drawable {s.extra}" id="plan-{s.name}" viewBox="0 0 {s.w} {s.h}"{aria}>{defs}{"".join(s.body)}</svg>'
        with open(os.path.join(OUT, f'plan_{s.name}.svg'), 'w') as fh:
            fh.write(out)
        return out


def candles(P, xs, data, bw, dl0, step=.05):
    """data: (open, close, high, low) als y-Werte; y wächst nach unten."""
    for i, (x, (o, c, h, l)) in enumerate(zip(xs, data)):
        dl = dl0 + i * step
        top, bot = min(o, c), max(o, c)
        P.p(f'M{f(x)} {f(h)}V{f(top)}M{f(x)} {f(bot)}V{f(l)}', 'l', dl)
        body = f'M{f(x - bw / 2)} {f(top)}H{f(x + bw / 2)}V{f(bot)}H{f(x - bw / 2)}Z'
        if c < o:   # steigend: hohl
            P.p(body, 'l', dl)
        else:       # fallend: gefüllt
            P.p(body, 'f', dl + .15)


# 1) Treppenschnitt: vier Stufen, zwölf Monate
def stairs():
    P = Plan('stairs', 560, 400, 'Schnitt durch eine Treppe mit vier Stufen: Grundlagen, Vertiefung, Anwendung, Feinschliff, je drei Monate, zusammen zwölf Monate', 'plan-lg')
    x0, w, r, base, T = 56, 110, 56, 318, 40
    xs = [x0 + w * i for i in range(5)]
    slope = r / w
    inner_x = xs[1]
    soffit_y_at = lambda x: (base - r) + T - slope * (x - inner_x)
    x_ground = inner_x + ((base - r) + T - base) / slope
    y_soffit_end = soffit_y_at(xs[4])
    land_x = xs[4] + 40
    profile = f'M{x0} {base}'
    for i in range(4):
        profile += f'V{base - r * (i + 1)}H{xs[i + 1]}'
    body = (profile + f'H{land_x}V{base - 4 * r + 10}L{land_x + 5} {base - 4 * r + 14}L{land_x - 5} {base - 4 * r + 22}'
            f'L{land_x} {base - 4 * r + 26}V{f(y_soffit_end)}H{xs[4]}L{f(x_ground)} {base}Z')
    P.defs.append(f'<clipPath id="clip-stairs"><path d="{body}"/></clipPath>')
    # Boden mit Erdschraffur
    P.p(f'M16 {base}H330', 't', 0)
    P.p(''.join(f'M{x} {base + 1}l-6 7' for x in range(24, 330, 11)), 'h', .2)
    # Schnittkörper in einem Zug
    P.p(body, 'l', .1)
    P.p(f'M{land_x} {base - 4 * r - 6}V{base - 4 * r}M{land_x} {f(y_soffit_end)}v6', 't', .9)
    # Schraffur des geschnittenen Körpers
    P.p(''.join(f'M{c} 420L{c + 420} 0' for c in range(-420, 560, 7)), 'h', 1.0, ' clip-path="url(#clip-stairs)"')
    # Lauflinie: Kreis am Antritt, Pfeil am Austritt
    sx, sy, ex = 70, 226, 400
    ey = sy - slope * (ex - sx)
    P.p(circle(sx, sy, 3.2) + f'M{f(sx + 3.2)} {f(sy - 3.2 * slope)}L{f(ex)} {f(ey)}', 'l a', .7)
    ux, uy = (ex - sx), (ey - sy)
    n = math.hypot(ux, uy); ux, uy = -ux / n, -uy / n
    wing = ''
    for ang in (24, -24):
        c, s_ = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        wx, wy = ux * c - uy * s_, ux * s_ + uy * c
        wing += f'M{f(ex)} {f(ey)}L{f(ex + 9 * wx)} {f(ey + 9 * wy)}'
    P.p(wing, 'l a', 1.5)
    # Stufenbeschriftung
    for i, name in enumerate(['GRUNDLAGEN', 'VERTIEFUNG', 'ANWENDUNG', 'FEINSCHLIFF']):
        P.tx(xs[i] + 8, base - r * (i + 1) - 11, name, dl=1.3 + i * .12)
    # Maßketten
    P.chain_h(xs, 350, ['3 MONATE'] * 4, ext=(338, 356), dl=1.0)
    P.chain_h([xs[0], xs[4]], 382, ['12 MONATE'], ext=(362, 388), dl=1.25)
    return P.svg()


# 2) Lektion: Folie im Aufriss, 16:9 bemaßt
def lesson():
    P = Plan('lesson', 280, 180)
    P.p('M24 34H256V164.5H24Z', 'l', 0)
    P.chain_h([24, 256], 20, ['16:9'], ext=(30, 15), dl=.3, ldy=-5)
    P.p('M38 50H148', 't tb', .5)
    P.p('M38 59H92', 't tb2', .6)
    P.p('M38 67H242', 't', .6)
    P.p('M38 74H242V152H38Z', 't', .7)
    xs = [54 + 17 * i for i in range(11)]
    data = [(118, 112, 108, 122), (112, 106, 102, 116), (106, 110, 104, 114), (110, 120, 108, 123),
            (120, 116, 114, 124), (118, 130, 116, 134), (130, 134, 127, 138), (134, 118, 116, 137),
            (118, 100, 96, 120), (100, 103, 98, 105), (103, 90, 86, 106)]
    candles(P, xs, data, 7, .8)
    P.p('M173 105H238V116H173Z', 'l a', 1.45)
    P.tx(238, 126, 'FVG', 'end', 1.6, 'at')
    return P.svg()


# 3) Power of 3: Akkumulation, Manipulation, Distribution und die Tageskerze daraus
def po3():
    P = Plan('po3', 280, 180)
    pts = [(20, 98), (30, 93), (40, 100), (50, 94), (60, 101), (70, 95), (82, 99), (92, 110), (106, 128),
           (118, 114), (126, 119), (138, 100), (146, 104), (160, 82), (168, 86), (184, 60), (192, 64), (204, 44), (216, 51)]
    P.p('M' + 'L'.join(f'{x} {y}' for x, y in pts), 'l', 0)
    P.p('M20 98H244', 'd a', .9)
    P.p('M204 44H246M216 51H244M106 128H246', 'd', 1.0)
    P.p('M250 44V51M250 98V128', 'l', 1.05)
    P.p('M244 51H256V98H244Z', 'l', 1.1)
    P.chain_h([20, 82, 106, 216], 158, ['A', 'M', 'D'], ext=(148, 162), dl=1.2, ldy=-6)
    P.tx(250, 158, 'TAG', 'middle', 1.5)
    P.tx(20, 22, 'POWER OF 3', dl=1.5)
    return P.svg()


# 4) Live am Markt: Raster, Kerzen, Fadenkreuz um 19:00
def live():
    P = Plan('live', 280, 180)
    P.p('M20 150H236V20', 't', 0)
    P.p(''.join(f'M236 {y}h4' for y in range(20, 151, 13)) + ''.join(f'M{x} 150v4' for x in (20, 74, 128, 182)), 't', .15)
    P.p(''.join(f'M{x} 20V150' for x in (74, 128, 182)) + ''.join(f'M20 {y}H236' for y in (46, 72, 98, 124)), 'd', .1)
    xs = [32 + 17 * i for i in range(12)]
    data = [(118, 122, 114, 126), (122, 112, 108, 124), (112, 106, 101, 115), (106, 110, 103, 113),
            (110, 100, 96, 112), (100, 92, 86, 102), (92, 98, 89, 101), (98, 103, 95, 106),
            (103, 94, 91, 105), (94, 82, 78, 96), (82, 76, 70, 85), (76, 79, 72, 81)]
    candles(P, xs, data, 7, .25, .045)
    P.p('M219 20V150M20 79H236', 'd', 1.1)
    P.p(circle(219, 79, 2.2), 'af', 1.25)
    P.p('M236 79L242 72.5H272V85.5H242Z', 'af', 1.3)
    P.tx(257, 82, 'LIVE', 'middle', 1.35, 'wt')
    P.p('M200 154H238V167H200Z', 'l a', 1.3)
    P.tx(219, 163.5, '19:00', 'middle', 1.45, 'at')
    P.tx(20, 12, 'NQ · 5 MIN', dl=1.5)
    return P.svg()


# 5) Detail 1: Anatomie einer Kerze
def candle():
    P = Plan('candle', 360, 440, 'Detailzeichnung einer Kerze mit Hoch, Schluss, Eröffnung und Tief, bemaßt nach Docht, Körper und Range')
    cx, H, C, O, L = 170, 70, 150, 300, 372
    P.p(f'M{cx} 36V406', 'dd', 0)
    P.p(f'M{cx} {H}V{C}', 'l', .15)
    P.p(f'M138 {C}H202V{O}H138Z', 'l', .35)
    P.p(f'M{cx} {O}V{L}', 'l', .75)
    P.p(f'M40 {H}H162M40 {C}H132M40 {O}H132M40 {L}H162', 't', .9)
    for y, lab in ((H, 'HOCH'), (C, 'SCHLUSS'), (O, 'ERÖFFNUNG'), (L, 'TIEF')):
        P.tx(40, y - 7, lab, dl=1.35)
    P.chain_v([H, C, O, L], 252, ['DOCHT', 'KÖRPER', 'DOCHT'], ext=(208, 258), dl=1.0)
    P.p(f'M178 {H}H208M178 {L}H208', 't', 1.0)
    P.chain_v([H, L], 306, ['RANGE'], ext=(262, 312), dl=1.2)
    P.p(circle(cx, O, 3), 'af', 1.4)
    return P.svg()


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for fn in (stairs, lesson, po3, live, candle):
        svg = fn()
        assert '–' not in svg and '—' not in svg
        print(fn.__name__, len(svg))
