# Ember Signal — Protected Workspace Source Alignment

**Date:** 2026-09-22  
**Checkpoint:** `c68ad517`  
**Status:** Technical alignment verified; commercial/IP status unchanged.

## Change

The protected Ember Signal evidence query now calls the same validated, Render-first canonical source adapter as the public Luma `/api/signals` endpoint. The existing tRPC procedure name remains unchanged for compatibility, but it now returns normalized source metadata, evidence records, and the bounded local-file fallback state.

The protected brief-builder panel uses source-aware copy:

- **RENDER EVIDENCE** when the canonical Render service is reachable;
- **LOCAL EVIDENCE** only when the bounded fallback is in use;
- an explicit sign-in boundary for protected evidence access;
- no commercial-clearance claim.

## Validation

| Check | Result |
|---|---|
| Protected query authorization test | Pass |
| Canonical source adapter tests | Pass |
| Public payload tests | Pass |
| TypeScript | Pass |
| Production build | Pass |
| Public API spot check | Render source with `My First Evidence` and release identity |

## Unchanged boundaries

No database schema/data, Make scenario, Drive register mapping, payment, DNS, external credentials, product ID, commercial clearance, asset licence, contributor-rights, or counsel-review state changed.

## Operator B follow-up

The UI/API source alignment does not create an approved catalogue Product ID. Operator B should retain the existing mapping gap until an approved Ember Signal Product ID and Product Evidence Matrix row are explicitly established. The Make scenario remains manual-only and no Google Sheets write path exists until a Sheets connection and approved destination field mapping are provided.
