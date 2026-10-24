#!/usr/bin/env python3
"""Generate manifest-derived CycloneDX and notice drafts for an exact release.

This intentionally does not claim formal licence verification. It reads the captured
pnpm production inventory and local package metadata, preserving unknown values.
"""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path('/home/ubuntu/luma-foundry')
CAPTURED = Path('/tmp/axiom-grid-prod-deps.json')
OUT = ROOT / 'evidence-generated'
OUT.mkdir(exist_ok=True)

product = 'prd-axiom-grid'
release = 'checkpoint-4bf92357'
commit = '4bf92357a9a47653af1331e63bc1befcd4f7bcd8'

data = json.loads(CAPTURED.read_text())
root = data[0]
deps = root.get('dependencies', {})
components = []
rows = []
for name in sorted(deps):
    item = deps[name] or {}
    version = item.get('version') or 'UNKNOWN_VERSION'
    pkg_path = Path(item.get('path', '')) if item.get('path') else None
    metadata = {}
    if pkg_path and (pkg_path / 'package.json').is_file():
        try:
            metadata = json.loads((pkg_path / 'package.json').read_text())
        except (OSError, json.JSONDecodeError):
            metadata = {}
    license_value = metadata.get('license') or metadata.get('licenses') or 'UNKNOWN_LICENCE'
    if isinstance(license_value, list):
        license_value = '; '.join(str(x) for x in license_value)
    purl = f"pkg:npm/{name}@{version}" if not name.startswith('@') else f"pkg:npm/{name}@{version}"
    component = {
        'type': 'library',
        'bom-ref': purl,
        'name': name,
        'version': version,
        'purl': purl,
        'properties': [
            {'name': 'luma:scope', 'value': 'direct-production-dependency'},
            {'name': 'luma:licence-review', 'value': 'pending'},
        ],
    }
    if license_value != 'UNKNOWN_LICENCE':
        component['licenses'] = [{'license': {'name': str(license_value)}}]
    else:
        component['properties'].append({'name': 'luma:licence', 'value': 'UNKNOWN_LICENCE'})
    components.append(component)
    rows.append((name, version, str(license_value), metadata.get('homepage', '')))

hashes = {}
for filename in ('package.json', 'pnpm-lock.yaml'):
    path = ROOT / filename
    hashes[filename] = hashlib.sha256(path.read_bytes()).hexdigest()

bom = {
    'bomFormat': 'CycloneDX',
    'specVersion': '1.5',
    'serialNumber': 'urn:uuid:luma-axiom-grid-4bf92357-draft',
    'version': 1,
    'metadata': {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'component': {'type': 'application', 'name': 'Axiom Grid', 'version': release},
        'properties': [
            {'name': 'luma:product-id', 'value': product},
            {'name': 'luma:immutable-commit', 'value': commit},
            {'name': 'luma:source-package-json-sha256', 'value': hashes['package.json']},
            {'name': 'luma:source-lockfile-sha256', 'value': hashes['pnpm-lock.yaml']},
            {'name': 'luma:status', 'value': 'DRAFT - licence and notice verification pending'},
        ],
    },
    'components': components,
}
(OUT / 'axiom-grid-cyclonedx-draft.json').write_text(json.dumps(bom, indent=2) + '\n')

lines = [
    '# Axiom Grid — Third-Party Notices Draft',
    '',
    f'**Product:** `{product}`  ',
    f'**Release:** `{release}`  ',
    f'**Immutable commit:** `{commit}`  ',
    '**Status:** Draft inventory only; package-by-package licence verification is pending.',
    '',
    'This file is generated from the captured production dependency inventory and local package metadata. It is not a final notices bundle and does not replace counsel or licence review.',
    '',
    '| Package | Resolved version | Metadata licence | Homepage |',
    '|---|---:|---|---|',
]
for name, version, lic, homepage in rows:
    lines.append(f'| `{name}` | `{version}` | `{lic}` | {homepage or "Not recorded"} |')
lines += [
    '',
    '## Required follow-up',
    '',
    '1. Verify every package licence against the exact lockfile resolution and licence text.',
    '2. Review transitive dependencies, peer variants, patched packages, and integrity metadata.',
    '3. Add required copyright/notice text and package-specific attribution.',
    '4. Have an authorized reviewer and qualified counsel assess compatibility with the intended template licence and delivery model.',
    '5. Replace `UNKNOWN_LICENCE` or unresolved restrictions before changing the product to commercially cleared.',
    '',
    '**Commercial clearance remains:** `Conditional / blocked pending evidence`.',
]
(OUT / 'axiom-grid-third-party-notices-draft.md').write_text('\n'.join(lines) + '\n')
(OUT / 'axiom-grid-third-party-notices-draft.csv').write_text(
    'package,resolved_version,metadata_licence,homepage,status\n' +
    ''.join(f'"{n.replace(chr(34), chr(34)*2)}","{v}","{l}","{h}","Pending licence review"\n' for n, v, l, h in rows)
)
print(f'Generated {len(components)} components')
print(f'Unknown licence metadata: {sum(1 for _, _, l, _ in rows if l == "UNKNOWN_LICENCE")}')
