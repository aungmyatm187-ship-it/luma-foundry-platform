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
        context.append(f'--- {name} ---\n{p.read_text(errors="replace")[:5000]}')
prompt = '''You are the coding reviewer for Luma Foundry. Review the attached repository snapshot for a Flask application incorrectly configured as a Render static site. Produce a concise, factual remediation proposal only. Do not invent files or routes. Identify the correct Render service type, build command, start command, health path, publish-path implication, and the minimum safe change. Do not deploy, merge, push, or change credentials. Mention any uncertainty. Return Markdown with sections: Diagnosis, Exact Render Settings, Optional Repository Change, Verification, Safety Boundary.''' + '\n\n' + '\n\n'.join(context)
payload = {
    'model': 'openrouter/pareto-code',
    'temperature': 0,
    'max_tokens': 700,
    'messages': [{'role': 'user', 'content': prompt}],
}
req = urllib.request.Request(
    'https://openrouter.ai/api/v1/chat/completions',
    data=json.dumps(payload).encode(),
    headers={
        'content-type': 'application/json',
        'Authorization': f'Bearer {os.environ["OPENROUTER_API_KEY"]}',
        'HTTP-Referer': 'https://lumafoundry.live',
        'X-Title': 'Luma Foundry Render configuration review',
    },
    method='POST',
)
try:
    with urllib.request.urlopen(req, timeout=120) as response:
        data = json.load(response)
except urllib.error.HTTPError as exc:
    detail = exc.read().decode(errors='replace')
    raise SystemExit(f'OpenRouter HTTP {exc.code}: {detail[:1000]}')
text = data['choices'][0]['message']['content']
Path('/tmp/openrouter-render-config-review.md').write_text(text)
print(text)
