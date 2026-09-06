"""Original contour adjustments to the pinned OFL Source Serif outlines.

All geometry is derived from that source and the design parameters below.
No reference or proprietary font file is read by this module.
"""
import unicodedata
import math

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
from fontTools.otlLib.builder import buildPairPosGlyphsSubtable
from fontTools.ttLib.tables import otTables
from fontTools.ttLib.tables.otBase import ValueRecord


def contours(recording):
    result = []
    current = []
    for command in recording:
        current.append(command)
        if command[0] in ('closePath', 'endPath'):
            result.append(current)
            current = []
    assert not current
    return result


def record_glyph(font, name):
    glyphs = font.getGlyphSet()
    pen = DecomposingRecordingPen(glyphs)
    glyphs[name].draw(pen)
    return pen.value


def replace_glyph(font, name, commands):
    pen = TTGlyphPen(None)
    for operation, points in commands:
        getattr(pen, operation)(*points)
    glyph = pen.glyph()
    if glyph.numberOfContours:
        glyph.flags[0] |= 0x40
    font['glyf'][name] = glyph
    glyph.recalcBounds(font['glyf'])
    advance, _ = font['hmtx'][name]
    font['hmtx'][name] = (advance, glyph.xMin)


def refine_serif(font, italic=False):
    """Refine structural terminals before decomposing accented glyphs."""
    if italic:
        return []
    cmap = font.getBestCmap()
    cap = font['glyf'][cmap[ord('H')]].yMax
    xh = font['glyf'][cmap[ord('x')]].yMax
    changed = []

    for letter in 'Ww':
        name = cmap[ord(letter)]
        parts = contours(record_glyph(font, name))
        assert len(parts) == 4, (letter, 'unexpected upstream topology')
        # The middle crown is a separate contour in the licensed source.
        replace_glyph(font, name, [command for i, part in enumerate(parts) if i != 2 for command in part])
        changed.append(letter)

    name = cmap[ord('J')]
    parts = contours(record_glyph(font, name))
    aw = font['hmtx'][name][0]
    top = [p[0] for _, points in parts[0] for p in points if p is not None and abs(p[1]-cap) < 1]
    left, right = min(top)/aw, max(top)/aw
    thickness = right-left
    body = [
        ('moveTo', ((left*aw, cap),)),
        ('lineTo', ((right*aw, cap),)),
        ('lineTo', ((right*aw, .24*cap),)),
        ('qCurveTo', ((right*aw, -.015*cap), (.28*aw, -.015*cap))),
        ('qCurveTo', ((.045*aw, -.015*cap), (.025*aw, .20*cap))),
        ('lineTo', (((.025+thickness*.47)*aw, .22*cap),)),
        ('qCurveTo', ((.20*aw, .065*cap), (.31*aw, .065*cap))),
        ('qCurveTo', (((left+.015)*aw, .065*cap), ((left+.015)*aw, .245*cap))),
        ('lineTo', ((left*aw, cap),)),
        ('closePath', ()),
    ]
    replace_glyph(font, name, body + parts[1])
    changed.append('J')

    name = cmap[ord('Q')]
    parts = contours(record_glyph(font, name))
    aw = font['hmtx'][name][0]
    tail = [
        ('moveTo', ((.30*aw, .13*cap),)),
        ('qCurveTo', ((.45*aw, .065*cap), (.57*aw, -.04*cap))),
        ('qCurveTo', ((.76*aw, -.195*cap), (.86*aw, -.14*cap))),
        ('lineTo', ((.90*aw, -.18*cap),)),
        ('qCurveTo', ((.82*aw, -.255*cap), (.67*aw, -.17*cap))),
        ('qCurveTo', ((.48*aw, -.045*cap), (.30*aw, .13*cap))),
        ('closePath', ()),
    ]
    replace_glyph(font, name, tail + [command for part in parts[1:] for command in part])
    changed.append('Q')

    name = cmap[ord('R')]
    parts = contours(record_glyph(font, name))
    aw = font['hmtx'][name][0]
    assert len(parts) == 4 and len(parts[2]) == 22, 'Unexpected R topology'
    leg_bowl = [
        ('moveTo', ((.95*aw, 0),)),
        ('lineTo', ((.75*aw, 0),)),
        ('lineTo', ((.49*aw, .425*cap),)),
        ('qCurveTo', ((.455*aw, .46*cap), (.37*aw, .46*cap))),
        *parts[2][4:15],
        ('qCurveTo', ((.655*aw, .445*cap), (.72*aw, .25*cap), (.935*aw, .055*cap))),
        ('lineTo', ((.99*aw, .04*cap),)),
        ('lineTo', ((.99*aw, 0),)),
        ('lineTo', ((.95*aw, 0),)),
        ('closePath', ()),
    ]
    replace_glyph(font, name, parts[0] + parts[1] + leg_bowl + parts[3])
    changed.append('R')

    name = cmap[ord('r')]
    parts = contours(record_glyph(font, name))
    aw = font['hmtx'][name][0]
    weight_ratio = font['OS/2'].usWeightClass / 650
    shoulder = [
        ('moveTo', ((.50*aw, .575*xh),)),
        ('lineTo', ((.44*aw, .72*xh),)),
        ('lineTo', ((.50*aw, .72*xh),)),
        ('qCurveTo', ((.61*aw, .975*xh), (.83*aw, 1.025*xh))),
        ('qCurveTo', ((.985*aw, 1.055*xh), (1.005*aw, .965*xh))),
        ('qCurveTo', ((1.025*aw, (1.015-.18*weight_ratio)*xh), (.945*aw, (1.015-.22*weight_ratio)*xh))),
        ('qCurveTo', ((.865*aw, (.995-.22*weight_ratio)*xh), (.775*aw, (.995-.13*weight_ratio)*xh))),
        ('qCurveTo', ((.715*aw, (.985-.085*weight_ratio)*xh), (.67*aw, .83*xh))),
        ('qCurveTo', ((.565*aw, .77*xh), (.50*aw, .575*xh))),
        ('closePath', ()),
    ]
    replace_glyph(font, name, parts[0] + parts[1] + shoulder)
    changed.append('r')

    name = cmap[ord('t')]
    parts = contours(record_glyph(font, name))
    body = parts[1]
    assert len(body) == 18, 'Unexpected t topology'
    left_crossbar = body[5][1][0]
    top_left = body[8][1][0]
    sweep = ('qCurveTo', ((left_crossbar[0]+.14*xh, 1.07*xh), (top_left[0], top_left[1]), (top_left[0]+.04*xh, top_left[1])))
    replace_glyph(font, name, parts[0] + body[:6] + [sweep] + body[9:])
    changed.append('t')

    name = cmap[ord('f')]
    parts = contours(record_glyph(font, name))
    body = parts[1]
    aw = font['hmtx'][name][0]
    ah = font['glyf'][name].yMax
    inner_end = body[18][1][-1]
    crown = [
        ('qCurveTo', ((.63*aw, .995*ah), (.84*aw, .995*ah))),
        ('qCurveTo', ((1.04*aw, .995*ah), (1.04*aw, .86*ah))),
        ('lineTo', ((.85*aw, .86*ah),)),
        ('qCurveTo', ((.85*aw, .94*ah), (.77*aw, .94*ah))),
        ('qCurveTo', ((.65*aw, .94*ah), (.64*aw, .78*ah), inner_end)),
    ]
    replace_glyph(font, name, parts[0] + body[:9] + crown + body[19:] + parts[2])
    changed.append('f')

    name = cmap[ord('j')]
    parts = contours(record_glyph(font, name))
    body = parts[0]
    aw = font['hmtx'][name][0]
    dh = abs(font['glyf'][cmap[ord('p')]].yMin)
    inner_base = body[9][1][-1]
    right_base = body[17][1][-1]
    tail = [
        ('moveTo', (inner_base,)),
        *body[10:18],
        ('qCurveTo', ((right_base[0], -.35*dh), (.52*aw, -.93*dh), (-.045*aw, -dh))),
        ('lineTo', ((-.10*aw, -.83*dh),)),
        ('qCurveTo', ((.23*aw, -.72*dh), (.31*aw, -.36*dh), inner_base)),
        ('closePath', ()),
    ]
    replace_glyph(font, name, tail + parts[1])
    changed.append('j')

    name = cmap[ord('y')]
    parts = contours(record_glyph(font, name))
    aw = font['hmtx'][name][0]
    dh = abs(font['glyf'][name].yMin)
    terminal = [
        parts[0][0],
        ('qCurveTo', ((.07*aw, -dh), (0, -.85*dh))),
        ('lineTo', ((.06*aw, -.64*dh),)),
        ('qCurveTo', ((.14*aw, -.75*dh), (.22*aw, -.73*dh))),
        *parts[0][7:],
    ]
    replace_glyph(font, name, terminal + [command for part in parts[1:] for command in part])
    changed.append('y')

    name = cmap[ord('a')]
    parts = contours(record_glyph(font, name))
    body = parts[1]
    aw = font['hmtx'][name][0]
    bottom = body[0][1][0]
    stem = body[12][1][0][0]
    foot = [
        *body[:13],
        ('qCurveTo', ((stem, .065*xh), (.925*aw, .055*xh))),
        ('lineTo', ((aw, .055*xh),)),
        ('lineTo', ((aw, -.005*xh),)),
        ('qCurveTo', ((.905*aw, -.028*xh), bottom)),
        ('closePath', ()),
    ]
    replace_glyph(font, name, parts[0] + foot)
    changed.append('a')

    name = cmap[ord('ß')]
    original = record_glyph(font, name)
    aw = font['hmtx'][name][0]
    crossbar = [
        ('moveTo', ((.035*aw, .925*xh),)),
        ('lineTo', ((.035*aw, 1.005*xh),)),
        ('lineTo', ((.235*aw, 1.035*xh),)),
        ('lineTo', ((.235*aw, .925*xh),)),
        ('closePath', ()),
    ]
    replace_glyph(font, name, original + crossbar)
    changed.append('ß')

    name = cmap[ord('ẞ')]
    aw = font['hmtx'][name][0]
    stroke = min(.205, max(.105, font['OS/2'].usWeightClass*.000245))
    left = .145
    right = left + stroke
    eszett = [
        ('moveTo', ((.035*aw, 0),)),
        ('lineTo', ((.035*aw, .055*cap),)),
        ('lineTo', ((left*aw, .075*cap),)),
        ('lineTo', ((left*aw, .91*cap),)),
        ('lineTo', ((.035*aw, .93*cap),)),
        ('lineTo', ((.035*aw, cap),)),
        ('lineTo', ((.965*aw, cap),)),
        ('lineTo', ((.965*aw, .92*cap),)),
        ('lineTo', ((.645*aw, .56*cap),)),
        ('qCurveTo', ((.95*aw, .51*cap), (.96*aw, .265*cap))),
        ('qCurveTo', ((.96*aw, -.02*cap), (.67*aw, -.02*cap))),
        ('qCurveTo', ((.46*aw, -.02*cap), (.37*aw, .165*cap))),
        ('lineTo', ((.45*aw, .205*cap),)),
        ('qCurveTo', ((.55*aw, .065*cap), (.665*aw, .065*cap))),
        ('qCurveTo', (((.96-stroke)*aw, .065*cap), ((.96-stroke)*aw, .26*cap))),
        ('qCurveTo', (((.96-stroke)*aw, .43*cap), (.625*aw, .44*cap))),
        ('lineTo', ((.49*aw, .44*cap),)),
        ('lineTo', ((.465*aw, .49*cap),)),
        ('lineTo', ((.805*aw, .91*cap),)),
        ('lineTo', ((right*aw, .91*cap),)),
        ('lineTo', ((right*aw, .075*cap),)),
        ('lineTo', (((right+.115)*aw, .055*cap),)),
        ('lineTo', (((right+.115)*aw, 0),)),
        ('closePath', ()),
    ]
    replace_glyph(font, name, eszett)
    changed.append('ẞ')
    return changed


