# Ember Signal — Render Web Service Deployment Handoff

**Date:** 2026-09-22
**Status:** Technical deployment verified; commercial/IP clearance unchanged.

## Deployment identity

| Field | Verified value |
|---|---|
| Render service | `ember-signal-web` |
| Render service ID | `srv-dap9srff3r2c73ehf7g0` |
| Render deploy ID | `dep-dap9srnf3r2c73ehf8a0` |
| Repository | `https://github.com/highfive251677-wq/ember-signal` |
| Branch | `fix/dedicated-health-endpoint` |
| Release commit | `cf83370ea46c4fb795aeebfefb90df2acc5d8649` |
| Service type | Python web service |
| Plan | Free |
| Build command | `pip install -r requirements.txt` |
| Start command | `gunicorn --bind 0.0.0.0:$PORT app:app` |
| Health path | `/api/health` |
| Public URL | `https://ember-signal-web.onrender.com` |

## Verification results

- Render deployment status reached `live`.
- `GET /api/health` returned HTTP 200 with `{"status":"ok"}`.
- `GET /api/signals` returned HTTP 200.
- The signals payload included `top_brands` and `evidence`.
- The evidence payload included the record title **My First Evidence**.
- The health endpoint performed no database or external API call and did not change `/api/signals`.
- `requirements.txt` was unchanged.
- The existing `ember-signal-backend` service was not changed.
- The suspended legacy static-site service was not changed or deleted.

## Review boundaries

This is a technical deployment handoff only. Operator B should update the product/service mapping, Render service ID, deploy ID, commit, public URL, and verification timestamps in the approved Drive register. Operator B must not mark the product commercially cleared based on this deployment; source history, asset licences, contributor rights, dependency notices, and counsel-review evidence remain separate gates.

The GitHub pull request for the dedicated health route remains the source-review path: `https://github.com/highfive251677-wq/ember-signal/pull/1`.
