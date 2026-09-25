# Warum C final: verstreutes ICT-Material ordnet sich zu einer Treppe (Kabinett-Axonometrie).
# Erzeugt section.html (Abschnitt #warum mit Inline-SVG).
# Bildschirm: x = OX + X - Y*C, y = OY - Z - Y*C  (Tiefe unter 45 Grad nach links oben, halb verkürzt)
# Aufruf: python3 gen.py [schlüssel=wert ...]
import math, os, random, sys, json

H = os.path.dirname(os.path.abspath(__file__))
CFG = dict(seed=5, w=110.0, s=25.0, per=2, dc=44.0, ox=62.5, oy=312.5, vw=520, vh=384,
           off=16.0, ncontent=13, s0lo=.64, s0hi=.78, plo=6.0, phi=30.0, roll=8.0,
           ovl=.10, ang=20.0, mincr=.6, mincu=.45, maxang=50.0, upr=.68, gap=0.0, tries=60, lblx=-2.0, lbly=-14.0)
for a in sys.argv[1:]:
    k, v = a.split('=', 1)
    CFG[k] = type(CFG[k])(v)
C = math.sqrt(.5) / 2
W, DC, S, PER = CFG['w'], CFG['dc'], CFG['s'], CFG['per']
D = DC / C
R = S * PER
OX, OY, VW, VH = CFG['ox'], CFG['oy'], CFG['vw'], CFG['vh']
NAMES = ['GRUNDLAGEN', 'VERTIEFUNG', 'ANWENDUNG', 'FEINSCHLIFF']
NB = 4


def f(v):
    s = ('%.2f' % v).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def f3(v):
    s = ('%.3f' % v).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def scr(X, Y, Z):
    return OX + X - Y * C, OY - Z - Y * C


def xb(b):
    return W * b


def hb(b):
    return R * (b + 1) if b >= 0 else 0.0


def fx0(b):
    return OX + W * b


def tick(x, y, k=3.4):
    return f'M{f(x - k)} {f(y + k)}L{f(x + k)} {f(y - k)}'


def circle(cx, cy, r):
    return f'M{f(cx - r)} {f(cy)}a{f(r)} {f(r)} 0 1 0 {f(2 * r)} 0a{f(r)} {f(r)} 0 1 0 {f(-2 * r)} 0'


# ---------------- Geometrie der Blätter ----------------
def rot(v, yaw, pitch, roll):
    x, y, z = v
    cr, sr = math.cos(math.radians(roll)), math.sin(math.radians(roll))
    x, z = x * cr + z * sr, -x * sr + z * cr
    cp, sp = math.cos(math.radians(pitch)), math.sin(math.radians(pitch))
    y, z = y * cp - z * sp, y * sp + z * cp
    cy_, sy_ = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    x, y = x * cy_ - y * sy_, x * sy_ + y * cy_
    return x, y, z


def corners(pose):
    X, Y, Z, yaw, pitch, roll, sc = pose
    e1 = [c * sc for c in rot((W, 0, 0), yaw, pitch, roll)]
    e2 = [c * sc for c in rot((0, D, 0), yaw, pitch, roll)]
    c0 = (X - e1[0] / 2 - e2[0] / 2, Y - e1[1] / 2 - e2[1] / 2, Z - e1[2] / 2 - e2[2] / 2)
    return [c0, tuple(c0[i] + e1[i] for i in range(3)), tuple(c0[i] + e1[i] + e2[i] for i in range(3)), tuple(c0[i] + e2[i] for i in range(3))]


def poly(pose):
    return [scr(*c) for c in corners(pose)]


def area(P):
    return abs(sum(P[i][0] * P[(i + 1) % len(P)][1] - P[(i + 1) % len(P)][0] * P[i][1] for i in range(len(P)))) / 2


def ccw(P):
    s = sum(P[i][0] * P[(i + 1) % len(P)][1] - P[(i + 1) % len(P)][0] * P[i][1] for i in range(len(P)))
    return P if s > 0 else P[::-1]


