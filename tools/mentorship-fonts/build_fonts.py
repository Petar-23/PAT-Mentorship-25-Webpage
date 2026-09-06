"""Build the PAT OFL derivatives. No proprietary font is an input.

Run with Python, fontTools[woff] and uharfbuzz; sources must match source-manifest.
The source directory is the pinned Google Fonts package from the typography study.
"""
from pathlib import Path
import argparse
import hashlib
import io
import json
import unicodedata

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.misc.roundTools import otRound
import uharfbuzz as hb
from serif_refinements import refine_serif, refine_widths, refine_kerning, protect_pair_clearance, rebuild_f_ligatures

ROOT = Path(__file__).resolve().parent
STYLES = [(400, 'Regular'), (500, 'Medium'), (600, 'Semibold'), (700, 'Bold')]
REQUIRED = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ÄÖÜäöüßẞ€%‰−–—„“‚‘’…:;,.!?()[]{}<>/\\@#&+*= °²³±×÷→←↑↓'
FAMILIES = [
    {'name': 'PAT Sans', 'source': 'InstrumentSans', 'axis_suffix': '[wdth,wght]', 'license': 'instrumentsans-OFL.txt', 'pin': {'wdth': 100}, 'sx': 1.025, 'caps_sx': 1.0, 'widths': {'a': 1.13, 'W': .95, 'M': 1.03, 'R': 1.02, 'A': 1.03}, 'xheight': 534, 'cap': 728, 'ascender': 750, 'descender': 220, 'width_factor': .965, 'weights': {400: 455, 500: 555, 600: 650, 700: 700}},
    {'name': 'PAT Serif', 'source': 'SourceSerif4', 'axis_suffix': '[opsz,wght]', 'license': 'sourceserif4-OFL.txt', 'pin': {'opsz': 28}, 'sx': 1.095, 'caps_sx': 1.18, 'widths': {'A': 1.22, 'B': 1.14, 'C': 1.20, 'H': 1.14, 'K': 1.15, 'M': 1.12, 'P': 1.12, 'R': 1.20, 'U': 1.08, 'V': 1.21, 'W': 1.14, 'X': 1.26, 'Y': 1.20, 'ẞ': 1.24, 'a': 1.08, 'b': 1.08, 'c': 1.03, 'e': 1.035, 'f': 1.065, 'g': 1.085, 'k': 1.065, 'o': 1.06, 'p': 1.08, 'q': 1.07, 's': 1.07, 't': 1.06, 'w': 1.065}, 'xheight': 518, 'cap': 748, 'ascender': 768, 'descender': 240, 'width_factor': 1.03, 'weights': {400: 450, 500: 555, 600: 675, 700: 755}, 'version': '0.4'},
]


def glyph_transforms(font, config):
    """Separate cap height from x-height without raising lowercase ascenders."""
    cmap = font.getBestCmap()
    reverse = {glyph: chr(code) for code, glyph in cmap.items()}
    glyf = font['glyf']
    xheight = glyf[cmap[ord('x')]].yMax
    cap = glyf[cmap[ord('H')]].yMax
    ascender = glyf[cmap[ord('l')]].yMax
    descender = abs(glyf[cmap[ord('p')]].yMin)
    transforms = {}
    for name in font.getGlyphOrder():
        token = name.split('.')[0].split('_')[0]
        char = reverse.get(name)
        if char:
            base = unicodedata.normalize('NFD', char)[0]
        else:
            base = token if len(token) == 1 and token.isalpha() else ''
        uppercase = bool(base and base.isupper())
        number = bool(char and char.isdigit()) or token in ('zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine')
        sx = config['widths'].get(base, config['caps_sx'] if uppercase else config['sx']) * config['width_factor']
        if uppercase or number:
            sy = config['cap'] / cap
            ymap = lambda y, sy=sy: y * sy
        else:
            def ymap(y, xh=xheight, ah=ascender, dh=descender, c=config):
                if y < 0:
                    return y * c['descender'] / dh
                if y <= xh:
                    return y * c['xheight'] / xh
                if y <= ah:
                    return c['xheight'] + (y-xh) * (c['ascender']-c['xheight']) / (ah-xh)
                return c['ascender'] + (y-ah) * c['xheight'] / xh
        anchor_xmap = getattr(font,'_pat_anchor_xmaps',{}).get(name,lambda x:x)
        transforms[name] = (sx, ymap, anchor_xmap)
    return transforms


