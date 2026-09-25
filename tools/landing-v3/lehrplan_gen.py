# Lehrplan-Zeitachse (zeit-a-final): erzeugt section.html, nur den Zeitachsen-Teil von #lehrplan.
# Vier ICT-Linienzeichnungen im Stil der Kerzen-Detailzeichnung, je 264 x 196 Einheiten (oben beschnitten, wo leer).
# Alle vier stehen auf derselben Grundlinie (y 176) mit Beschriftung darunter (y 192).
# Am Desktop (Inhalt 1120 px) wird jede Zeichnung genau 1:1 gezeigt, Beschriftung also 11 px.
# Jedes animierte Element trägt data-t0/data-t1 (lokaler Zeichenfortschritt der Phase, 0 bis 1):
#   lz-dw = zeichnet sich (stroke-dashoffset, pathLength=1), lz-fd = blendet ein (opacity).
# y wächst nach unten (SVG). Kerzen: hohl = steigend, gefüllt = fallend (wie auf der ganzen Seite).
import math, os

H = os.path.dirname(os.path.abspath(__file__))
VW, VH = 264, 196
NB = '&#160;'


def f(v):
    s = ('%.2f' % v).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def tick(x, y, k=3.4):
    return f'M{f(x - k)} {f(y + k)}L{f(x + k)} {f(y - k)}'


def circle(cx, cy, r):
    return f'M{f(cx - r)} {f(cy)}a{f(r)} {f(r)} 0 1 0 {f(2 * r)} 0a{f(r)} {f(r)} 0 1 0 {f(-2 * r)} 0'


def hatch(x0, y0, x1, y1, step=4.2, d=1):
    """45-Grad-Schraffur, exakt auf das Rechteck beschnitten. d=1: '/', d=-1: '\\'."""
    out = []
    if d == 1:   # x + y = c
        c = x0 + y0 + step / 2
        while c < x1 + y1:
            xa, xb = max(x0, c - y1), min(x1, c - y0)
            if xb - xa > .3:
                out.append(f'M{f(xa)} {f(c - xa)}L{f(xb)} {f(c - xb)}')
            c += step
    else:        # x - y = c
        c = x0 - y1 + step / 2
        while c < x1 - y0:
            xa, xb = max(x0, c + y0), min(x1, c + y1)
            if xb - xa > .3:
                out.append(f'M{f(xa)} {f(xa - c)}L{f(xb)} {f(xb - c)}')
            c += step
    return ''.join(out)


class Plan:
    def __init__(s, label, y0=0):
        # y0: oberer Beschnitt der viewBox (kein leerer Rand über der Zeichnung, v. a. am Handy)
        s.label, s.body, s.y0 = label, [], y0

    def p(s, d, cls, t0, t1):
        k = cls.split()
        mode = 'lz-dw' if k[0] in ('l', 't') and 'nodraw' not in k else 'lz-fd'
        cls = ' '.join(c for c in k if c != 'nodraw')
        pl = ' pathLength="1"' if mode == 'lz-dw' else ''
        s.body.append(f'<path class="{cls} {mode}" d="{d}"{pl} data-t0="{t0:.3f}" data-t1="{t1:.3f}"/>')

    def tx(s, x, y, txt, t0, t1, anchor='start', rot=None):
        a = f'<text class="lz-fd" x="{f(x)}" y="{f(y)}"'
        if anchor != 'start':
            a += f' text-anchor="{anchor}"'
        if rot is not None:
            a += f' transform="rotate({rot} {f(x)} {f(y)})"'
        s.body.append(a + f' data-t0="{t0:.3f}" data-t1="{t1:.3f}">{txt}</text>')

    def candle(s, x, o, c, hi, lo, w, t0, dur=.06):
        top, bot = min(o, c), max(o, c)
        body = f'M{f(x - w / 2)} {f(top)}H{f(x + w / 2)}V{f(bot)}H{f(x - w / 2)}Z'
        # Fläche zuerst (steigend: Hintergrund, deckt Linien dahinter ab; fallend: gefüllt), dann Kontur, dann Dochte
        s.p(body, ('lz-bg' if c < o else 'f'), t0 + dur * .4, t0 + dur)
        s.p(body, 'l', t0, t0 + dur)
        wick = ''
        if hi < top - .2:
            wick += f'M{f(x)} {f(hi)}V{f(top)}'
        if lo > bot + .2:
            wick += f'M{f(x)} {f(bot)}V{f(lo)}'
        if wick:
            s.p(wick, 'l', t0 + dur * .3, t0 + dur * 1.1)

    def chain(s, cx, x_from, levels, labels, t0, lab2=None):
        """Maßkette wie an der Kerze: Hilfslinien, Kettenlinie, 45-Grad-Striche, Beschriftung gedreht links der Kette."""
        s.p(''.join(f'M{f(x_from)} {f(y)}H{f(cx + 5)}' for y in levels), 't', t0, t0 + .1)
        s.p(f'M{f(cx)} {f(levels[0])}V{f(levels[-1])}', 't', t0 + .02, t0 + .14)
        s.p(''.join(tick(cx, y) for y in levels), 'l nodraw', t0 + .12, t0 + .17)
        for j, lab in enumerate(labels):
            my = (levels[j] + levels[j + 1]) / 2
            # zweizeilig gedreht: erste Zeile (links) ist der Maßname, die zweite (an der Kette) die Ergänzung
            s.tx(cx - (19 if lab2 else 6), my, lab, t0 + .14 + .03 * j, t0 + .24 + .03 * j, 'middle', -90)
            if lab2:
                s.tx(cx - 6, my, lab2[j], t0 + .17 + .03 * j, t0 + .27 + .03 * j, 'middle', -90)

    def svg(s):
        return (f'<svg class="plan lz-plan" viewBox="0 {s.y0} {VW} {VH - s.y0}" role="img" aria-label="{s.label}">'
                + ''.join(s.body) + '</svg>')