def refine_widths(font):
    """Shorter feet on I/i/l and a compact r preserve their stem thickness."""
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    originals = {}
    bases = {}
    for code, name in cmap.items():
        base = unicodedata.normalize('NFD', chr(code))[0]
        if base in 'IilrJj':
            bases[name] = base
    # Record before altering any shared components.
    for name in bases:
        pen = DecomposingRecordingPen(glyphs)
        glyphs[name].draw(pen)
        originals[name] = pen.value
    from audit_spacing import profiles
    base_profiles = profiles(font,{cmap[ord(base)] for base in 'Iil'})
    bounds_before = {name:(font['glyf'][name].xMin,font['glyf'][name].xMax) for name in bases}
    maps = {}
    changes = []
    for name, commands in originals.items():
        base = bases[name]
        advance = font['hmtx'][name][0]
        if base in 'Iil':
            reference = cmap[ord(base)]
            reference_profile = base_profiles[reference]
            height = font['glyf'][cmap[ord('H' if base=='I' else 'x')]].yMax
            sample = reference_profile[round((height*.4-.5)/2)]
            left,right = sample
            factor = {'I':.40,'i':.77,'l':.71}[base]
            x_min,x_max = bounds_before[name]
            delta = -(1-factor)*(max(0,left-x_min)+max(0,x_max-right))
            shift = delta/2
            def xmap(x, lo=left, hi=right, c=factor, shift=shift):
                if x < lo:
                    return lo+(x-lo)*c+shift
                if x > hi:
                    return hi+(x-hi)*c+shift
                return x+shift
        elif base == 'r':
            pivot = advance*.50
            factor = .64
            delta = -(advance-pivot)*(1-factor)
            def xmap(x,pivot=pivot,factor=factor):
                return x if x <= pivot else pivot+(x-pivot)*factor
        elif base == 'j':
            delta = -advance*.17
            def xmap(x):
                return x
        else:
            # Open the J bowl while the vertical stroke keeps its own width.
            delta = advance*.16
            start,end = advance*.12,advance*.30
            def xmap(x,start=start,end=end,delta=delta):
                return x+delta*max(0,min(1,(x-start)/(end-start)))
        mapped = [(operation,tuple(None if p is None else (xmap(p[0]),p[1]) for p in points)) for operation,points in commands]
        replace_glyph(font,name,mapped)
        _,bearing=font['hmtx'][name]
        font['hmtx'][name]=(int(round(advance+delta)),bearing)
        maps[name]=xmap
        changes.append(name)
    font._pat_anchor_xmaps = maps
    return changes