def clip(Pa, Pb):
    # Sutherland-Hodgman: Pa geschnitten mit konvexem Pb
    out = ccw(Pa)
    Pb = ccw(Pb)
    for i in range(len(Pb)):
        a, b = Pb[i], Pb[(i + 1) % len(Pb)]
        inp, out = out, []
        if not inp:
            break
        side = lambda p: (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
        for j in range(len(inp)):
            p, q = inp[j], inp[(j + 1) % len(inp)]
            sp_, sq = side(p), side(q)
            if sp_ >= 0:
                out.append(p)
            if (sp_ >= 0) != (sq >= 0):
                t = sp_ / (sp_ - sq)
                out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return out


def inter_area(Pa, Pb):
    q = clip(Pa, Pb)
    return area(q) if len(q) >= 3 else 0.0


def seg_x(p1, p2, p3, p4):
    d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0])
    if abs(d) < 1e-9:
        return False
    t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d
    u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d
    return 0 < t < 1 and 0 < u < 1


def min_cross_angle(Pa, Pb):
    m = 90.0
    for i in range(4):
        a1, a2 = Pa[i], Pa[(i + 1) % 4]
        for j in range(4):
            b1, b2 = Pb[j], Pb[(j + 1) % 4]
            if seg_x(a1, a2, b1, b2):
                t1 = math.degrees(math.atan2(a2[1] - a1[1], a2[0] - a1[0]))
                t2 = math.degrees(math.atan2(b2[1] - b1[1], b2[0] - b1[0]))
                d = abs(t1 - t2) % 180
                m = min(m, min(d, 180 - d))
    return m


def shrink(P, k):
    cx = sum(p[0] for p in P) / len(P)
    cy = sum(p[1] for p in P) / len(P)
    return [(cx + (p[0] - cx) * k, cy + (p[1] - cy) * k) for p in P]


def edge_angles(P):
    out = []
    for i in range(4):
        a, b = P[i], P[(i + 1) % 4]
        out.append(math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) % 180)
    return out


# ---------------- Unordnung: lose verteiltes Material ----------------
def chaos(n, rnd):
    poses, polys = [], []
    tries = 0
    while len(poses) < n:
        tries += 1
        if tries > 60000:
            return None
        sx, sy = rnd.uniform(-22, VW + 22), rnd.uniform(4, VH - 2)
        # locker verteilt: leichte Verdichtung zur Mitte, Ränder ausfransend
        dx, dy = (sx - VW * .5) / (VW * .56), (sy - VH * .5) / (VH * .56)
        if dx * dx + dy * dy > rnd.uniform(.7, 1.15):
            continue
        yaw = rnd.uniform(-62, -34) if rnd.random() < .5 else rnd.uniform(6, 56)
        pitch = rnd.uniform(CFG['plo'], CFG['phi'])
        roll = rnd.uniform(-CFG['roll'], CFG['roll'])
        sc = rnd.uniform(CFG['s0lo'], CFG['s0hi'])
        Y = rnd.uniform(-40, 120)
        X = sx - OX + Y * C
        Z = OY - sy - Y * C
        pose = (X, Y, Z, yaw, pitch, roll, sc)
        P = poly(pose)
        # keine fast senkrechten Kanten (sähen wie stehende Blätter aus)
        if any(abs(a - 90) < 16 for a in edge_angles(P)):
            continue
        if min(p[0] for p in P) < -34 or max(p[0] for p in P) > VW + 34 or min(p[1] for p in P) < -6 or max(p[1] for p in P) > VH + 4:
            continue
        ok = True
        A = area(P)
        for Q in polys:
            ia = inter_area(P, Q)
            if ia > 0:
                if ia > CFG['ovl'] * min(A, area(Q)) or min_cross_angle(P, Q) < CFG['ang']:
                    ok = False
                    break
            elif CFG['gap'] > 0 and inter_area(shrink(P, 1 + CFG['gap']), Q) > 0:
                ok = False
                break
        if not ok:
            continue
        poses.append(pose)
        polys.append(P)
    return poses


def slots():
    # Reihenfolge im Dokument: hintere Blöcke zuerst, darin von unten nach oben
    return [(b, L) for b in (3, 2, 1, 0) for L in range(PER * (b + 1))]


def slot_center(b, L):
    return scr(xb(b) + W / 2, D / 2, S * (L + 1))