# ---------------------------------------------------------------- 1) Grundlagen: PD Array Matrix
def matrix():
    P = Plan('PD Array Matrix: eine Dealing Range vom Swing-Tief zum Swing-Hoch, geteilt am Equilibrium bei 50 Prozent. '
             'Im Premium darüber liegen die bärischen Arrays Orderblock, FVG und Breaker, im Discount darunter die bullischen, '
             'jeweils vom Extrem zum Equilibrium in dieser Reihenfolge.')
    top, eq, bot = 16, 96, 176
    xr, zx1, cx = 192, 186, 236
    # Dealing Range: das Gerüst steht schon zu Beginn (Fortschritt 0 zeigt Hoch, Tief und ihre Namen)
    P.p(f'M0 {top}H{xr}', 'l', 0, .12)
    P.p(f'M0 {bot}H{xr}', 'l', .02, .14)
    P.tx(0, top - 6, 'SWING-HOCH', .06, .16)
    P.tx(0, bot + 16, 'SWING-TIEF', .08, .18)
    P.p(f'M0 {eq}H{xr}', 'dd', .2, .3)
    P.tx(0, eq - 6, 'EQUILIBRIUM 50' + NB + '%', .24, .34)
    # Maßkette: Premium und Discount je genau die Hälfte, zweite Zeile nennt die Richtung der Arrays
    P.chain(cx, xr + 5, [top, eq, bot], ['PREMIUM', 'DISCOUNT'], .3, ['BÄRISCH', 'BULLISCH'])
    # Zonen: vom Extrem zum Equilibrium Orderblock, FVG, Breaker; im Discount gespiegelt.
    # Premium bärisch (Schraffur /), Discount bullisch (Schraffur \\). Schraffur im DOM vor der Kontur.
    # Zonen als Preisbereiche, nicht als Balken: je Art eigene Höhe (FVG schmaler), Mitte der Zeilen fest
    xs = [62, 104, 146]
    zhs = [12, 8, 11]
    rows = [16, 34, 52]            # Zeilenmitte vom Extrem aus gemessen
    for j in range(3):
        t = .5 + .12 * j
        x0, zh = xs[j], zhs[j]
        name = ('OB', 'FVG', 'BREAKER')[j]
        for yc, d in ((top + rows[j], 1), (bot - rows[j], -1)):
            y0 = yc - zh / 2
            P.p(hatch(x0, y0, zx1, y0 + zh, 4.2, d), 'h', t + .06, t + .16)
            P.p(f'M{x0} {f(y0)}H{zx1}V{f(y0 + zh)}H{x0}Z', 't', t, t + .12)
            P.tx(x0 - 6, yc + 3.8, name, t + .06, t + .16, 'end')
    return P


