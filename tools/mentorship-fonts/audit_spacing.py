"""Check every Latin/German letter pair with the font's actual shaping.

This geometry check is not a substitute for reading the visual word proofs.
Only the built OFL fonts are inputs; reference fonts are never read.
"""
from pathlib import Path
import argparse
import io
import json
import math

from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
import uharfbuzz as hb

LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÄÖÜäöüßẞ'
WORDS = ['Weekly Reviews', 'Welche Dealing Range zählt?', 'größere Märkte', 'Straße', 'heißen', 'Äußere Liquidität', 'AVATAR', 'To Wa We Wo Wi', 'TÄ TÖ TÜ Tä Tö Tü', 'Fä Yö Vü', 'ßa ße ßi ßo ßu', 'ẞA ẞE ẞI ẞO ẞU', 'Illiquide Märkte', 'fff fi fl ffi ffl']


class SegmentsPen(BasePen):
    def __init__(self, glyphs):
        super().__init__(glyphs)
        self.segments = []
        self.start = None

    def _moveTo(self, point):
        self.start = point

    def _lineTo(self, point):
        self.segments.append((self._getCurrentPoint(), point))

    def _qCurveToOne(self, control, end):
        start = self._getCurrentPoint()
        previous = start
        for step in range(1, 25):
            t = step/24
            point = tuple((1-t)**2*start[i]+2*(1-t)*t*control[i]+t*t*end[i] for i in range(2))
            self.segments.append((previous, point))
            previous = point

    def _curveToOne(self, first, second, end):
        start = self._getCurrentPoint()
        previous = start
        for step in range(1, 33):
            t = step/32
            point = tuple((1-t)**3*start[i]+3*(1-t)**2*t*first[i]+3*(1-t)*t*t*second[i]+t**3*end[i] for i in range(2))
            self.segments.append((previous, point))
            previous = point

    def _closePath(self):
        end = self._getCurrentPoint()
        if end != self.start:
            self.segments.append((end, self.start))

    def _endPath(self):
        pass


def profiles(font, names, step=2):
    glyphs = font.getGlyphSet()
    result = {}
    for name in names:
        pen = SegmentsPen(glyphs)
        glyphs[name].draw(pen)
        rows = {}
        for (x1,y1),(x2,y2) in pen.segments:
            if y1 == y2:
                continue
            # Half-unit offset avoids sampling exactly on a contour vertex.
            lo = math.ceil((min(y1,y2)-.5)/step)
            hi = math.floor((max(y1,y2)-.5)/step)
            for index in range(lo,hi+1):
                y = index*step+.5
                if min(y1,y2) <= y < max(y1,y2):
                    x = x1+(y-y1)*(x2-x1)/(y2-y1)
                    if index not in rows:
                        rows[index] = [x,x]
                    else:
                        rows[index][0] = min(rows[index][0],x)
                        rows[index][1] = max(rows[index][1],x)
        result[name] = rows
    return result


def raw_font(font):
    buffer = io.BytesIO()
    flavor = font.flavor
    font.flavor = None
    font.save(buffer)
    font.flavor = flavor
    return buffer.getvalue()


def shape(font, text, kern=True, ligatures=True):
    buffer = hb.Buffer()
    buffer.add_str(text)
    buffer.guess_segment_properties()
    hb.shape(font,buffer,{'kern':kern,'liga':ligatures})
    return [(g.codepoint,p.x_advance,p.x_offset,p.y_offset) for g,p in zip(buffer.glyph_infos,buffer.glyph_positions)]


def audit(font, ligatures=True):
    data = raw_font(font)
    shaper = hb.Font(hb.Face(data))
    order = font.getGlyphOrder()
    cmap = font.getBestCmap()
    outlines = profiles(font,{cmap[ord(letter)] for letter in LETTERS})
    collisions = []
    closest = []
    combined = []
    kerned = 0
    for first in LETTERS:
        for second in LETTERS:
            text = first+second
            positioned = shape(shaper,text,ligatures=ligatures)
            assert all(g[0] for g in positioned), (text,'missing glyph')
            unkerned = shape(shaper,text,kern=False,ligatures=ligatures)
            if sum(p[1] for p in positioned) != sum(p[1] for p in unkerned):
                kerned += 1
            if len(positioned) != 2:
                combined.append(text)
                continue
            one,two = positioned
            if one[3] or two[3]:
                raise ValueError((text,'vertical pair offset needs separate geometry'))
            left = outlines[order[one[0]]]
            right = outlines[order[two[0]]]
            shared = left.keys() & right.keys()
            gap = min((one[1]+two[2]+right[y][0]-one[2]-left[y][1] for y in shared),default=9999)
            entry = {'pair':text,'minimum_gap_units':round(gap,2),'kern_units':sum(p[1] for p in positioned)-sum(p[1] for p in unkerned)}
            closest.append(entry)
            if gap < -.5:
                collisions.append(entry)
    return {
        'family':font['name'].getDebugName(16),
        'style':font['name'].getDebugName(17),
        'version':font['name'].getDebugName(5),
        'letters':LETTERS,
        'pairs_checked':len(LETTERS)**2,
        'kerned_pairs':kerned,
        'ligatures_enabled':ligatures,
        'shaped_ligatures':combined,
        'contour_collisions':collisions,
        'closest_pairs':sorted(closest,key=lambda entry:entry['minimum_gap_units'])[:24],
        'words':[{'text':text,'advance_units':sum(p[1] for p in shape(shaper,text,ligatures=ligatures)),'glyphs':len(shape(shaper,text,ligatures=ligatures))} for text in WORDS],
    }


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('fonts',nargs='+',type=Path)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--no-ligatures',action='store_true')
    args=parser.parse_args()
    reports=[]
    for path in args.fonts:
        report=audit(TTFont(path),ligatures=not args.no_ligatures)
        report['file']=path.name
        reports.append(report)
        print(path.name,report['pairs_checked'],'pairs;',len(report['contour_collisions']),'potential contour collisions;',report['kerned_pairs'],'kerned pairs',flush=True)
    args.output.write_text(json.dumps({'method':'24-segment quadratic approximation; 2-unit scanlines; actual HarfBuzz shaping; negative ink gaps flagged; visual quality requires separate proof','fonts':reports},ensure_ascii=False,indent=2)+'\n')
