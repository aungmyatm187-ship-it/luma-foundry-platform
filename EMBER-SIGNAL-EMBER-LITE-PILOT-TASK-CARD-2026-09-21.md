# Ember Signal × ember-lite — Pilot Task Card

## Identity

- **Task ID:** `TASK-20260921-EMBER-LITE-001`
- **Product:** Ember Signal
- **Source repository:** `highfive251677-wq/ember-lite`
- **Target project:** `/home/ubuntu/luma-foundry`
- **Priority:** normal
- **Owner:** Operator A
- **Product/IP reviewer:** Operator B
- **Status:** QUEUED — implementation not started

## One bounded objective

Design and implement a **read-only, sanitized evidence-bundle adapter** that can consume a verified `ember-lite` perception/evidence JSON bundle and expose a small, schema-valid subset through Ember Signal's existing local evidence model. Do not embed the Python runtime into the React/TypeScript app.

## Source of truth

- `ember-lite` default branch: `master`
- Inspected release commit: `2bb64e184c5618cf5d7fef2f4755975b6041b535`
- Source licence observed in repository: MIT; retain the copyright notice if source is reused.
- Ember Signal local evidence contract: `data/ember-signal-evidence.json`, `server/emberSignalEvidence.ts`, `server/emberSignalsApi.ts`.
- Existing UI panel: `client/src/pages/EmberSignal.tsx`.

## Required integration shape

Prefer a file-based adapter or explicit import script that transforms only verified, non-secret fields into Ember Signal records with `id`, `title`, `source`, `observedAt`, `status`, `summary`, and `reference`. Preserve the original bundle separately; do not silently overwrite it. Mark imported records as evidence from `ember-lite` and retain source commit/hash in the reference or manifest. Reject credential-like text and malformed input before rendering.

## Allowed changes

Only propose changes under the Ember Signal project to:

- an adapter/import utility;
- a small schema/helper test;
- a sample sanitized fixture under a clearly non-production test/fixture path;
- documentation for running the import locally.

The helper must not change the public deployment, domain, database schema, authentication, payments, webhooks, LLM prompt, or production evidence file without a separate review decision.

## Prohibited actions

Do not clone or copy the whole Python application into Ember Signal. Do not import Python modules into the Node process. Do not run `ember-lite` against production databases. Do not invent evidence claims, confidence, licence status, or commercial clearance. Do not include API keys, tokens, bearer strings, private keys, SQLite databases, or personal data. Do not commit or deploy. Do not edit `main`/`master` directly.

## Acceptance tests

1. Valid `ember-lite` bundle produces deterministic Ember Signal records.
2. Missing, malformed, unsigned/unverified, or credential-like input is rejected or quarantined.
3. Source commit/hash is retained in the generated reference/manifest.
4. Existing Ember Signal evidence tests continue to pass.
5. TypeScript typecheck and production build pass.
6. Secret scan and diff/file-scope scan pass.
7. Existing `/api/signals` and LOCAL EVIDENCE behavior remain unchanged for the current fixture.
8. No production data, domain, or deployment is mutated.

## Budget

- Maximum helper LLM calls: 1 implementation call, 1 bounded repair call only if a deterministic test failure identifies a clear fix.
- No connector write during implementation.
- Timeout: 15 minutes.
- If requirements become ambiguous, return `NEEDS_CLARIFICATION` instead of expanding scope.

## Required output

Return only: status; changed files; adapter contract; test commands/results; secret and scope-scan result; unresolved questions; Operator A technical review notes; Operator B provenance/product review notes; next action.

## Failure handling

On schema, security, or test failure, write the patch/output to review quarantine and do not touch the live evidence file. Commercial status remains `CONDITIONAL — NOT COMMERCIALLY CLEARED` until release-matched provenance and licence evidence are separately verified.
