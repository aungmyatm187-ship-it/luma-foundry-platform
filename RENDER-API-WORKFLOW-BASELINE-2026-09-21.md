# Render API Workflow Baseline

**Date:** 2026-09-21

## Official references

- Render API overview: https://render.com/docs/api
- Render API authentication: https://api-docs.render.com/reference/authentication
- Render OpenAPI specification: https://api-docs.render.com/openapi/render-public-api-1.json
- Render webhooks: https://render.com/docs/webhooks
- Render deploy hooks: https://render.com/docs/deploy-hooks

## Authentication

Render uses an API key in `Authorization: Bearer $RENDER_API_KEY`. The official health check is `GET https://api.render.com/v1/services?limit=3` with `Accept: application/json`. The key is stored only in the enabled Render API connector; it is not written into this report.

## Current read-only inventory

The API health check returned HTTP 200. The connected workspace exposes two services:

| Service | ID | Type | Repository | Branch |
|---|---|---|---|---|
| ember-signal-backend | srv-damqre67bikc73c45d6g | web_service | https://github.com/highfive251677-wq/ember-signal-backend | main |
| ember-signal | srv-damqbvm7bikc73c2gajg | static_site | https://github.com/highfive251677-wq/ember-signal | main |

The latest read-only deploy inspection showed the backend deploy as `live` at commit `4a95272915caa7b1fc202782a4229202f0e27881`. The static-site service showed three recent `build_failed` deploys at commit `d7f938322a4a847a3886020f519005a965a50ca2`; this is a diagnostic finding only and no redeploy was triggered.

## Useful workflow lanes

1. Service inventory and ownership scope.
2. Deploy status and commit-to-live verification.
3. Build-failure detection and evidence handoff.
4. Public health endpoint verification after a deploy.
5. Read-only service events, logs, metrics, custom-domain, and workflow inspection where supported.
6. Release evidence capture tying Render service ID, repository, branch, deploy ID, status, and commit together.
7. Operator A technical review and Operator B product/IP review before any mutation.

## Safety boundaries

Render API mutations—deploys, environment variables, service settings, webhook configuration, restarts, rollbacks, custom-domain changes, and workflow changes—remain approval-gated. Render webhooks require Pro or higher and an HTTPS receiver; webhook signatures and replay/idempotency handling are required. Deploy hook URLs are secrets and must never be put in chat or source code.

No Render mutation was performed in this baseline check.

## Public health checks

- `https://ember-signal-backend.onrender.com/api/health` returned HTTP 200 with database `ok`, 357 records, 113 sources, 41 evidence items, 6 verified evidence items, and 6 quarantined evidence items.
- `https://ember-signal.onrender.com/` returned HTTP 404. This aligns with the three recent `build_failed` Render deploys and should be treated as a release blocker for the Render static-site service. No redeploy or configuration mutation was triggered.

## First workflow recommendation

Use Render API read-only checks as the pre-mutation gate: inventory services, inspect latest deploy status/commit, call each configured public health endpoint, and write a release evidence snapshot. If a static-site build is failed or its public URL is not 2xx, stop before any deploy hook or settings mutation and hand the blocker to Operator A/B review.
