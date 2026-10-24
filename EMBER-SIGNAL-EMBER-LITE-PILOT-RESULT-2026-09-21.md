# Ember Signal × ember-lite — Pilot Result and Source Review Response

**Date:** 2026-09-21  
**Status:** `READY FOR JOINT REVIEW` — isolated patch and review artifacts complete; not merged or deployed.

## Helper routing

The Anthropic coding-helper run was attempted but could not start because the helper session reported `creditNotEnough`. Under the approved fallback rule, Operator A implemented the same bounded task directly in an isolated worktree. No production project files were changed.

## Exact source-level artifacts

The isolated patch is `/tmp/EMBER-SIGNAL-EMBER-LITE-PILOT.patch`. It contains the adapter, focused tests, sanitized input fixture, generated output example, adapter documentation, and reproducible output-generator script. The patch has 261 lines and 13,717 bytes.

The adapter is independently written TypeScript. It does not copy or import Python source from `highfive251677-wq/ember-lite`; it reads a sanitized JSON bundle and emits Ember Signal records. Therefore it does not claim the MIT licence over generated observation data. If future work copies or adapts upstream source code, the upstream copyright and MIT notice must be added before merge.

## Adapter contract

Input requires a JSON object with `chain.signed === true`, `chain.verified === true`, and `perception.observations`. The source commit must be a 40-character hexadecimal hash. Output is `{ updatedAt, records, sourceCommit }`; each record contains `id`, `title`, `source`, `observedAt`, `status`, `summary`, and `reference`. Each reference retains the exact source commit and observation key.

The provenance wording is: `Imported observation from ember-lite bundle, traced to the exact source commit.` A commit/hash proves technical traceability only; it does not prove ownership, licence validity, or commercial permission.

## Rejection paths

Malformed bundles, missing chain verification, `signed !== true`, `verified !== true`, invalid commit strings, and credential-like text are rejected before records can be rendered. The focused test suite covers valid mapping, malformed input, invalid commit, unsigned/unverified bundles, and credential-like text.

## Validation

| Check | Result |
|---|---|
| Adapter tests | 4 passed |
| Existing Ember evidence tests | 3 passed |
| Existing signals API tests | 2 passed |
| Total selected tests | 9 passed |
| TypeScript check | Passed |
| Production build | Passed |
| Sanitized fixture/output generation | Passed |
| Production project mutation | None |
| Merge/deploy | Not performed |

The only secret-scan match is an intentional redacted bearer string in a test fixture that proves rejection; it is not a credential.

## Review decision requested

Operator A technical checks are complete. Operator B can review the exact patch, fixture, generated output, provenance wording, and licence boundary. If both approve, the next action is to apply the patch to a dedicated source branch, rerun the full suite, save a checkpoint, and only then consider a non-production preview. Commercial clearance remains separate and is not granted by this pilot.