def round_serif_brackets(font):
    """Replace straight serif shoulders with tangent quadratic brackets.

    Only the source's separate six-point serif polygons are considered.
    Stem edges come from the same licensed glyph at the joining height;
    widths, serif tips, baseline and cap line are preserved.
    """
    from audit_spacing import SegmentsPen
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    result = []
    for letter in 'BDEFGHIJKLMNPRTUYbdhiklmnpru':
        name = cmap[ord(letter)]
        parts = contours(record_glyph(font, name))
        pen = SegmentsPen(glyphs)
        glyphs[name].draw(pen)
        changed = False
        replacements = []
        for part in parts:
            if len(part) != 7 or any(op not in ('moveTo', 'lineTo', 'closePath') for op, _ in part):
                replacements.extend(part)
                continue
            points = [p[0] for op, p in part if op != 'closePath']
            xs = sorted(set(round(p[0], 4) for p in points))
            ys = sorted(set(round(p[1], 4) for p in points))
            if len(xs) != 4 or len(ys) != 3:
                replacements.extend(part)
                continue
            left, right = xs[0], xs[-1]
            inner = [p for p in points if left+.01 < p[0] < right-.01]
            if len(inner) != 2 or abs(inner[0][1]-inner[1][1]) > .01:
                replacements.extend(part)
                continue
            shoulder = inner[0][1]
            bottom = abs(shoulder-ys[-1]) < .01
            if not bottom and abs(shoulder-ys[0]) >= .01:
                replacements.extend(part)
                continue
            base, tip = (ys[0], ys[1]) if bottom else (ys[-1], ys[1])
            direction = 1 if bottom else -1
            height = min((right-left)*.24, max(30, abs(tip-base)*1.65))
            join = tip + direction*height
            crossings = sorted(x1+(join-y1)*(x2-x1)/(y2-y1)
                               for (x1,y1),(x2,y2) in pen.segments
                               if y1 != y2 and min(y1,y2) <= join < max(y1,y2))
            center = (inner[0][0]+inner[1][0])/2
            stems = [(a,b) for a,b in zip(crossings[::2],crossings[1::2]) if a <= center <= b]
            if len(stems) != 1:
                replacements.extend(part)
                continue
            lo, hi = stems[0]
            if not left < lo < hi < right:
                replacements.extend(part)
                continue
            lo += .75  # Join just inside the existing stroke.
            hi -= .75
            if bottom:
                curve = [('moveTo',((left,base),)), ('lineTo',((left,tip),)),
                         ('qCurveTo',((lo,tip),(lo,join))), ('lineTo',((hi,join),)),
                         ('qCurveTo',((hi,tip),(right,tip))), ('lineTo',((right,base),)),
                         ('closePath',())]
            else:
                curve = [('moveTo',((left,base),)), ('lineTo',((right,base),)),
                         ('lineTo',((right,tip),)), ('qCurveTo',((hi,tip),(hi,join))),
                         ('lineTo',((lo,join),)), ('qCurveTo',((lo,tip),(left,tip))),
                         ('closePath',())]
            replacements.extend(curve)
            changed = True
        if changed:
            replace_glyph(font,name,replacements)
            result.append(letter)
    return result