# ---------------------------------------------------------------- Lücke mit Kerzen (NWOG, RTH ORG)
AX = 176        # Zeitachse
XR = 196        # Ende der Kanten und des CE
CX1, CX2 = 220, 246


def gap_frame(P, gx, g_top, g_bot, close_x, close_y, xb, t_close, t_open, x_close_tick, x_open_tick, name, t_edge):
    """Zeitachse mit Bruchzeichen, Schlussniveau ab der letzten Kerze, Eröffnungsniveau ab der ersten, CE, Maßketten."""
    ce = (g_top + g_bot) / 2
    # Zeitachse mit Bruch (die ausgelassene Zeit ist nicht gezeichnet)
    P.p(f'M0 {AX}H{xb - 4}M{xb + 4} {AX}H{XR}', 't', 0, .14)
    P.p(f'M{xb - 7} {AX + 6}L{xb - 1} {AX - 6}M{xb + 1} {AX + 6}L{xb + 7} {AX - 6}', 'l nodraw', .1, .16)
    P.p(f'M{x_close_tick} {AX - 4}V{AX + 4}M{x_open_tick} {AX - 4}V{AX + 4}', 't nodraw', .1, .16)
    P.tx(x_close_tick + 3, AX + 16, t_close, .14, .24, 'end')
    P.tx(x_open_tick - 3, AX + 16, t_open, t_edge + .1, t_edge + .18)
    # Reihenfolge: Schlussniveau, Eröffnung, Kasten, CE, Maßketten (im DOM vor den Kerzen, damit Kerzenkörper sie abdecken)
    open_y = g_top if close_y == g_bot else g_bot
    P.p(f'M{f(close_x)} {f(close_y)}H{XR}', 'l', t_edge, t_edge + .12)
    P.p(f'M{f(gx)} {f(g_top)}V{f(g_bot)}', 'l', t_edge + .16, t_edge + .22)
    P.p(f'M{f(gx)} {f(open_y)}H{XR}', 'l', t_edge + .18, t_edge + .3)
    P.p(f'M{f(gx)} {f(ce)}H{XR}', 'dd', t_edge + .26, t_edge + .36)
    P.tx(gx + 5, ce - 6, 'CE', t_edge + .32, t_edge + .4)
    # Maßketten: 50 % / 50 % und die ganze Lücke
    P.chain(CX1, XR + 5, [g_top, ce, g_bot], ['50' + NB + '%', '50' + NB + '%'], t_edge + .28)
    P.chain(CX2, CX1 + 9, [g_top, g_bot], [name], t_edge + .34)
    return ce


def nwog():
    P = Plan('New Week Opening Gap: die Lücke zwischen dem Schluss am Freitag um 17:00 Uhr New Yorker Zeit und der Eröffnung '
             'am Sonntag um 18:00 Uhr, bemaßt in zwei Hälften mit dem Consequent Encroachment bei 50 Prozent. '
             'In der neuen Woche läuft der Kurs zurück in die Lücke, dochtet genau bis zum CE, schließt darüber und steigt weiter.', 22)
    g_top, g_bot = 60, 136        # oben: Eröffnung Sonntag, unten: Schluss Freitag (Lücke nach oben)
    w = 9
    fri = [(12, 166, 158, 155, 170), (28, 158, 150, 146, 161), (44, 150, 154, 147, 158), (60, 154, 144, 141, 157), (76, 144, 136, 134, 147)]
    for k, (x, o, c, h_, l_) in enumerate(fri):
        P.candle(x, o, c, h_, l_, w, .02 + .045 * k)
    ce = gap_frame(P, 96.5, g_top, g_bot, 76 + w / 2 + .5, g_bot, 90, 'FR 17:00 NY', 'SO 18:00 NY', 76, 104, 'NWOG', .24)
    wk = [(104, 60, 48, 44, 62), (120, 48, 38, 31, 52), (136, 38, 62, 34, 66), (152, 62, 84, 58, 89),
          (168, 84, 74, 70, ce), (184, 74, 52, 48, 78)]
    for k, (x, o, c, h_, l_) in enumerate(wk):
        P.candle(x, o, c, h_, l_, w, (.36 if k == 0 else .5 + .07 * (k - 1)))
    # Reaktion am CE: der Docht endet genau auf der 50-%-Linie
    P.p(circle(168, ce, 2.6), 'af', .77, .83)
    return P


