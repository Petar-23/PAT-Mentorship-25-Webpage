# Erzeugt components/landing-v3/drawings.generated.ts aus den drei Generatoren.
# Aufruf aus dem Repo-Wurzelverzeichnis: python3 tools/landing-v3/export_drawings.py
#
# plans.py         Linienzeichnungen im Ablauf (Lektion, Power of 3, Live) und im Schluss (Kerze)
# warum_gen.py     Abschnitt Warum: Blätter ordnen sich zur Treppe (Scroll-Animation)
# lehrplan_gen.py  Lehrplan-Zeitachse: vier ICT-Zeichnungen (PD-Array-Matrix, NWOG, ORG, HTF-Bias)
#
# Die Ausgabe ist deterministisch (feste Seeds). Sie wird als String per dangerouslySetInnerHTML
# in Server Components eingebunden, daher keine Konvertierung nach JSX.
import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
TARGET = os.path.join(ROOT, 'components', 'landing-v3', 'drawings.generated.ts')

sys.path.insert(0, HERE)
sys.argv = sys.argv[:1]  # warum_gen liest Parameter aus sys.argv

import plans  # noqa: E402
import warum_gen  # noqa: E402
import lehrplan_gen  # noqa: E402

plans.OUT = tempfile.mkdtemp(prefix='lp3-plans-')

drawings = {
    'PLAN_LESSON_SVG': plans.lesson(),
    'PLAN_PO3_SVG': plans.po3(),
    'PLAN_LIVE_SVG': plans.live(),
    'PLAN_CANDLE_SVG': plans.candle(),
    'WARUM_SVG': warum_gen.build()[0],
}
lehrplan = [fn().svg() for (_, _, _, fn) in lehrplan_gen.PHASES]

for name, svg in list(drawings.items()) + [(f'LEHRPLAN_SVGS[{i}]', s) for i, s in enumerate(lehrplan)]:
    assert '–' not in svg and '—' not in svg, f'Gedankenstrich in {name}'
    assert '`' not in svg, f'Backtick in {name}'


def lit(s):
    return json.dumps(s, ensure_ascii=False)


out = [
    '// Automatisch erzeugt von tools/landing-v3/export_drawings.py. Nicht von Hand bearbeiten.',
    '// Vertrauenswürdiges, beim Build festgelegtes Markup für dangerouslySetInnerHTML.',
    '',
]
for name, svg in drawings.items():
    out.append(f'export const {name} = {lit(svg)}')
    out.append('')
out.append('export const LEHRPLAN_SVGS = [')
for svg in lehrplan:
    out.append(f'  {lit(svg)},')
out.append('] as const')
out.append('')

with open(TARGET, 'w', encoding='utf-8') as fh:
    fh.write('\n'.join(out))
print('geschrieben:', os.path.relpath(TARGET, ROOT), sum(len(s) for s in drawings.values()) + sum(len(s) for s in lehrplan), 'Zeichen SVG')