def compact_spacing(font, amount):
    """Reduce Latin side space without horizontally scaling the outlines.

    The outline origin and mark anchors stay together. Pair clearance is
    checked afterwards. Common f ligatures are rebuilt at their new advances.
    """
    if not amount:
        return 0
    cmap = font.getBestCmap()
    names = set()
    for code, name in cmap.items():
        char = chr(code)
        if char.isalpha() and 'LATIN' in unicodedata.name(char, ''):
            names.add(name)
    for name in names:
        advance, bearing = font['hmtx'][name]
        font['hmtx'][name] = (advance-int(amount), bearing)
    return len(names)


def add_pair_adjustments(font, pairs):
    """Append an additive kern lookup without replacing the upstream layout."""
    if not pairs:
        return
    values = {}
    for pair, amount in pairs.items():
        record = ValueRecord()
        record.XAdvance = int(round(amount))
        if record.XAdvance:
            values[pair] = (record, None)
    if not values:
        return
    lookup = otTables.Lookup()
    lookup.LookupType = 2
    lookup.LookupFlag = 0
    lookup.SubTable = [buildPairPosGlyphsSubtable(values, font.getReverseGlyphMap(), valueFormat1=4, valueFormat2=0)]
    lookup.SubTableCount = 1
    table = font['GPOS'].table
    index = len(table.LookupList.Lookup)
    table.LookupList.Lookup.append(lookup)
    table.LookupList.LookupCount = len(table.LookupList.Lookup)
    for feature in table.FeatureList.FeatureRecord:
        if feature.FeatureTag == 'kern':
            feature.Feature.LookupListIndex.append(index)
            feature.Feature.LookupCount = len(feature.Feature.LookupListIndex)


