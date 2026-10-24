import json
from pathlib import Path

path = Path('/home/ubuntu/terminal_full_output/2026-09-03_06-12-03_295339_1133.txt')
text = path.read_text()
lines = text.splitlines(keepends=True)
json_line = next(i for i, line in enumerate(lines) if line.strip() == '{')
start = sum(len(line) for line in lines[:json_line])
end = text.rfind('}') + 1
data = json.loads(text[start:end])

for block in data['valueRanges']:
    print(f"RANGE\t{block['range']}")
    rows = block.get('values', [])
    for idx, row in enumerate(rows[:6], start=1):
        print(f"ROW{idx}\t" + ' | '.join(str(x) for x in row[:8]))
    print(f"TOTAL_NONEMPTY_ROWS\t{sum(bool(row) for row in rows)}")
    if 'Source Commit Register' in block['range']:
        header = rows[3]
        data_rows = [r for r in rows[4:] if r and r[0].startswith('prd-')]
        required = [3,4,5,6,7,8,9,10,11,12]
        blank_counts = {header[i]: sum(len(r) <= i or not str(r[i]).strip() for r in data_rows) for i in required}
        ids = [r[0] for r in data_rows]
        print(f"DATA_ROWS\t{len(data_rows)}")
        print(f"UNIQUE_PRODUCT_IDS\t{len(set(ids))}")
        print('BLANK_COUNTS\t' + ' | '.join(f'{k}={v}' for k,v in blank_counts.items()))
    if 'Asset Licence Register' in block['range']:
        data_rows = [r for r in rows[4:] if r and r[0].startswith('prd-')]
        ids = [r[0] for r in data_rows]
        print(f"DATA_ROWS\t{len(data_rows)}")
        print(f"UNIQUE_PRODUCT_IDS\t{len(set(ids))}")
        print(f"ASSET_ROWS_WITH_SOURCE_OR_LICENSE\t{sum(bool(len(r) > 3 and (str(r[2]).strip() or str(r[3]).strip())) for r in data_rows)}")
        print(f"ASSET_ROWS_WITH_MISSING_SOURCE_OR_LICENSE\t{sum(len(r) <= 3 or (not str(r[2]).strip() and not str(r[3]).strip()) for r in data_rows)}")
    if 'Product Evidence Matrix' in block['range']:
        data_rows = [r for r in rows[4:] if r and r[0].startswith('prd-')]
        print(f"DATA_ROWS\t{len(data_rows)}")
        print(f"UNIQUE_PRODUCT_IDS\t{len(set(r[0] for r in data_rows))}")
        if data_rows:
            print(f"MATRIX_STATUS_COUNTS\t" + ' | '.join(f'{status}={sum(len(r) > 13 and r[13] == status for r in data_rows)}' for status in sorted(set(r[13] if len(r)>13 else '' for r in data_rows))))