def assign(poses, sl, rnd):
    fin = [slot_center(b, L) for b, L in sl]
    ch = [scr(p[0], p[1], p[2]) for p in poses]
    n = len(sl)

    def cost(i, j):
        b, L = sl[i]
        c = (fin[i][0] - ch[j][0]) ** 2 + 0.5 * (fin[i][1] - ch[j][1]) ** 2
        # Blätter, die unten liegen, gehen zuerst (sonst lägen sie noch da, wenn die Bodenlinie kommt)
        if ch[j][1] > OY - 40 and L >= 2:
            c += 4e5
        return c
    perm = list(range(n))
    rnd.shuffle(perm)
    improved = True
    while improved:
        improved = False
        for i in range(n):
            for j in range(i + 1, n):
                a, b_ = perm[i], perm[j]
                if cost(i, b_) + cost(j, a) < cost(i, a) + cost(j, b_) - 1e-6:
                    perm[i], perm[j] = b_, a
                    improved = True
    return [poses[perm[i]] for i in range(n)]


def score(poses):
    # Gleichmäßigkeit: Abdeckung in 4x3 Feldern, dazu wenige Überlappungen
    P = [poly(p) for p in poses]
    cells = []
    for gx in range(4):
        for gy in range(3):
            cell = [(gx * VW / 4, gy * VH / 3), ((gx + 1) * VW / 4, gy * VH / 3), ((gx + 1) * VW / 4, (gy + 1) * VH / 3), (gx * VW / 4, (gy + 1) * VH / 3)]
            cells.append(sum(inter_area(q, cell) for q in P) / (VW * VH / 12))
    mean = sum(cells) / len(cells)
    var = sum((c - mean) ** 2 for c in cells) / len(cells)
    ov = sum(1 for i in range(len(P)) for j in range(i + 1, len(P)) if inter_area(P[i], P[j]) > 0)
    return var * 10 + abs(ov - 4) * .02, mean, ov


# ---------------- Inhalte auf den Blättern (Einheitskoordinaten: u nach rechts, v nach hinten = "oben") ----------------
def P(u, v):
    return f'{f3(u)} {f3(v)}'


def candles(rnd, u0, u1, v0, v1, n, trend):
    main, fill = '', ''
    bw = (u1 - u0) / n * .46
    price = .5 - trend * .3
    vals = []
    for i in range(n):
        o = price
        c = min(.95, max(.05, o + trend * rnd.uniform(.02, .2) + rnd.uniform(-.14, .14)))
        hi = max(o, c) + rnd.uniform(.03, .14)
        lo = min(o, c) - rnd.uniform(.03, .14)
        vals.append((o, c, min(1, hi), max(0, lo)))
        price = c
    lo_all = min(v[3] for v in vals)
    hi_all = max(v[2] for v in vals)
    sc = lambda y: v0 + (y - lo_all) / (hi_all - lo_all) * (v1 - v0)
    for i, (o, c, hi, lo) in enumerate(vals):
        x = u0 + (i + .5) * (u1 - u0) / n
        top, bot = sc(max(o, c)), sc(min(o, c))
        if top - bot < .03:
            top += .015
            bot -= .015
        main += f'M{P(x, sc(lo))}V{f3(bot)}M{P(x, top)}V{f3(sc(hi))}'
        rect = f'M{P(x - bw / 2, bot)}H{f3(x + bw / 2)}V{f3(top)}H{f3(x - bw / 2)}Z'
        if c < o:
            fill += rect
        else:
            main += rect
    return main, fill, [(u0 + (i + .5) * (u1 - u0) / n, sc(v[2]), sc(v[3])) for i, v in enumerate(vals)]


def hatch_box(u0, u1, v0, v1, step=7.0):
    # Schraffur unter 45 Grad in der Blattebene (in echten Einheiten W x D)
    a0, a1, b0, b1 = u0 * W, u1 * W, v0 * D, v1 * D
    out = ''
    c = a0 - b1
    while c < a1 - b0:
        c += step
        # Linie a - b = c
        pts = []
        for b in (b0, b1):
            a = c + b
            if a0 - 1e-9 <= a <= a1 + 1e-9:
                pts.append((a, b))
        for a in (a0, a1):
            b = a - c
            if b0 - 1e-9 <= b <= b1 + 1e-9:
                pts.append((a, b))
        pts = sorted(set((round(p[0], 4), round(p[1], 4)) for p in pts))
        if len(pts) >= 2:
            (pa, pb), (qa, qb) = pts[0], pts[-1]
            out += f'M{P(pa / W, pb / D)}L{P(qa / W, qb / D)}'
    return out