def transform_anchor(anchor, glyph, transforms):
    if anchor is None:
        return
    sx, ymap, xmap = transforms[glyph]
    anchor.XCoordinate = otRound(xmap(anchor.XCoordinate) * sx)
    anchor.YCoordinate = otRound(ymap(anchor.YCoordinate))
    # Contour point indices no longer refer to the re-encoded outlines.
    if anchor.Format == 2:
        anchor.Format = 1
        del anchor.AnchorPoint


def transform_layout(font, transforms, scale_classes=False):
    """Move base/mark/ligature anchors with their own glyph transformation."""
    def marks(coverage, array):
        for glyph, record in zip(coverage.glyphs, array.MarkRecord):
            transform_anchor(record.MarkAnchor, glyph, transforms)

    def value(record, glyph):
        if record is None:
            return
        sx, ymap, _ = transforms[glyph]
        for key in ('XAdvance', 'XPlacement'):
            if hasattr(record, key):
                setattr(record, key, otRound(getattr(record, key)*sx))
        for key in ('YAdvance', 'YPlacement'):
            if hasattr(record, key):
                setattr(record, key, otRound(ymap(getattr(record, key))))

    def subtable(kind, sub):
        if kind == 9:
            subtable(sub.ExtensionLookupType, sub.ExtSubTable)
        elif kind == 4:
            marks(sub.MarkCoverage, sub.MarkArray)
            for glyph, record in zip(sub.BaseCoverage.glyphs, sub.BaseArray.BaseRecord):
                for anchor in record.BaseAnchor:
                    transform_anchor(anchor, glyph, transforms)
        elif kind == 5:
            marks(sub.MarkCoverage, sub.MarkArray)
            for glyph, attach in zip(sub.LigatureCoverage.glyphs, sub.LigatureArray.LigatureAttach):
                for record in attach.ComponentRecord:
                    for anchor in record.LigatureAnchor:
                        transform_anchor(anchor, glyph, transforms)
        elif kind == 6:
            marks(sub.Mark1Coverage, sub.Mark1Array)
            for glyph, record in zip(sub.Mark2Coverage.glyphs, sub.Mark2Array.Mark2Record):
                for anchor in record.Mark2Anchor:
                    transform_anchor(anchor, glyph, transforms)
        elif kind == 3:
            for glyph, record in zip(sub.Coverage.glyphs, sub.EntryExitRecord):
                transform_anchor(record.EntryAnchor, glyph, transforms)
                transform_anchor(record.ExitAnchor, glyph, transforms)
        elif kind == 1:
            if sub.Format == 1:
                value(sub.Value, sub.Coverage.glyphs[0])
            else:
                for glyph, record in zip(sub.Coverage.glyphs, sub.Value):
                    value(record, glyph)
        elif kind == 2 and sub.Format == 1:
            for first, pair_set in zip(sub.Coverage.glyphs, sub.PairSet):
                for record in pair_set.PairValueRecord:
                    value(record.Value1, first)
                    value(record.Value2, record.SecondGlyph)
        elif kind == 2 and sub.Format == 2 and scale_classes:
            first_classes = {}
            second_classes = {}
            for glyph in sub.Coverage.glyphs:
                first_classes.setdefault(sub.ClassDef1.classDefs.get(glyph, 0), []).append(transforms[glyph][0])
            for glyph, index in sub.ClassDef2.classDefs.items():
                second_classes.setdefault(index, []).append(transforms[glyph][0])
            for first_index, first_record in enumerate(sub.Class1Record):
                first_scales = first_classes.get(first_index, [1.0])
                for second_index, pair_record in enumerate(first_record.Class2Record):
                    second_scales = second_classes.get(second_index, [1.0])
                    for record, scales in ((pair_record.Value1, first_scales), (pair_record.Value2, second_scales)):
                        if record is not None:
                            for key in ('XAdvance', 'XPlacement'):
                                if hasattr(record, key):
                                    setattr(record, key, otRound(getattr(record, key)*sum(scales)/len(scales)))
    for lookup in font['GPOS'].table.LookupList.Lookup:
        for sub in lookup.SubTable:
            subtable(lookup.LookupType, sub)
    carets = getattr(font['GDEF'].table, 'LigCaretList', None)
    if carets:
        for glyph, record in zip(carets.Coverage.glyphs, carets.LigGlyph):
            for caret in record.CaretValue:
                if caret.Format in (1, 3):
                    caret.Coordinate = otRound(caret.Coordinate * transforms[glyph][0])
                else:
                    raise ValueError('Point-indexed caret requires explicit rebuilding')


