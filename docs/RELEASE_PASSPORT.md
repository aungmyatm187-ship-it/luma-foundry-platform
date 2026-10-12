# Release evidence passport

The release evidence passport is a portable JSON snapshot of a product's recorded evidence and its current clearance evaluation. The core builder is `createReleaseEvidencePassport`; MCP clients can request one with `get_release_passport`.

## What it contains

- A stable format identifier and version.
- A compact product identity and lifecycle status.
- Required, present, and missing evidence kinds, plus the same blockers returned by the clearance evaluator.
- Evidence kind, purpose category (`traceability`, `rights`, or `commercial`), producer class (`machine` or `human`), recording role, and timestamp.
- Optional evidence references when the caller explicitly requests an internal export.

Evidence notes are never included. Evidence references are omitted by default because they may point to private repositories, storage, or counsel documents. Treat references as confidential if enabled; sanitize them before any external sharing.

## Trust boundaries

The passport does not change `assertTransitionAllowed` or decide whether evidence is legally sufficient. It uses the existing `evaluateClearance` result. It does not authenticate the `recordedBy` role, check a separate owner approval, fetch or verify referenced artefacts, validate signatures, assess licence terms, or provide legal advice. It is not cryptographically signed and must not be described as an attestation.

A passport marked clearable means only that the recorded evidence kinds satisfy the current structural checklist. The role written on a record is not proof of who submitted it; owner approval and authorization must be verified through the proper authenticated workflow. Human rights evidence and counsel review remain necessary. Technical traceability alone never grants clearance. Review [open issue #16](https://github.com/aungmyatm187-ship-it/luma-foundry-platform/issues/16) and [open issue #17](https://github.com/aungmyatm187-ship-it/luma-foundry-platform/issues/17) before presenting a passport as a trustworthy external release record.

## Example

```ts
import { createReleaseEvidencePassport } from '@luma/core';

const passport = createReleaseEvidencePassport(product, evidence, {
  generatedAt: new Date().toISOString(),
  // includeReferences is false unless deliberately enabled.
});

const json = JSON.stringify(passport, null, 2);
```

Providing `generatedAt` explicitly makes the builder deterministic and allows reproducible test fixtures. The default MCP tool creates the timestamp at export time. Set `includeReferences: true` only for a controlled internal dossier.

## Future extension

A future release pipeline can attach independently verifiable build and SBOM attestations to the technical evidence records. Those attestations can establish where and how an artefact was built, but they still cannot prove ownership, commercial permission, or legal adequacy. Keep those signals separate in both the user interface and the clearance decision.