def motif(kind, rnd):
    m, fl, dash, soft, hat = '', '', '', '', ''
    if kind == 'candles':
        trend = rnd.choice([-1, 1])
        m, fl, pts = candles(rnd, .12, .88, .16, .84, 6, trend * .6)
        lvl = max(p[1] for p in pts[:3]) if trend < 0 else min(p[2] for p in pts[:3])
        dash = f'M{P(.1, lvl)}H.92'
    elif kind == 'fvg':
        # drei Kerzen, die mittlere verdrängt, dazwischen die Lücke
        xs = [.28, .44, .6]
        bw = .075
        c1 = (.18, .3, .36, .14)      # o c hi lo
        c2 = (.3, .74, .78, .27)
        c3 = (.7, .64, .82, .52)
        for x, (o, c, hi, lo) in zip(xs, (c1, c2, c3)):
            top, bot = max(o, c), min(o, c)
            m += f'M{P(x, lo)}V{f3(bot)}M{P(x, top)}V{f3(hi)}'
            rect = f'M{P(x - bw / 2, bot)}H{f3(x + bw / 2)}V{f3(top)}H{f3(x - bw / 2)}Z'
            if c < o:
                fl += rect
            else:
                m += rect
        g0, g1 = c1[2], c3[3]
        soft = f'M{P(xs[0] - .04, g0)}H.88V{f3(g1)}H{f3(xs[0] - .04)}Z'
        hat = hatch_box(xs[0] - .04, .88, g0, g1, 6.0)
    elif kind == 'line':
        n = 10
        pts = []
        v = rnd.uniform(.3, .5)
        for i in range(n):
            pts.append((.1 + .8 * i / (n - 1), v))
            v = min(.85, max(.15, v + rnd.uniform(-.2, .24)))
        hi = max(pts[:6], key=lambda p: p[1])
        m = 'M' + 'L'.join(P(*p) for p in pts)
        dash = f'M{P(hi[0], hi[1])}H.92'
    elif kind == 'raid':
        pts = [(.1, .78), (.2, .6), (.28, .66), (.38, .42), (.46, .5), (.56, .36), (.62, .2), (.7, .44), (.78, .62), (.9, .8)]
        m = 'M' + 'L'.join(P(*p) for p in pts)
        dash = f'M{P(.38, .42)}H.9'
        soft = f'M{P(.1, .3)}H.9'
    elif kind == 'slide':
        soft = f'M{P(.1, .84)}H.52M{P(.1, .76)}H.34'
        m2 = f'M{P(.1, .1)}H.9V.66H.1Z'
        cm, cf, _ = candles(rnd, .16, .84, .18, .58, 5, rnd.choice([-.5, .5]))
        m = m2 + cm
        fl = cf
    elif kind == 'notes':
        v = .82
        while v > .16:
            L = rnd.uniform(.45, .8)
            soft += f'M{P(.12, v)}H{f3(.12 + L)}'
            v -= .12
    return dict(m=m, fl=fl, dash=dash, soft=soft, hat=hat)


KINDS = ['candles', 'fvg', 'line', 'slide', 'raid', 'candles', 'notes', 'fvg', 'line', 'slide', 'candles', 'raid', 'notes', 'line', 'candles', 'fvg']


# ---------------- Zeitplan ----------------
DUR = 0.15


def tstart(b, L):
    return 0.03 + 0.058 * L + 0.012 * (3 - b)


def land(b):
    return tstart(b, PER * (b + 1) - 1) + DUR


