#!/usr/bin/env python3
import json
import os
from pathlib import Path
import urllib.request

root = Path('/tmp/ember-signal-static-check')
files = ['app.py', 'requirements.txt', 'index.html']
context = []
for name in files:
    p = root / name
    if p.exists():
        context.append(f'--- {name} ---\n{p.read_text(errors="replace")[:18000]}')
prompt = '''You are the coding reviewer for Luma Foundry. Review the attached repository snapshot for a Flask application incorrectly configured as a Render static site. Produce a concise, factual remediation proposal only. Do not invent files or routes. Identify the correct Render service type, build command, start command, health path, publish-path implication, and the minimum safe change. Do not deploy, merge, push, or change credentials. Mention any uncertainty. Return Markdown with sections: Diagnosis, Exact Render Settings, Optional Repository Change, Verification, Safety Boundary.''' + '\n\n' + '\n\n'.join(context)
payload = {
    'model': 'claude-sonnet-4-6',
    'max_tokens': 1800,
    'temperature': 0,
    'messages': [{'role': 'user', 'content': prompt}],
}
req = urllib.request.Request(
    'https://api.anthropic.com/v1/messages',
    data=json.dumps(payload).encode(),
    headers={
        'content-type': 'application/json',
        'x-api-key': os.environ['ANTHROPIC_API_KEY'],
        'anthropic-version': '2023-06-01',
    },
    method='POST',
)
try:
    with urllib.request.urlopen(req, timeout=90) as response:
        data = json.load(response)
except urllib.error.HTTPError as exc:
    detail = exc.read().decode(errors='replace')
    raise SystemExit(f'Anthropic HTTP {exc.code}: {detail[:1200]}')
text = ''.join(block.get('text', '') for block in data.get('content', []) if block.get('type') == 'text')
Path('/tmp/anthropic-render-config-review.md').write_text(text)
print(text)
