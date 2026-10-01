# Collaboration: Manus ↔ OpenHands

The platform is built to be driven by more than one agent. This document defines how Manus
and OpenHands work on it together without colliding.

## Why it works this way

The original Luma Foundry build succeeded because two operators had **separated
responsibilities and a handoff protocol**, not because either was individually strong.
Operator A built. Operator B reviewed and gated. Neither could quietly do the other's job.

That structure is reproduced here. It is the reason the governance gate is enforceable: the
role that builds a product is not the role that clears it.

## Roles

| Actor | Role in the platform | Responsibilities |
|---|---|---|
| **Manus** | `operator_a` | Design and build. Record build evidence (`source_commit`, `design_history`). Raise handoffs. |
| **OpenHands** | `operator_b` | Review, verify rights evidence, gate clearance. Never edits product code. |
| **Owner** | `owner` | Approves or declines decisions. The only role that closes a decision. |

## The handoff contract

A handoff is a first-class record, not a chat message. It carries the author, recipient,
context, and status — so it survives a lost conversation.

```
Manus  ──create_handoff──▶  OpenHands
       (summary + asks)      (verifies, records evidence)
                                    │
                                    ▼
                            create_decision  ──▶  Owner approves / declines
```

Operator A's handoff must state **what was built** and **what is being asked**. Operator B's
reply must state **which evidence was verified** and **what is still missing**. Vague handoffs
are the failure mode this model exists to prevent.

## Working rules

1. **Manus builds; OpenHands verifies.** OpenHands does not rewrite Manus's product code. It
   records evidence, raises blockers, and gates clearance.
2. **No clearance on a claim.** Neither agent may set a product to `cleared` without running
   `check_clearance` first. The tool enforces this; the rule is not a convention.
3. **Evidence carries its author.** Every evidence record names who recorded it, so the audit
   trail distinguishes build claims from review verifications.
4. **Decisions belong to the owner.** An agent may raise and populate a decision. Only the
   owner resolves it.
5. **Handoffs are durable.** Anything important goes through `create_handoff`, never only
   through conversation history.

## A full cycle, as it looks over MCP

```
# Manus: build and hand off
create_work_item   { assignedTo: "operator_a", type: "build", ... }
update_work_item_status { status: "done" }
record_evidence    { kind: "source_commit", recordedBy: "operator_a" }
record_evidence    { kind: "design_history", recordedBy: "operator_a" }
create_handoff     { fromRole: "operator_a", toRole: "operator_b",
                     asks: "Verify asset licence and contributor rights" }

# OpenHands: verify and gate
check_clearance    { productId }          → missing: asset_licence, counsel_review, ...
record_evidence    { kind: "asset_licence", recordedBy: "operator_b" }
record_evidence    { kind: "contributor_rights", recordedBy: "operator_b" }
check_clearance    { productId }          → clearable: true
create_decision    { title: "Approve for sale", ... }

# Owner: resolve
update_decision_status { status: "approved" }
set_product_status     { status: "cleared" }
```

## Recovering the original work

The original Operator A and Operator B histories are the source material for this platform's
vocabulary. They are held outside version control because they contain credentials the owner
pasted into chat — those should be rotated.

| Artifact | Location | Committed |
|---|---|---|
| Operator A/B command + milestone digests | `manus/out/` | no |
| Full transcripts | `manus/out/` | no |
| 50-product catalogue | `luma-foundry-core/` | yes |
| Governance/evidence documents | `drive/` | yes |

Derived findings live in `SITE_AND_PRODUCT_STUDY.md` and `PROJECT_RECONSTRUCTION.md` at the
repository root.

## Secrets

Each agent gets only the credentials its role needs.

- **Manus** — repository write access, build tooling.
- **OpenHands** — read access plus the review tools.
- Neither agent receives the other's credentials, and no long-lived secret is passed into a
  model context. Resolve secrets server-side at call time.