def side_hatch(b, step=7.0):
    # Schraffur "/" auf der sichtbaren linken Seitenfläche von Block b (Setzstufe), global ausgerichtet
    x0 = fx0(b)
    z0, z1 = hb(b - 1), hb(b)
    out = ''
    cmin = x0 - DC + OY - z1 - DC
    cmax = x0 + OY - z0
    c = math.floor(cmin / step) * step
    while c <= cmax:
        K = x0 + OY - c
        lo = max(0.0, (K - z1) / 2)
        hi = min(DC, (K - z0) / 2)
        if hi - lo > .8:
            out += f'M{f(x0 - lo)} {f(OY - K + lo)}L{f(x0 - hi)} {f(OY - K + hi)}'
        c += step
    return out


DBG = []


def build():
    seed = CFG['seed']
    best = None
    for k in range(CFG['tries']):
        rnd = random.Random(seed * 1000 + k)
        poses = chaos(len(slots()), rnd)
        if not poses:
            continue
        sc_, mean, ov = score(poses)
        if best is None or sc_ < best[0]:
            best = (sc_, seed * 1000 + k, poses, mean, ov)
    sc_, used_seed, poses, mean, ov = best
    rnd = random.Random(used_seed)
    sl = slots()
    poses = assign(poses, sl, random.Random(3))
    polys = [poly(p) for p in poses]
    # Inhalte: nur auf Blättern, deren Chart im Bild aufrecht lesbar ist und die nicht von später gezeichneten Blättern verdeckt werden
    ROTS = {0: ((1, 0), (0, 1), 'matrix(1 0 0 1 0 0)'), 1: ((0, 1), (-1, 0), 'matrix(0 1 -1 0 1 0)'),
            2: ((-1, 0), (0, -1), 'matrix(-1 0 0 -1 1 1)'), 3: ((0, -1), (1, 0), 'matrix(0 -1 1 0 0 1)')}
    orient = {}
    upright = {}
    clean = []
    for i, key in enumerate(sl):
        Pq = polys[i]
        e1 = (Pq[1][0] - Pq[0][0], Pq[1][1] - Pq[0][1])
        e2 = (Pq[3][0] - Pq[0][0], Pq[3][1] - Pq[0][1])
        best_r = None
        for r, (ra, ua, mat) in ROTS.items():
            right = (ra[0] * e1[0] + ra[1] * e2[0], ra[0] * e1[1] + ra[1] * e2[1])
            up = (ua[0] * e1[0] + ua[1] * e2[0], ua[0] * e1[1] + ua[1] * e2[1])
            nr, nu = math.hypot(*right), math.hypot(*up)
            cr, cu = right[0] / nr, -up[1] / nu
            ang = math.degrees(math.acos(max(-1, min(1, (right[0] * up[0] + right[1] * up[1]) / (nr * nu)))))
            sc = cr + cu
            if best_r is None or sc > best_r[0]:
                best_r = (sc, r, cr, cu, ang, mat)
        sc, r, cr, cu, ang, mat = best_r
        DBG.append((i, round(cr,2), round(cu,2), round(ang), r))
        if cr < CFG['mincr'] or cu < CFG['mincu'] or abs(ang - 90) > CFG['maxang']:
            continue
        core = shrink(polys[i], .86)
        if any(inter_area(core, polys[j]) > 0 for j in range(i + 1, len(sl))):
            continue
        orient[i] = mat
        upright[i] = cu
        clean.append(i)
    # gleichmäßig verteilt auswählen: größte Abstände zuerst
    cen = [(sum(p[0] for p in P_) / 4, sum(p[1] for p in P_) / 4) for P_ in polys]
    chosen = []
    cand = clean[:]
    while cand and len(chosen) < CFG['ncontent']:
        if not chosen:
            pick = min(cand, key=lambda i: cen[i][0])
        else:
            pick = max(cand, key=lambda i: min((cen[i][0] - cen[j][0]) ** 2 + (cen[i][1] - cen[j][1]) ** 2 for j in chosen))
        chosen.append(pick)
        cand.remove(pick)
    chosen.sort(key=lambda i: (cen[i][1], cen[i][0]))
    kinds = {}
    # Kerzen und FVG nur dort, wo die Dochte im Bild einigermaßen senkrecht stehen; Kurslinien und Notizen vertragen Schräglage
    UPR = ['candles', 'fvg', 'slide', 'candles', 'fvg', 'slide', 'candles']
    SLANT = ['line', 'notes', 'raid', 'line', 'notes', 'raid']
    nu = ns = 0
    for i in chosen:
        if upright[i] >= CFG['upr']:
            kinds[i] = UPR[nu % len(UPR)]
            nu += 1
        else:
            kinds[i] = SLANT[ns % len(SLANT)]
            ns += 1

    body = []
    by_block = {}
    for i, (b, L) in enumerate(sl):
        by_block.setdefault(b, []).append(i)
    defs = []
    # Boden mit Erdschraffur: ganz unten im Bild, die Blätter liegen davor
    gx0, gx1 = 6, VW - 6
    body.append(f'<path class="t wc-draw" pathLength="1" d="M{gx0} {f(OY)}H{gx1}" data-t0=".02" data-t1=".12"/>')
    body.append(f'<path class="h wc-fade wc-earth" d="{"".join(f"M{x} {f(OY + 1)}l-6 7" for x in range(14, int(fx0(3) + W + 14), 11))}" data-t0=".06" data-t1=".14"/>')
    for b in (3, 2, 1, 0):
        x0, x1, h, hp = fx0(b), fx0(b) + W, hb(b), hb(b - 1)
        T = OY - h
        g = [f'<g class="wc-blk" data-b="{b}">']
        # Deckfläche: steht immer auf der aktuellen Stapelhöhe, die gelandeten Blätter gehen darin auf
        g.append(f'<path class="wc-cap" d="M{f(x0)} {f(OY)}H{f(x1)}L{f(x1 - DC)} {f(OY - DC)}H{f(x0 - DC)}Z" transform="translate(0 {f(-h)})"/>')
        for i in by_block[b]:
            _, L = sl[i]
            pose = poses[i]
            Z = S * (L + 1)
            ex, ey = scr(xb(b), 0, Z)
            m = f'matrix({f(W)} 0 {f(-DC)} {f(-DC)} {f(ex)} {f(ey)})'
            kk = ' '.join(f3(v) for v in pose)
            inner = '<path class="wc-sf" d="M0 0H1V1H0Z"/>'
            if i in kinds:
                mo = motif(kinds[i], rnd)
                inner += f'<g class="wc-c" transform="{orient[i]}">'
                if mo['hat']:
                    inner += f'<path class="wc-ch" d="{mo["hat"]}"/>'
                if mo['soft']:
                    inner += f'<path class="wc-cs" d="{mo["soft"]}"/>'
                if mo['dash']:
                    inner += f'<path class="wc-cd" d="{mo["dash"]}"/>'
                if mo['fl']:
                    inner += f'<path class="wc-cf" d="{mo["fl"]}"/>'
                if mo['m']:
                    inner += f'<path class="wc-cm" d="{mo["m"]}"/>'
                inner += '</g>'
            g.append(f'<g class="wc-s" opacity="0" transform="{m}" data-k="{kk}" data-f="{f(xb(b) + W / 2)} {f(D / 2)} {f(Z)}" data-t="{tstart(b, L):.3f}" data-l="{L}">{inner}</g>')
        # Körper des Blocks: Vorderfläche + linke Seitenfläche, wächst mit den landenden Blättern (Clip)
        face = f'M{f(x0)} {f(OY)}V{f(T)}H{f(x1)}V{f(OY)}Z'
        face += f'M{f(x0)} {f(OY - hp)}V{f(T)}L{f(x0 - DC)} {f(T - DC)}V{f(OY - hp - DC)}Z'
        lines = ''.join(f'M{f(x0)} {f(OY - S * j)}H{f(x1)}' for j in range(1, PER * (b + 1)))
        if b:
            lines += f'M{f(x0)} {f(OY)}V{f(OY - hp)}'      # Fuge zum vorderen Block
        hat = side_hatch(b)
        edges = f'M{f(x0)} {f(OY - hp)}V{f(T)}'           # Vorderkante der Setzstufe
        edges += f'M{f(x0 - DC)} {f(OY - hp - DC)}V{f(T - DC)}'  # hintere Kante
        edges += f'M{f(x0)} {f(OY - hp)}L{f(x0 - DC)} {f(OY - hp - DC)}'  # Fußkante
        if b == 3:
            edges += f'M{f(x1)} {f(T)}V{f(OY)}'
        cp = f'M{f(x1 + 1)} {f(OY)}H{f(x0)}L{f(x0 - DC - 1.5)} {f(OY - DC - 1.5)}V{f(OY + 280)}H{f(x1 + 1)}Z'
        defs.append(f'<clipPath id="wc-k{b}"><path d="{cp}" transform="translate(0 {f(-h - 2)})" data-h="{f(h)}"/></clipPath>')
        g.append(f'<g class="wc-body" clip-path="url(#wc-k{b})"><path class="wc-bf" d="{face}"/><path class="wc-bl" d="{lines}"/><path class="wc-bh" d="{hat}"/><path class="wc-be" d="{edges}"/></g>')
        g.append('</g>')
        body.append(''.join(g))

    # Federstrich: erst die Ansicht (Profil wie die alte Treppe), dann die Tiefenlinien, dann die Hinterkante
    pen = f'M{f(fx0(0))} {f(OY)}'
    for b in range(NB):
        pen += f'V{f(OY - hb(b))}H{f(fx0(b) + W)}'
    pen += f'V{f(OY)}H{f(fx0(0))}'
    rays = [(fx0(0), OY)]
    for b in range(NB):
        rays.append((fx0(b), OY - hb(b)))
        if b < NB - 1:
            rays.append((fx0(b + 1), OY - hb(b)))
    rays.append((fx0(3) + W, OY - hb(3)))
    for x, y in rays:
        pen += f'M{f(x)} {f(y)}l{f(-DC)} {f(-DC)}'
    pen += f'M{f(fx0(0) - DC)} {f(OY - DC)}'
    for b in range(NB):
        pen += f'V{f(OY - hb(b) - DC)}H{f(fx0(b) + W - DC)}'
    t_pen0 = land(3) + .005
    body.append(f'<path class="wc-pen wc-draw" pathLength="1" d="{pen}" data-t0="{t_pen0:.3f}" data-t1="{t_pen0 + .17:.3f}"/>')

    # Stufenbeschriftung, Block für Block sobald er steht
    for b, name in enumerate(NAMES):
        x, y = fx0(b) + CFG['lblx'], OY - hb(b) + CFG['lbly']
        body.append(f'<text class="wc-fade wc-lbl" x="{f(x)}" y="{f(y)}" data-t0="{land(b) + .01:.3f}" data-t1="{land(b) + .07:.3f}">{name}</text>')

    # Maßketten
    xs = [fx0(i) for i in range(5)]
    y1, y2 = OY + 30, OY + 60
    td = t_pen0 + .15
    dim = []
    ext = ''.join(f"M{f(x)} {f(OY + 16)}V{f(y1 + 6)}" for x in xs[1:-1]) + ''.join(f"M{f(x)} {f(OY + 16)}V{f(y2 + 6)}" for x in (xs[0], xs[-1]))
    dim.append(f'<path class="t wc-draw" pathLength="1" d="{ext}" data-t0="{td:.3f}" data-t1="{td + .04:.3f}"/>')
    dim.append(f'<path class="t wc-draw" pathLength="1" d="M{f(xs[0])} {f(y1)}H{f(xs[-1])}" data-t0="{td + .02:.3f}" data-t1="{td + .07:.3f}"/>')
    dim.append(f'<path class="l wc-fade" d="{"".join(tick(x, y1) for x in xs)}" data-t0="{td + .05:.3f}" data-t1="{td + .08:.3f}"/>')
    dim.append(f'<g class="wc-fade" data-t0="{td + .05:.3f}" data-t1="{td + .1:.3f}">' + ''.join(f'<text x="{f((xs[i] + xs[i + 1]) / 2)}" y="{f(y1 - 6)}" text-anchor="middle">3 MONATE</text>' for i in range(4)) + '</g>')
    dim.append(f'<path class="t wc-draw" pathLength="1" d="M{f(xs[0])} {f(y2)}H{f(xs[-1])}" data-t0="{td + .07:.3f}" data-t1="{td + .12:.3f}"/>')
    dim.append(f'<path class="l wc-fade" d="{tick(xs[0], y2)}{tick(xs[-1], y2)}" data-t0="{td + .1:.3f}" data-t1="{td + .13:.3f}"/>')
    dim.append(f'<text class="wc-fade" x="{f((xs[0] + xs[-1]) / 2)}" y="{f(y2 - 6)}" text-anchor="middle" data-t0="{td + .1:.3f}" data-t1="{td + .15:.3f}">12 MONATE</text>')
    body.extend(dim)

    # Lauflinie knapp über den Stufenkanten: Kreis an der ersten Stufe, Pfeil über der letzten
    off = CFG['off']
    slope = R / W
    bx0, by0 = fx0(0) - DC, OY - hb(0) - DC
    yl = lambda x: by0 - slope * (x - bx0) - off
    sx, ex = bx0 + 14, fx0(3) - DC + 16
    sy, ey = yl(sx), yl(ex)
    ux, uy = ex - sx, ey - sy
    n = math.hypot(ux, uy)
    ux, uy = ux / n, uy / n
    rr = 3.2
    tl = td + .12
    body.append(f'<path class="l a wc-fade" d="{circle(sx, sy, rr)}" data-t0="{tl:.3f}" data-t1="{tl + .025:.3f}"/>')
    run = f'M{f(sx + rr * ux)} {f(sy + rr * uy)}L{f(ex)} {f(ey)}'
    body.append(f'<path class="l a wc-draw" pathLength="1" d="{run}" data-t0="{tl + .01:.3f}" data-t1="{min(.975, tl + .11):.3f}"/>')
    wing = ''
    for ang in (24, -24):
        c_, s_ = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        wx, wy = -ux * c_ + uy * s_, -ux * s_ - uy * c_
        wing += f'M{f(ex)} {f(ey)}L{f(ex + 7.5 * wx)} {f(ey + 7.5 * wy)}'
    body.append(f'<path class="l a wc-fade" d="{wing}" data-t0="{min(.965, tl + .1):.3f}" data-t1="{min(.995, tl + .13):.3f}"/>')

    aria = 'Verstreute Blätter mit Charts und Notizen ordnen sich zu einer Treppe mit vier Stufen: Grundlagen, Vertiefung, Anwendung, Feinschliff, je drei Monate, zusammen zwölf Monate'
    info = dict(seed=used_seed, coverage=round(mean, 3), overlaps=ov, content=len(chosen), clean=len(clean), land=[round(land(b), 3) for b in range(4)], pen=round(t_pen0, 3), dims=round(td, 3), run=round(tl, 3))
    svg = (f'<svg class="plan wc-plan" id="wc-plan" viewBox="0 0 {VW} {VH}" role="img" aria-label="{aria}" '
           f'data-dur="{DUR}" data-c="{C:.8f}" data-ox="{f(OX)}" data-oy="{f(OY)}" data-w="{f(W)}" data-d="{D:.4f}" data-s="{f(S)}">'
           f'<defs>{"".join(defs)}</defs>' + ''.join(body) + '</svg>')
    return svg, info


SECTION = '''  <section class="sec band why wc" id="warum" aria-labelledby="warum-title">
    <div class="wc-track">
      <div class="wrap split wc-stage">
        <div class="wc-text">
          <h2 id="warum-title"><span class="dim">ICT ist genial.</span><span>Aber verstreut.</span></h2>
          <p class="lead wc-p1">Über tausend Stunden Material, auf Englisch, verteilt über viele Jahre und ohne feste Reihenfolge.</p>
          <p class="lead wc-p2">Ich habe es durchgearbeitet und in einen Lehrplan gebracht, der aufeinander aufbaut. So lernst du jeden Baustein genau dann, wenn du ihn brauchst.</p>
        </div>
        %SVG%
      </div>
    </div>
  </section>'''

if __name__ == '__main__':
    svg, info = build()
    out = SECTION.replace('%SVG%', svg)
    assert '–' not in out and '—' not in out
    open(os.path.join(H, 'section.html'), 'w', encoding='utf-8').write(out + '\n')
    print('section.html', len(out), 'Zeichen', json.dumps(info))
    if 'dbg' in os.environ: print(DBG)
