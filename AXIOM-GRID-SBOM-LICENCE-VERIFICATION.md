# Axiom Grid — SBOM and Dependency Licence Evidence

**Prepared:** 2026-09-17
**Operator:** Operator A
**Product ID:** `prd-axiom-grid`
**Release scope:** `checkpoint-4bf92357`
**Immutable commit:** `4bf92357a9a47653af1331e63bc1befcd4f7bcd8`
**Evidence status:** Partial / pending licence and notice review
**Commercial clearance:** Not granted

## Reproducible source inputs

The dependency inventory was collected from the project state associated with the Axiom Grid release packet. The recorded source hashes are:

| Input | SHA-256 |
|---|---|
| `pnpm-lock.yaml` | `302c67a03d1c3f4d17e8f5108dd4ee09790f75a83ee8b15f03ec3f723afce857` |
| `package.json` | `1b5af45baa023864e9ba4ad2f4c6bde8c31bc5595e021621c69b289fd0a0dfaa` |

The production dependency inventory was generated with `pnpm list --prod --depth 0 --json`. It contained **64 direct production dependency entries** and **64 resolved package entries** in the captured output. The complete lockfile remains the authoritative version-resolution source.

## Declared runtime dependencies

The release manifest declares runtime dependencies including React/React DOM, Express, tRPC, Drizzle ORM, MySQL2, AWS S3 client packages, Zod, Vite-adjacent UI packages, Tailwind utilities, Framer Motion, Recharts, Wouter, and related runtime libraries. Exact resolved versions are recorded by the lockfile and the collected `pnpm list` output; this summary does not replace a formal SPDX or CycloneDX document.

## Licence and notice boundaries

This packet verifies the input manifests and dependency inventory only. It does **not** verify the licence for every transitive package, the completeness of third-party notices, or the absence of restrictive licence obligations. No SPDX/CycloneDX file, package-by-package licence review, or release-specific notices bundle was available in the accessible evidence at the time of preparation.

Accordingly, the shared evidence matrix records the dependency licence inventory as **Pending release-specific SBOM, dependency licence inventory, and notices**. The Axiom Grid product remains **Conditional / blocked pending evidence** and is not commercially cleared.

## Next action

Generate an owner-approved SPDX or CycloneDX artifact from this exact release commit, review package licences and notices, attach the artifact to the restricted evidence register, and record the reviewer/date. Do not modify production dependencies as part of evidence collection.
