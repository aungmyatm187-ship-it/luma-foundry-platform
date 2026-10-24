# Axiom Grid — Contributor Rights and Counsel-Review Evidence Plan

**Prepared:** 2026-09-18  
**Product ID:** `prd-axiom-grid`  
**Release:** `checkpoint-4bf92357`  
**Immutable commit:** `4bf92357a9a47653af1331e63bc1befcd4f7bcd8`  
**Current decision:** `Conditional / blocked pending evidence`

> This is an operational evidence-collection plan, not legal advice and not a substitute for a qualified lawyer in the relevant jurisdiction.

## 1. Evidence boundary

The target is not a general statement that “the project is ours.” The evidence must show that the people who contributed to the **exact Axiom Grid release commit** either assigned the relevant rights, performed the work under a valid work-for-hire arrangement where legally applicable, or granted a sufficiently broad written licence for the intended commercial use.

The counsel record must then show that a qualified reviewer considered this exact release, the asset/dependency evidence, the proposed licence and delivery model, and the jurisdictions or customer markets that matter. A lawyer’s generic website terms, an unsigned chat message, or a public repository URL is not a counsel-review record.

## 2. Contributor-rights collection workflow

### Step 1 — Build the contributor inventory

Create a private working list with one row per person or organization that contributed original code, design, copy, illustration, animation, configuration, or other copyrightable material to Axiom Grid. Use the repository history, design records, asset register, and project communications to identify contributors. Do not publish personal contact details in the shared IP register.

Suggested private columns:

| Field | Required value |
|---|---|
| Contributor ID | Internal non-sensitive ID, e.g. `contrib-001` |
| Name / legal entity | Exact contracting party name, stored in restricted access |
| Contribution scope | Code, design, copy, asset, font, illustration, etc. |
| Relevant paths/assets | Exact files or asset IDs |
| Release linkage | `checkpoint-4bf92357` and commit hash |
| Relationship | Employee, contractor, agency, founder, volunteer, third party |
| Agreement type | Assignment, work-for-hire, licence, employment IP clause, permission |
| Evidence link | Restricted Drive/contract repository link, not credentials |
| Coverage status | Pending evidence / Ready for review / Verified / Rejected |
| Reviewer notes | Gaps, territory, duration, exclusions, signature issue |

### Step 2 — Match each contribution to the release

For every contributor, map the contribution to the exact release. A general contractor agreement is insufficient if it excludes the asset, predates the work, limits territory, excludes resale/template use, or does not cover derivative works. Record the relevant file paths, asset IDs, design version, or commit range in a private appendix.

### Step 3 — Request the appropriate record

Use the request template below. Ask for a signed copy or an owner-approved restricted reference. Do not ask contributors to paste identity documents, payment details, or credentials into the shared register.

### Step 4 — Review coverage before marking Ready for review

A record may move from `Pending evidence` to `Ready for review` only when the document is accessible to the authorized reviewer and its scope, parties, signature/acceptance, date, territory, duration, derivative-work rights, commercial/resale rights, and release linkage can be checked. Operator A must not mark it `Verified` alone.

## 3. Contributor-rights request template

**Subject:** Axiom Grid — rights confirmation for release `checkpoint-4bf92357`

Hello [Contributor / organization],

We are preparing the Axiom Grid release identified below for a controlled commercial template review:

- Product: Axiom Grid
- Release label: `checkpoint-4bf92357`
- Commit: `4bf92357a9a47653af1331e63bc1befcd4f7bcd8`
- Contribution or asset: [describe exact scope]
- Relevant file/path or asset ID: [list exact paths]

Please provide the signed agreement, assignment, work-for-hire record where legally applicable, or written commercial permission that covers this contribution. The record should make clear:

1. the parties and the person/entity granting rights;
2. the work or assets covered;
3. the date and signature/acceptance;
4. rights to reproduce, modify, adapt, publish, distribute, sublicense or resell as part of a website template, if those uses are intended;
5. territory and duration;
6. attribution requirements;
7. exclusions, third-party materials, or restrictions; and
8. the link between the contribution and the Axiom Grid release above.

Please send the record through the approved private channel or provide a restricted read-only reference. Do not send passwords, API tokens, identity documents, or other unnecessary personal data. If the existing agreement does not cover commercial template resale, please identify that limitation rather than assuming coverage.

Thank you.

## 4. What qualifies as acceptable contributor evidence

| Evidence | Initial treatment |
|---|---|
| Signed copyright assignment covering the contribution and intended commercial use | Ready for review; Verify only after release match and reviewer check |
| Signed work-for-hire agreement | Ready for review; confirm legal applicability and scope with counsel |
| Employment agreement with clear IP clause plus work records | Ready for review; confirm the work falls inside employment scope |
| Written licence from an external contributor | Ready for review if commercial, derivative, distribution, and template/resale rights are explicit |
| Unsigned chat/email statement | Pending evidence; not sufficient by itself |
| Repository access or commit authorship | Technical attribution only; not a rights transfer |
| Public-domain/open-source claim without source/licence proof | Pending evidence |
| Agreement that excludes resale, redistribution, or derivative templates | Rejected / replace for this commercial model, or remove/replace the contribution |