def new_glyph(font, name, pen, advance):
    glyph = pen.glyph()
    if glyph.numberOfContours > 0:
        glyph.flags[0] |= 0x40  # OVERLAP_SIMPLE: retain non-zero fill on macOS.
    glyph.recalcBounds(font['glyf'])
    font['glyf'][name] = glyph
    font['hmtx'][name] = (otRound(advance), getattr(glyph, 'xMin', 0))


def ensure_symbols(font):
    """Add the three missing study symbols from the licensed source outlines."""
    cmap = font.getBestCmap()
    for char, digit in [('²', '2'), ('³', '3')]:
        if ord(char) in cmap:
            continue
        name = 'uni%04X' % ord(char)
        source = cmap[ord(digit)]
        pen = TTGlyphPen(font.getGlyphSet())
        pen.addComponent(source, (.6, 0, 0, .6, 0, 330))
        new_glyph(font, name, pen, font['hmtx'][source][0] * .6)
        for table in font['cmap'].tables:
            if table.isUnicode():
                table.cmap[ord(char)] = name
    if ord('±') not in cmap:
        name = 'plusminus'
        source = cmap[ord('+')]
        advance = font['hmtx'][source][0]
        pen = TTGlyphPen(font.getGlyphSet())
        pen.addComponent(source, (.88, 0, 0, .88, advance*.06, 170))
        bounds = font['glyf'][source]
        left = bounds.xMin*.88+advance*.06
        right = bounds.xMax*.88+advance*.06
        letter = font['glyf'][cmap[ord('I')]]
        thickness = (letter.xMax-letter.xMin)*.8
        pen.moveTo((left, 0))
        pen.lineTo((left, thickness))
        pen.lineTo((right, thickness))
        pen.lineTo((right, 0))
        pen.closePath()
        new_glyph(font, name, pen, advance)
        for table in font['cmap'].tables:
            if table.isUnicode():
                table.cmap[ord('±')] = name


def shape(data, text, features=None):
    face = hb.Face(data)
    font = hb.Font(face)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf, features or {})
    return [(i.codepoint, p.x_advance, p.x_offset, p.y_offset) for i, p in zip(buf.glyph_infos, buf.glyph_positions)]