def org():
    P = Plan('Opening Range Gap der regulären Handelszeit: die Lücke zwischen dem Schluss des Vortags um 16:15 Uhr New Yorker Zeit '
             'und der Eröffnung um 09:30 Uhr, bemaßt in zwei Hälften mit dem Consequent Encroachment bei 50 Prozent. '
             'Nach der Eröffnung steigt der Kurs in die Lücke, erreicht genau das CE, dreht dort und fällt unter das Eröffnungstief.', 44)
    g_top, g_bot = 56, 132        # oben: Schluss 16:15, unten: Eröffnung 09:30 (Lücke nach unten)
    w = 6
    pm = [(8, 106, 99, 95, 110), (19, 99, 102, 93, 105), (30, 102, 90, 87, 104), (41, 90, 82, 78, 93),
          (52, 82, 86, 76, 89), (63, 86, 70, 66, 88), (74, 70, 56, 54, 72)]
    for k, (x, o, c, h_, l_) in enumerate(pm):
        P.candle(x, o, c, h_, l_, w, .02 + .03 * k)
    ce = gap_frame(P, 94, g_top, g_bot, 74 + w / 2 + .5, g_top, 88, '16:15 NY', '09:30 NY', 74, 100, 'RTH' + NB + 'ORG', .24)
    am = [(100, 132, 144, 130, 148), (111, 144, 152, 140, 158), (122, 152, 140, 136, 156), (133, 140, 124, 120, 143),
          (144, 124, 110, 106, 127), (155, 110, 100, ce, 113), (166, 100, 116, 97, 119), (177, 116, 134, 112, 137),
          (188, 134, 150, 131, 154)]
    for k, (x, o, c, h_, l_) in enumerate(am):
        P.candle(x, o, c, h_, l_, w, (.36 if k == 0 else .5 + .05 * (k - 1)), .05)
    # Reaktion am CE: das Hoch liegt genau auf der 50-%-Linie
    P.p(circle(155, ce, 2.4), 'af', .75, .81)
    return P