## 5. Counsel-review workflow

### Step 1 — Prepare a counsel packet

Give counsel a controlled, read-only packet containing:

1. Product ID, live preview URL, release label, and exact commit hash.
2. Repository/source access reference and release archive checksum when available.
3. Design-history reference and a short provenance chronology.
4. Complete asset register with licence/permission proofs and restrictions.
5. Contributor inventory and restricted rights records.
6. Dependency inventory/SBOM, package licences, and third-party notices.
7. Proposed commercial licence, included files, customer use, resale/redistribution boundaries, and delivery method.
8. Known brand/trademark or third-party reference risks.
9. Open questions and known limitations.
10. Requested jurisdictions and target customer markets.

### Step 2 — Ask focused questions

Counsel should be asked to assess, at minimum:

- whether the contributor records cover the intended commercial template use;
- whether the Axiom Grid asset/licence records cover commercial use, modification, distribution, and any attribution;
- whether dependencies and notices create obligations for the delivery model;
- whether the product copy, name, visual identity, or included assets present trademark, passing-off, or other clearance issues requiring separate review;
- whether the proposed customer licence and delivery process are consistent with the rights obtained; and
- what unresolved items must be fixed before commercial activation.

### Step 3 — Obtain a release-specific record

Request a dated memo, letter, email from the qualified reviewer, or law-firm work product that identifies the product, release/version, scope reviewed, jurisdictions/assumptions, limitations, open actions, and reviewer identity/qualification. Store it in restricted Drive access. The shared register should contain only a safe reference link and status, not privileged legal advice.

## 6. Counsel evidence acceptance checklist

Mark counsel status `Ready for review` only if the record contains all of the following:

- Reviewer identity and qualified role/firm.
- Date of review.
- Product: Axiom Grid and product ID.
- Exact release label and commit/hash, or a clearly defined release archive checksum.
- Materials reviewed.
- Commercial use model reviewed, including template resale/distribution if applicable.
- Jurisdiction or assumptions.
- Opinion scope and explicit limitations.
- Open remediation items, if any.
- Clear conclusion such as approved for proposed scope, approved subject to conditions, or not ready.

`Verified` must be reserved for the authorized reviewer’s confirmation that the record is authentic, release-specific, complete enough for the agreed gate, and consistent with the evidence matrix. If counsel gives a conditional answer, keep commercial clearance conditional and record every condition.

## 7. Counsel request template

**Subject:** Request for release-specific IP review — Axiom Grid `checkpoint-4bf92357`

Hello [Counsel / firm],

We request an IP/provenance review for the following exact release:

- Product: Axiom Grid
- Product ID: `prd-axiom-grid`
- Release: `checkpoint-4bf92357`
- Commit: `4bf92357a9a47653af1331e63bc1befcd4f7bcd8`
- Preview: `https://lumafoundry-jx4veohg.manus.space/axiom-grid`
- Intended use: [describe template sale, licence, customization, distribution, and customer markets]

Please review the attached/restricted packet and state:

1. materials and release version reviewed;
2. contributor-rights coverage;
3. asset and licence coverage;
4. dependency and notice obligations;
5. product name/copy/brand risk questions within scope;
6. customer licence and delivery assumptions;
7. jurisdictions and limitations; and
8. whether the release is approved, approved subject to listed conditions, or not ready for the proposed commercial use.

Please identify any missing evidence and whether your communication is intended as privileged/confidential legal advice. We will store the full record in restricted access and place only a safe evidence pointer and status in the shared register.

## 8. Register update sequence

Do not overwrite the current rows. After evidence arrives:

1. Add restricted evidence links and dates to the draft fields.
2. Keep `Pending evidence` until an authorized reviewer checks the documents.
3. Change to `Ready for review` only when the packet is complete enough for review.
4. Have Operator B or the designated reviewer verify the exact release match.
5. Record conditional counsel findings as conditions, not as unconditional clearance.
6. Change commercial clearance only after all six evidence groups are verified and counsel review is complete.
7. Append a Sync Log entry describing the milestone and the unchanged boundary.

## 9. Current next actions

| Owner | Action | Status |
|---|---|---|
| Owner / project administrator | Identify every Axiom Grid contributor and relationship | Required input |
| Owner / project administrator | Supply restricted signed rights records or request them using the template | Required input |
| Operator A | Maintain private contribution-to-release mapping | Easy, safe to prepare |
| Operator A | Assemble counsel packet from exact commit and current registers | Easy, safe to prepare |
| Owner | Select qualified IP counsel and confirm jurisdiction/target commercial model | Required decision/input |
| Counsel | Review release-specific packet and issue dated scoped record | External professional action |
| Operator B | Validate evidence links and status transitions in the shared register | Pending evidence arrival |

## 10. Release gate

Until contributor rights and counsel review are complete and matched to commit `4bf92357a9a47653af1331e63bc1befcd4f7bcd8`, Axiom Grid remains **Conditional / blocked pending evidence**. Do not activate payment, delivery, checkout, resale claims, or permanent commercial publication based on these drafts alone.
