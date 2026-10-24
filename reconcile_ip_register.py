import json
import re
import subprocess
from pathlib import Path

export = Path('/home/ubuntu/terminal_full_output/2026-09-03_06-12-03_295339_1133.txt').read_text()
lines = export.splitlines(keepends=True)
json_line = next(i for i, line in enumerate(lines) if line.strip() == '{')
start = sum(len(line) for line in lines[:json_line])
data = json.loads(export[start:export.rfind('}') + 1])

ranges = {v['range']: v.get('values', []) for v in data['valueRanges']}
source_rows = [r for r in ranges["'Source Commit Register'!A1:O120"][4:] if r and r[0].startswith('prd-')]
asset_rows = [r for r in ranges["'Asset Licence Register'!A1:Q1000"][4:] if r and r[0].startswith('prd-')]
matrix_rows = [r for r in ranges["'Product Evidence Matrix'!A1:P100"][4:] if r and r[0].startswith('prd-')]

app = Path('/home/ubuntu/luma-foundry/client/src/App.tsx').read_text()
ledger = Path('/home/ubuntu/luma-foundry/Route_Certification_Ledger_2026-08-27.md').read_text()
local_sha = subprocess.check_output(['git', '-C', '/home/ubuntu/luma-foundry', 'rev-parse', 'HEAD'], text=True).strip()

sheet_slugs = {r[2].rstrip('/').rsplit('/', 1)[-1] for r in source_rows}
app_slugs = set(re.findall(r'/(?:[a-z0-9]+-?)+', app))
app_matches = {slug for slug in sheet_slugs if f'/{slug}' in app}
ledger_matches = {slug for slug in sheet_slugs if f'/{slug}' in ledger}

print(f"LOCAL_REPOSITORY_HEAD\t{local_sha}")
print(f"SOURCE_ROWS\t{len(source_rows)}")
print(f"SOURCE_UNIQUE_PRODUCT_IDS\t{len({r[0] for r in source_rows})}")
print(f"ASSET_ROWS\t{len(asset_rows)}")
print(f"ASSET_UNIQUE_PRODUCT_IDS\t{len({r[0] for r in asset_rows})}")
print(f"EVIDENCE_MATRIX_ROWS\t{len(matrix_rows)}")
print(f"SHEET_ROUTE_SLUGS_FOUND_IN_APP\t{len(app_matches)}/{len(sheet_slugs)}")
print(f"SHEET_ROUTE_SLUGS_FOUND_IN_LEDGER\t{len(ledger_matches)}/{len(sheet_slugs)}")
print(f"SOURCE_COMMIT_VALUES_PRESENT\t{sum(bool(len(r) > 5 and str(r[5]).strip()) for r in source_rows)}/{len(source_rows)}")
print(f"SOURCE_REPOSITORY_VALUES_PRESENT\t{sum(bool(len(r) > 4 and str(r[4]).strip()) for r in source_rows)}/{len(source_rows)}")
print(f"SOURCE_DESIGN_HISTORY_VALUES_PRESENT\t{sum(bool(len(r) > 7 and str(r[7]).strip()) for r in source_rows)}/{len(source_rows)}")
print(f"SOURCE_CONTRIBUTOR_RIGHTS_VALUES_PRESENT\t{sum(bool(len(r) > 8 and str(r[8]).strip()) for r in source_rows)}/{len(source_rows)}")
print(f"SOURCE_DEPENDENCY_VALUES_PRESENT\t{sum(bool(len(r) > 9 and str(r[9]).strip()) for r in source_rows)}/{len(source_rows)}")
print(f"SOURCE_NOTICES_VALUES_PRESENT\t{sum(bool(len(r) > 10 and str(r[10]).strip()) for r in source_rows)}/{len(source_rows)}")
print(f"ASSET_ID_OR_PATH_PRESENT\t{sum(bool(len(r) > 2 and str(r[2]).strip()) for r in asset_rows)}/{len(asset_rows)}")
print(f"ASSET_SOURCE_OR_LICENSE_PRESENT\t{sum(bool((len(r) > 6 and str(r[6]).strip()) or (len(r) > 7 and str(r[7]).strip())) for r in asset_rows)}/{len(asset_rows)}")
print(f"MATRIX_CONDITIONAL_BLOCKED\t{sum(len(r) > 13 and r[13] == 'Conditional / blocked pending evidence' for r in matrix_rows)}/{len(matrix_rows)}")
print(f"MISSING_IN_APP\t{','.join(sorted(sheet_slugs - app_matches)) or 'none'}")
print(f"MISSING_IN_LEDGER\t{','.join(sorted(sheet_slugs - ledger_matches)) or 'none'}")