def build(source_root, family_filter=None, weight_filter=None):
    manifest = json.loads((source_root/'source-manifest.json').read_text())
    expected = {entry['path']: entry for entry in manifest['files']}
    used_paths = set()
    for family in FAMILIES:
        used_paths.add('licenses/'+family['license'])
        for italic in (False, True):
            used_paths.add('source-fonts/'+family['source']+('-Italic' if italic else '')+family['axis_suffix']+'.ttf')
    output_manifest = {**manifest, 'files': [entry for entry in manifest['files'] if entry['path'] in used_paths]}
    report = {'version': '0.4', 'upstream_commit': manifest['commit'], 'families': FAMILIES, 'fonts': []}
    (ROOT/'fonts').mkdir(exist_ok=True)
    (ROOT/'licenses').mkdir(exist_ok=True)
    for config in FAMILIES:
        if family_filter and config['name'] != family_filter:
            continue
        license_text = (source_root/'licenses'/config['license']).read_text()
        (ROOT/'licenses'/config['license']).write_text(license_text)
        for italic in (False, True):
            styles = STYLES if not italic else [STYLES[0], STYLES[-1]]
            source_name = config['source'] + ('-Italic' if italic else '') + config['axis_suffix'] + '.ttf'
            source = source_root/'source-fonts'/source_name
            source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
            assert source_hash == expected['source-fonts/'+source_name]['sha256']
            for weight, style in styles:
                if weight_filter and (weight != weight_filter or italic):
                    continue
                style = ('Italic' if weight == 400 else style+' Italic') if italic else style
                axes = {**config['pin'], 'wght': config['weights'][weight]}
                font = instantiateVariableFont(TTFont(source), axes, inplace=True)
                refinements = refine_serif(font, italic) if config['name'] == 'PAT Serif' else []
                width_refinements = refine_widths(font) if config['name'] == 'PAT Serif' and not italic else []
                transforms = glyph_transforms(font, config)
                glyph_set = font.getGlyphSet()
                recordings = {}
                for name in font.getGlyphOrder():
                    rec = DecomposingRecordingPen(glyph_set)
                    glyph_set[name].draw(rec)
                    recordings[name] = rec
                for name, rec in recordings.items():
                    pen = TTGlyphPen(None)
                    sx, ymap, _ = transforms[name]
                    for operation, points in rec.value:
                        mapped = [None if p is None else (p[0]*sx, ymap(p[1])) for p in points]
                        getattr(pen, operation)(*mapped)
                    new_glyph(font, name, pen, font['hmtx'][name][0] * sx)
                # Keep PAT Sans 0.3 unchanged while refining the Serif class kerning.
                transform_layout(font, transforms, scale_classes=config['name'] == 'PAT Serif')
                adjusted_pairs = refine_kerning(font) if config['name'] == 'PAT Serif' and not italic else 0
                clearance_pairs = protect_pair_clearance(font) if config['name'] == 'PAT Serif' else []
                rebuilt_ligatures = rebuild_f_ligatures(font) if config['name'] == 'PAT Serif' and not italic else []
                assert any(r.FeatureTag == 'tnum' for r in font['GSUB'].table.FeatureList.FeatureRecord), 'Pinned sources must retain tnum'
                ensure_symbols(font)
                os2 = font['OS/2']
                bounds = [g for g in font['glyf'].glyphs.values() if getattr(g, 'numberOfContours', 0)]
                os2.sxHeight, os2.sCapHeight = config['xheight'], config['cap']
                os2.usWinAscent = max(g.yMax for g in bounds)
                os2.usWinDescent = max(-g.yMin for g in bounds)
                font['hhea'].ascent = os2.sTypoAscender = max(os2.sTypoAscender, os2.usWinAscent)
                font['hhea'].descent = os2.sTypoDescender = min(os2.sTypoDescender, -os2.usWinDescent)
                os2.usWeightClass = weight
                os2.fsType = 0
                os2.fsSelection = (1 << 7) | (1 if italic else 0) | ((1 << 5) if weight == 700 else 0) | ((1 << 6) if weight == 400 and not italic else 0)
                font['head'].macStyle = (1 if weight == 700 else 0) | (2 if italic else 0)
                version = config.get('version', '0.3')
                font['head'].fontRevision = float(version)
                font['head'].created = font['head'].modified = 3871497600
                font.recalcTimestamp = False
                family = config['name']
                ps_name = family.replace(' ', '')+'-'+style.replace(' ', '')
                names = font['name']
                original_copyright = names.getDebugName(0) or ''
                for name_id in (1, 2, 3, 4, 5, 6, 13, 14, 16, 17, 18, 21, 22, 25):
                    names.removeNames(nameID=name_id)
                values = {0: original_copyright+' Modified for Price Action Trader, 2026.',
                          1: family if weight in (400, 700) else family+' '+style,
                          2: style if weight in (400, 700) else 'Regular',
                          3: 'PAT:'+version+':'+ps_name, 4: family+' '+style,
                          5: 'Version '+format(float(version), '.3f')+'; PAT OFL derivative prototype', 6: ps_name,
                          13: license_text, 14: 'https://openfontlicense.org',
                          16: family, 17: style}
                for name_id, value in values.items():
                    for platform, encoding, language in ((3, 1, 0x409), (1, 0, 0)):
                        names.setName(value, name_id, platform, encoding, language)
                for tag in ('DSIG', 'STAT', 'prep', 'fpgm', 'cvt ', 'gasp', 'BASE'):
                    if tag in font:
                        del font[tag]
                output = ROOT/'fonts'/(ps_name+'.woff2')
                raw = io.BytesIO()
                font.save(raw)
                raw_bytes = raw.getvalue()
                font.flavor = 'woff2'
                font.save(output)
                reopened = TTFont(output)
                reopened.flavor = None
                check = io.BytesIO()
                reopened.save(check)
                missing = sorted({ch for ch in REQUIRED if ord(ch) not in reopened.getBestCmap()})
                assert not missing, (output.name, missing)
                shaped_samples = ['Weekly Reviews', 'Welche Dealing Range zählt?', 'ÄÖÜ äöü ß ẞ', 'a\u0308 o\u0308 u\u0308', 'Illiquide 1 l I', '1.234,56 € −0,75 %', 'AVATAR To Wa ffi fl']
                for sample in shaped_samples:
                    assert shape(raw_bytes, sample) == shape(check.getvalue(), sample), (output.name, 'woff2 shape roundtrip', sample)
                    assert all(g[0] for g in shape(raw_bytes, sample)), (output.name, 'missing shaped glyph', sample)
                digit_widths = [shape(raw_bytes, str(n), {'tnum': True})[0][1] for n in range(10)]
                assert len(set(digit_widths)) == 1, (output.name, digit_widths)
                for letter in 'aou':
                    composed = unicodedata.normalize('NFC', letter+'\u0308')
                    assert shape(raw_bytes, composed) == shape(raw_bytes, letter+'\u0308'), (output.name, 'umlaut composition')
                report['fonts'].append({'file': output.name, 'version': version, 'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'source': source_name, 'source_sha256': source_hash, 'axes': axes, 'glyphs': len(reopened.getGlyphOrder()), 'unicode_characters': len(reopened.getBestCmap()), 'contour_refinements': refinements, 'width_refinements': width_refinements, 'additional_kerning_pairs': adjusted_pairs, 'clearance_adjustments': clearance_pairs, 'rebuilt_ligatures': rebuilt_ligatures, 'required_characters': 'pass', 'shaping_roundtrip': 'pass', 'tabular_figures': digit_widths[0], 'umlaut_composition': 'pass', 'cap_height': reopened['glyf'][reopened.getBestCmap()[ord('H')]].yMax, 'x_height': reopened['glyf'][reopened.getBestCmap()[ord('x')]].yMax})
                print(output.name, output.stat().st_size, 'bytes; cmap, shaping, figures, umlauts PASS', flush=True)
    (ROOT/'font-validation.json').write_text(json.dumps(report, indent=2)+'\n')
    (ROOT/'source-manifest.json').write_text(json.dumps(output_manifest, indent=2)+'\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source_root', type=Path)
    parser.add_argument('--family', choices=[family['name'] for family in FAMILIES])
    parser.add_argument('--weight', type=int, choices=[style[0] for style in STYLES])
    args = parser.parse_args()
    build(args.source_root, args.family, args.weight)