# ---------------------------------------------------------------- 4) Feinschliff: Bias aus dem Tageschart
def htf():
    P = Plan('Bias aus dem Tageschart: Tageskerzen der Vorwoche und dieser Woche. Das Hoch der Vorwoche vom Donnerstag ist Buy Side Liquidity. '
             'Am Montag nimmt der Kurs das Freitagstief, die Sell Side Liquidity, und dreht nach oben; '
             'der Pfeil zeigt vom Schluss am Mittwoch zum Hoch der Vorwoche als Draw on Liquidity.', 8)
    w, ax = 11, AX
    x0, sep, x1 = 2, 107, 212
    xs = [12.5 + 21 * k for k in range(10)]
    data = [(158, 136, 132, 164), (136, 110, 104, 140), (110, 72, 66, 114), (72, 90, 30, 94), (90, 112, 86, 118),
            (110, 116, 106, 134), (116, 92, 88, 120), (92, 70, 64, 96)]
    pwh, fri_low = 30, 118
    # Wochenkette unten: Vorwoche und diese Woche, je fünf Handelstage
    P.p(f'M{x0} {ax}H{x1}', 't', 0, .14)
    P.p(f'M{x0} {ax - 6}V{ax + 6}M{sep} {ax - 6}V{ax + 6}M{x1} {ax - 6}V{ax + 6}', 't nodraw', .1, .16)
    P.p(tick(x0, ax) + tick(sep, ax) + tick(x1, ax), 'l nodraw', .12, .18)
    P.tx((x0 + sep) / 2, ax + 16, 'VORWOCHE', .14, .24, 'middle')
    P.tx((sep + x1) / 2, ax + 16, 'DIESE WOCHE', .16, .26, 'middle')
    P.p(f'M{sep} {pwh + 12}V{ax - 10}', 'd', .12, .24)
    # Hoch der Vorwoche und Freitagstief (im DOM vor den Kerzen)
    P.p(f'M{xs[3]} {pwh}H{XR + 26}', 'd', .36, .48)
    P.tx(xs[3] + 5, pwh - 6, 'HOCH DER VORWOCHE', .4, .5)
    P.tx(XR + 31, pwh + 3.8, 'BSL', .44, .52)
    P.p(f'M{xs[4]} {fri_low}H{xs[5]}', 'd', .42, .5)
    P.tx(xs[4] - 7, fri_low + 3.8, 'SSL', .44, .52, 'end')
    for k, (o, c, h_, l_) in enumerate(data):
        P.candle(xs[k], o, c, h_, l_, w, .04 + .06 * k + (.14 if k >= 5 else 0), .07)
    # Draw on Liquidity: vom Schluss am Mittwoch zum Hoch der Vorwoche, die Spitze liegt auf der Linie
    sx, sy = xs[7] + 12, 70
    ex, ey = xs[9], pwh + .8
    r = 2.6
    L = math.hypot(ex - sx, ey - sy)
    ux, uy = (ex - sx) / L, (ey - sy) / L
    P.p(circle(sx, sy, r), 'l a nodraw', .76, .8)
    P.p(f'M{f(sx + r * ux)} {f(sy + r * uy)}L{f(ex)} {f(ey)}', 'l a', .78, .9)
    wing = ''
    for ang in (28, -28):
        a = math.radians(ang)
        vx, vy = -ux, -uy
        wx, wy = vx * math.cos(a) - vy * math.sin(a), vx * math.sin(a) + vy * math.cos(a)
        wing += f'M{f(ex)} {f(ey)}L{f(ex + 7 * wx)} {f(ey + 7 * wy)}'
    P.p(wing, 'l a nodraw', .88, .93)
    P.tx(xs[8] + 2, 86, 'DRAW ON', .9, 1)
    P.tx(xs[8] + 2, 100, 'LIQUIDITY', .92, 1)
    return P


PHASES = [
    ('Monat 1 bis 3', 'Grundlagen', ['Bias und Liquidität', 'PD-Array-Matrix: FVG, Orderblock, Breaker', 'Wichtige Zeiten: Makros, Silver Bullet, Sessions', 'Journaling-Methoden'], matrix),
    ('Monat 4 bis 6', 'Vertiefung', ['Zeitbasierte Liquidität und PD Arrays', 'Einstiegstechniken', 'Grundlagen im Risikomanagement'], nwog),
    ('Monat 7 bis 9', 'Anwendung', ['Die Konzepte am Live-Markt', 'Trade-Review-Workshops', 'Fortgeschrittenes Risikomanagement'], org),
    ('Monat 10 bis 12', 'Feinschliff', ['Trading-Psychologie', 'Bias aus höheren Timeframes', 'Persönliche Strategieentwicklung'], htf),
]


def section():
    out = ['      <div class="lz" id="lehrplan-zeit">',
           '        <ol class="lz-phases">']
    for i, (when, title, items, fn) in enumerate(PHASES):
        P = fn()
        end = '<i class="lz-sl lz-end"></i>' if i == len(PHASES) - 1 else ''
        lis = ''.join(f'<li class="lz-t">{t}</li>' for t in items)
        out.append(f'          <li class="lz-ph" data-i="{i}">')
        out.append(f'            <figure class="lz-fig">{P.svg()}</figure>')
        out.append(f'            <span class="label lz-when lz-t">{when}</span>')
        out.append(f'            <div class="lz-rule" aria-hidden="true"><i class="lz-base"></i><i class="lz-prog"></i><i class="lz-mo lz-m1"></i><i class="lz-mo lz-m2"></i><i class="lz-sl"></i>{end}<i class="lz-dot"></i></div>')
        out.append(f'            <div class="lz-body"><h3 class="lz-t">{title}</h3><ul>{lis}</ul></div>')
        out.append('          </li>')
    out += ['        </ol>', '      </div>']
    html = '\n'.join(out) + '\n'
    assert '–' not in html and '—' not in html
    assert 'SMT' not in html
    open(os.path.join(H, 'section.html'), 'w', encoding='utf-8').write(html)
    print('section.html', len(html))


if __name__ == '__main__':
    section()
