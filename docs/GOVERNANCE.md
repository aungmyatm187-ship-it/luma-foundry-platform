# Governance

## The rule

> A product may be marked `cleared` only when every required evidence kind is recorded.

Enforced by `assertTransitionAllowed` in `packages/core/src/governance.ts`. It is called on
every status write, from every surface. There is no bypass and no override flag.

## Why evidence, and not "it works"

A product can be live, pass its build, and have a clean source commit while still being
unsellable — because someone else may own the design, the photography, or the typeface, or
because a dependency's licence forbids commercial use.

Technical traceability answers *"does this artefact exist and where did it come from?"*
It does not answer *"may we sell it?"* Those are different questions, and conflating them is
how a product ships into a legal problem.

So the engine separates them explicitly:

| Evidence | Category |
|---|---|
| `source_commit` | traceability only |
| `dependency_sbom` | traceability only |
| `design_history` | rights |
| `asset_licence` | rights |
| `contributor_rights` | rights |
| `third_party_notices` | rights |
| `counsel_review` | rights |
| `buyer_terms` | commercial |

If only traceability evidence is present, `evaluateClearance` says so directly:

> Only traceability evidence supplied (source commit / SBOM). Traceability never proves
> ownership, licence, or commercial permission.

## Two axes: legal nature vs. producer

The table above classifies evidence by its **legal nature** (traceability / rights /
commercial). There is a second, orthogonal axis — **who produces it** — encoded in
`packages/core/src/evidence.ts`:

| Evidence | Producer |
|---|---|
| `source_commit` | machine |
| `dependency_sbom` | machine |
| `third_party_notices` | machine |
| `buyer_terms` | machine |
| `design_history` | human (owner) |
| `asset_licence` | human (owner / licensor) |
| `contributor_rights` | human (owner / contributor) |
| `counsel_review` | human (qualified IP counsel) |

The four **machine** kinds are what `scripts/generate-evidence.mjs` emits
(`npm run evidence`). They are necessary but never sufficient: a machine can prove an
artefact exists and that its code dependencies are resale-safe, but it cannot prove
ownership, licence, or permission to sell — those are exactly the four **human** kinds.

The invariant is asserted in tests (`assertEvidencePartition`): the machine and human sets
must exactly partition `REQUIRED_EVIDENCE`. A new evidence kind cannot be added without
deciding who produces it.

## Required evidence

All eight must be present before clearance:

```
source_commit · design_history · asset_licence · contributor_rights ·
dependency_sbom · third_party_notices · counsel_review · buyer_terms
```

## Reading a clearance report

```ts
const report = evaluateClearance(product, ws.evidenceFor(product.id));
```

| Field | Meaning |
|---|---|
| `clearable` | `true` only when nothing is missing |
| `present` | evidence kinds recorded |
| `missing` | required kinds not yet recorded |
| `traceabilityOnly` | traceability kinds that were supplied |
| `blockers` | human-readable reasons clearance is refused |

`check_clearance` on the MCP server and `checkClearance` on the API return this same shape,
so an agent can ask "what is missing?" and act on the answer.

## Statuses

| Status | Meaning |
|---|---|
| `concept` | proposed, nothing built |
| `in_build` | Operator A is building |
| `in_review` | Operator B is reviewing |
| `conditional` | released only under stated conditions |
| `cleared` | **gated** — every evidence kind present |
| `blocked` | cannot proceed |

Only `cleared` is gated. `conditional` is deliberately not — it is the honest state for a
product that is useful but not fully evidenced, and forcing it through the gate would just
push people to mislabel products as `cleared`.

## Roles

| Role | May do | May not do |
|---|---|---|
| `owner` | approve or decline decisions | — |
| `operator_a` | build, record build evidence | clear products |
| `operator_b` | review, record rights evidence, gate clearance | edit product code |

Operator B never edits product code. That separation is what made the two-operator model
trustworthy, and it is preserved here: evidence records carry `recordedBy`, so a build
operator and a review operator cannot be confused for one another in the audit trail.

## Decisions

A decision stays `open` until explicitly resolved. It never auto-resolves because work
finished. `resolvedAt` is stamped only on `approved` or `declined`; `open` and `deferred`
leave it null. This is what makes "Decisions stay visible until you approve or decline them"
true in the data rather than only in the UI copy.
