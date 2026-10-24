# Axiom Grid — SBOM and Third-Party Notices Milestone

**Prepared:** 2026-09-19  
**Product ID:** `prd-axiom-grid`  
**Release:** `checkpoint-4bf92357`  
**Immutable commit:** `4bf92357a9a47653af1331e63bc1befcd4f7bcd8`  
**Decision:** `Conditional / blocked pending evidence`

## What was completed

A lightweight, read-only generator created a **manifest-derived CycloneDX 1.5 draft** and a third-party notices inventory from the captured production dependency output and local package metadata. No project dependencies or production source were changed.

| Artifact | Result |
|---|---:|
| Direct production components captured | 64 |
| CycloneDX draft components | 64 |
| Third-party notice draft rows | 64 |
| Source manifest hashes recorded | 2 |
| Project dependency changes | 0 |

## Source identity

| Input | SHA-256 |
|---|---|
| `package.json` | `1b5af45baa023864e9ba4ad2f4c6bde8c31bc5595e021621c69b289fd0a0dfaa` |
| `pnpm-lock.yaml` | `302c67a03d1c3f4d17e8f5108dd4ee09790f75a83ee8b15f03ec3f723afce857` |

## Draft artifacts

- `axiom-grid-cyclonedx-draft.json` — CycloneDX 1.5, 64 components, release metadata and source hashes.
- `axiom-grid-third-party-notices-draft.md` — human-readable package/version/metadata-licence table and follow-up requirements.
- `axiom-grid-third-party-notices-draft.csv` — import-friendly working table.

## Important limitation

The generator found licence metadata in the local package manifests, but that is **metadata evidence only**. It does not prove that every licence text is authentic, complete, compatible with the intended customer/template licence, or sufficient for attribution. It also does not replace review of transitive packages, peer variants, patched packages, package integrity, or required notice text.

The CycloneDX file is intentionally labelled `DRAFT - licence and notice verification pending`. The notices file is a working inventory, not a final customer-facing notices bundle.

## Required review before clearance

1. Reconcile each resolved package with the exact lockfile, including transitive dependencies and peer variants.
2. Verify licence identifiers and texts from authoritative package sources.
3. Review restrictive, reciprocal, dual, and attribution obligations against the intended template/customer licence.
4. Produce the final notice/attribution bundle and identify where it must ship.
5. Have an authorized technical/IP reviewer record the review date and exceptions.
6. Ask qualified counsel to assess unresolved compatibility and commercial-delivery questions.

No payment, checkout, fulfilment, or commercial-clearance status change is authorized by this milestone.
