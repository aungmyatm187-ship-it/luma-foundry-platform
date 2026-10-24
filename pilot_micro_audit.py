from pathlib import Path
import re

files = [Path('client/src/pages/EmberSignal.tsx'), Path('client/src/pages/AxiomGrid.tsx')]
for path in files:
    text = path.read_text()
    ids = set(re.findall(r'\bid=["\']([^"\']+)', text))
    anchors = re.findall(r'href=["\']#([^"\']+)', text)
    missing = sorted(set(anchors) - ids)
    buttons = re.findall(r'<button(.*?)>', text, flags=re.S)
    no_type = [b.strip().replace('\n', ' ')[:120] for b in buttons if 'type=' not in b]
    print(path)
    print('anchors=', anchors)
    print('missing_anchor_targets=', missing)
    print('buttons_without_type=', no_type)
    print('placeholder_markers=', sorted(set(re.findall(r'(?i)\b(?:TODO|FIXME|lorem ipsum|coming soon)\b', text))))
    print()

css_paths = [Path('client/src/pages/axiom-grid.css'), Path('client/src/index.css')]
for path in css_paths:
    if path.exists():
        text = path.read_text()
        durations = sorted(set(re.findall(r'(?<![\w-])(?:\d+(?:\.\d+)?)(?:ms|s)(?![\w-])', text)))
        print(path, 'timings=', durations)

a = Path('data/ember-signal-evidence.json')
print('evidence_file_exists=', a.exists())
if a.exists():
    print('evidence_file_bytes=', a.stat().st_size)
      
if any(True for _ in []):
    raise SystemExit(1)