def refine_kerning(font):
    cmap = font.getBestCmap()
    letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÄÖÜäöüßẞ'
    opening = {'W': -18, 'V': -26, 'T': -22, 'F': -18, 'Y': -24}
    pairs = {}
    for first in letters:
        first_base = unicodedata.normalize('NFD', first)[0]
        for second in letters:
            second_base = unicodedata.normalize('NFD', second)[0]
            correction = 0
            if first_base in opening and second_base in 'acdegoqu':
                correction = opening[first_base]
            if first_base == 'W' and second_base == 'a':
                correction = 0
            if first_base == 'r' and second_base in 'acego':
                correction = -10
            if correction:
                pairs[(cmap[ord(first)], cmap[ord(second)])] = correction
    add_pair_adjustments(font, pairs)
    return len(pairs)


def protect_pair_clearance(font):
    """Open only intersecting letter pairs; retain all other optical spacing."""
    from audit_spacing import audit
    report = audit(font, ligatures=False)
    cmap = font.getBestCmap()
    adjustments = {}
    changes = []
    for collision in report['contour_collisions']:
        first, second = collision['pair']
        amount = math.ceil(4-collision['minimum_gap_units'])
        adjustments[(cmap[ord(first)],cmap[ord(second)])] = amount
        changes.append({'pair':first+second,'x_advance_added':amount})
    add_pair_adjustments(font,adjustments)
    return changes


def rebuild_f_ligatures(font):
    """Use the revised f/j/t in common ligatures, including their new spacing."""
    from audit_spacing import raw_font, shape
    import uharfbuzz as hb
    shaper = hb.Font(hb.Face(raw_font(font)))
    cmap = font.getBestCmap()
    reverse = {name:chr(code) for code,name in cmap.items() if code < 128}
    order = font.getGlyphOrder()
    glyphs = font.getGlyphSet()
    outputs = []
    for record in font['GSUB'].table.FeatureList.FeatureRecord:
        if record.FeatureTag != 'liga':
            continue
        for index in record.Feature.LookupListIndex:
            for sub in font['GSUB'].table.LookupList.Lookup[index].SubTable:
                for first, ligatures in getattr(sub,'ligatures',{}).items():
                    if first != cmap[ord('f')]:
                        continue
                    for ligature in ligatures:
                        text = ''.join(reverse[name] for name in [first,*ligature.Component])
                        positioned = shape(shaper,text,ligatures=False)
                        pen = DecomposingRecordingPen(glyphs)
                        cursor = 0
                        for glyph, advance, x, y in positioned:
                            glyphs[order[glyph]].draw(TransformPen(pen,(1,0,0,1,cursor+x,y)))
                            cursor += advance
                        replace_glyph(font,ligature.LigGlyph,pen.value)
                        _,bearing = font['hmtx'][ligature.LigGlyph]
                        font['hmtx'][ligature.LigGlyph] = (cursor,bearing)
                        outputs.append(text)
    return outputs
