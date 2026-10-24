# Ember Signal × ember-lite — Read-only Inspection

**Date:** 2026-09-21  
**Status:** Inspection complete; no source edit, branch, merge, deployment, domain, database, or production-data mutation performed.

## Findings

`highfive251677-wq/ember-lite` is a Python 3 local-first governance and evidence engine. It is MIT licensed, uses a lightweight Python dependency set, and exposes evidence/perception bundles, signed chain metadata, provenance, safety, orchestration, and release-gate concepts. The inspected default branch is `master`; the inspected latest commit was `2bb64e184c5618cf5d7fef2f4755975b6041b535`.

The Luma Foundry Ember Signal app is a React/TypeScript/Express project. Its current LOCAL EVIDENCE panel reads a small JSON contract through `server/emberSignalEvidence.ts`; its public `/api/signals` payload is built by `server/emberSignalsApi.ts`. The current fixture remains a local development record and is intentionally not commercial-clearance evidence.

## Compatibility decision

Do **not** import the Python package directly into the Node/TypeScript server and do not copy the whole `ember-lite` application into Ember Signal. The safe pilot boundary is a read-only, file-based adapter that consumes a verified `ember-lite` JSON bundle and emits a sanitized, schema-valid Ember Signal evidence document. The original bundle must remain preserved and the source commit/hash must be retained in the generated reference or manifest.

## Why this boundary is appropriate

The two systems have different runtimes and different contracts. `ember-lite` bundles contain nested perception observations and chain metadata, while Ember Signal expects concise records with `id`, `title`, `source`, `observedAt`, `status`, `summary`, and optional `reference`. A deterministic adapter keeps the integration reversible, testable, low-cost, and independent of Python runtime deployment.

## Risks and controls

The adapter must reject malformed, credential-like, unverified, or ambiguous input before rendering. It must not claim that an `ember-lite` observation proves ownership, licence, or commercial clearance. MIT licence attribution must be retained if source code is reused; importing generated evidence is a separate provenance question and requires source/commit traceability.

## Recommended next action

Give `EMBER-SIGNAL-EMBER-LITE-PILOT-TASK-CARD-2026-09-21.md` to the coding helper. The helper should return a branch/patch only. Operator A runs typecheck, tests, build, secret scan, and file-scope checks. Operator B checks product meaning and provenance boundaries. No merge or deployment occurs in this pilot.
