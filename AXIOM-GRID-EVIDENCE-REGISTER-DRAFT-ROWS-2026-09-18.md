# Axiom Grid — Evidence-Register Draft Rows

**Prepared:** 2026-09-18  
**Product ID:** `prd-axiom-grid`  
**Product:** Axiom Grid  
**Release:** `checkpoint-4bf92357`  
**Immutable commit:** `4bf92357a9a47653af1331e63bc1befcd4f7bcd8`  
**Draft status:** Ready for Operator B review; not a verification or commercial-clearance decision.

## 1. Source Commit Register — draft row

| Product ID | Product name | Live preview URL | Release version/tag | Repository URL | Immutable release commit/hash | Source archive or read-only access link | Original design-history link | Contributor-rights record link | Dependency lockfile/SBOM link | Third-party notices link | Recorded by | Recorded at UTC | Verification status | Reviewer notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `prd-axiom-grid` | Axiom Grid | `https://lumafoundry-jx4veohg.manus.space/axiom-grid` | `checkpoint-4bf92357` | `https://7f0548f6b28a1758d9bf7be630d36cb4.artifacts.cloudflare.net/git/prod/Jx4vEohgXwp36BXoGegYMH.git` | `4bf92357a9a47653af1331e63bc1befcd4f7bcd8` | `PENDING_EVIDENCE — owner-approved release archive or restricted read-only source access not supplied` | `PENDING_EVIDENCE — original Figma/source-file/version-history reference not supplied` | `PENDING_EVIDENCE — contributor assignment/work-for-hire/permission record not supplied` | `PARTIAL — Drive note 1fdVS-5KORx2b_kTdy0QOzLM7G_nMCSF1 records package inventory and package/lockfile hashes; formal SPDX/CycloneDX and licence review remain pending` | `PENDING_EVIDENCE — complete third-party notices bundle not supplied` | Operator A | `2026-09-18T08:00:00Z` | `Pending evidence` | Repository origin and immutable release were recorded from the project checkpoint. Do not mark Verified until archive/source, design history, contributor rights, SBOM/licence review, notices, and reviewer checks match this exact release. Commercial clearance remains Conditional / blocked pending evidence. |

## 2. Asset Licence Register — draft row(s)

The source packet currently identifies one explicit hero asset. This row records what is known without inferring ownership or licence scope. Additional rows must be added if the release contains other images, icons, fonts, textures, illustrations, or external media.

| Product ID | Product name | Asset ID / file path | Asset type | Product use/purpose | Creator / rightsholder | Source URL or creation record | Licence / permission type | Licence proof link | Commercial use allowed | Modification allowed | Attribution required / exact text | Territory / expiry / restrictions | Linked release commit/hash | Reviewed by | Review status | Reviewer notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `prd-axiom-grid` | Axiom Grid | `/manus-storage/axiom-grid-hero_46c3b0f8.png` | image | Hero visual on Axiom Grid page | `PENDING_EVIDENCE — not supplied` | `Local source reference: client/src/pages/AxiomGrid.tsx`; creation record not supplied | `PENDING_EVIDENCE — licence/permission type not supplied` | `PENDING_EVIDENCE — invoice, licence, grant, or permission link not supplied` | `Unknown` | `Unknown` | `PENDING_EVIDENCE` | `Unknown — territory, expiry, resale/redistribution restrictions not supplied` | `4bf92357a9a47653af1331e63bc1befcd4f7bcd8` | Operator A | `Pending evidence` | Asset is linked to the reviewed source state, but origin, rightsholder, commercial scope, modification rights, attribution, and restrictions are unresolved. Do not treat the public asset URL or source reference as licence proof. |

## 3. Product Evidence Matrix — gap-row drafts

These are controlled draft entries for the missing evidence groups. They are not substitute evidence.

| Product ID | Evidence group | Draft value | Status | Exact evidence required | Reviewer note |
|---|---|---|---|---|---|
| `prd-axiom-grid` | Original design history | `PENDING_EVIDENCE` | Pending evidence | Owner-approved Figma/source-file URL, version history, original creation record, or restricted evidence export tied to the release | A source-code component reference is not design history. |
| `prd-axiom-grid` | Asset licence proof | `PENDING_EVIDENCE` | Pending evidence | Creator/rightsholder, source or creation record, licence/permission proof, commercial-use scope, modification terms, attribution, territory, expiry, and restrictions for every external asset | Hero asset row exists; proof is not supplied. Add one row per asset. |
| `prd-axiom-grid` | Contributor rights | `PENDING_EVIDENCE` | Pending evidence | Signed assignment, work-for-hire, or permission record covering each contributor and this release | Do not infer rights from repository access or Operator role. |
| `prd-axiom-grid` | Formal SBOM and notices | `PARTIAL — package inventory and hash note in Drive file 1fdVS-5KORx2b_kTdy0QOzLM7G_nMCSF1` | Partial | SPDX/CycloneDX SBOM, package-by-package licence review, restrictive-licence assessment, and complete third-party notices | Partial inventory is not dependency clearance. |
| `prd-axiom-grid` | Counsel review | `PENDING_EVIDENCE` | Pending evidence | Qualified IP counsel review or written status tied to release commit `4bf92357...` and proposed commercial use | No legal conclusion is made by Operator A. |
| `prd-axiom-grid` | Buyer-facing release fields | `PENDING_EVIDENCE` | Pending evidence | Approved platform, included files, setup steps, requirements, support scope, update policy, and limitations | Keep checkout/fulfilment inactive until approved. |
| `prd-axiom-grid` | Release archive checksum | `PENDING_EVIDENCE` | Pending evidence | Owner-approved release archive and SHA-256/SHA-512 manifest tied to this release | Repository commit hash alone does not prove archive identity. |

## 4. Easy-task mapping

| Easy task | Draft action | State after drafting | Safe boundary |
|---|---|---|---|
| `A-E-002` | Keep repository, tag, commit, and source-access fields aligned | Partial | No production rebuild or source mutation |
| `A-E-003` | Add the design-history placeholder and required-evidence note | Draft ready / evidence pending | Do not publish private Figma/source links |
| `A-E-004` | Maintain one asset row per known asset and request missing licence proof | Partial / evidence pending | Do not replace the hero asset during evidence collection |
| `A-E-005` | Request contributor-rights record | Pending evidence | Do not infer assignment or ownership |
| `A-E-006` | Expand partial dependency note into formal SBOM/notices when source permits | Partial | Do not call it cleared without licence review |
| `A-E-009` | Keep Axiom packet review-ready and cross-reference these drafts | Draft ready | Commercial clearance remains blocked |

## 5. Review instruction for Operator B

Cross-check the verified commit and release label against the existing Source Commit Register row. If they match, accept the factual fields and retain every unresolved field as `Pending evidence`. The correct outcome after this draft is **better traceability**, not commercial clearance.
