# Architecture Audit — Phase 1 (codebase archaeology)

Date: 2026-10-11 · Method: direct file reads, live MCP JSON-RPC probes, CI check
inspection. Every claim below was verified against main @ 95ff47f.

## 1. Verified claims (docs ↔ code parity)

| Claim | Evidence | Status |
|---|---|---|
| 8 required evidence kinds | governance.ts:17-26 | ✓ |
| Traceability-only never clears | governance.ts:61-73 blocker text | ✓ |
| Single enforcement point | assertTransitionAllowed, all surfaces delegate | ✓ |
| MCP exposes 15 tools | live tools/list probe | ✓ (docs fixed, #21) |
| API mirrors MCP rules | router.ts checkClearance/setProductStatus | ✓ |
| Gates are declarative data | workflow.ts Gate union | ✓ |
| Stages reused across workflows | workflows.ts STAGE catalogue | ✓ |
| Core has no external imports | grep of core imports | ✗ — see F3 |

## 2. Codebase shape

~6,765 LoC TypeScript. Tests ≈25% of codebase (no-mocks rule has weight).
Thin adapters confirmed: api 150 LoC, slack 291. Largest file: mcp-server
index.ts (480).

## 3. Findings

### F1 — API persistence (#7) is already wired; issue is stale
router.ts binds per-request ctx.ws (AsyncWorkspace.fromDrizzle for
authenticated, fromInMemory otherwise). Remaining to close #7: verify
createContext in apps/api/src/trpc.ts; add restart-persistence test
(record evidence → new router instance → read same record); update issue.

### F2 — Two clearance code paths can disagree (#17) — highest priority
Workflow engine clearance stage: 8-evidence gate AND owner-approval gate.
Direct path (updateProductStatus → assertTransitionAllowed): evidence only.
An actor with evidence recorded can clear via set_product_status without
owner approval, bypassing the workflow's dual gate. Fix direction: one
canonical predicate (evidence + recorded owner approval) shared by both
paths; assertTransitionAllowed should consume it.

### F3 — AGENTS.md rule 3 (core purity) has drifted
External imports now exist: db.ts (dotenv, drizzle-orm, postgres),
drizzle-repository.ts (drizzle-orm), schema.ts (drizzle-orm, supabase),
emberLiteEvidenceAdapter.ts (node:crypto). Governance modules remain pure.
Recommended: reword rule to "governance logic is I/O-free; persistence only
in db/schema/repository files". Physical split (packages/storage) optional.

### F4 — Presence ≠ qualification (#16)
evaluateClearance checks evidence-kind presence. Qualification of the
recorder (counsel_review "qualified") is unenforceable while recordedBy /
heldCapabilities are client-supplied at every edge (MCP record_evidence,
API recordEvidence, workflow stage entry).

### F5 — Bootstrap asymmetry (#22)
API exposes createUser; MCP registers no user tool. Fresh MCP server cannot
seed; fresh API rejects unauthenticated. Both surfaces depend on identity
resolution (drizzle mode binds LUMA_AUTH_USER_ID).

### F6 — Workflow engine is policy-as-data (platform strength)
Ten shared stages (intake…deploy); gates readable without engine code;
adding a function = composing stages. External alignment: in-toto/SLSA
layouts, OPA policy-as-code — novelty claim for positioning doc (Phase 3).

### F7 — Unguarded transitions (documented boundary)
assertTransitionAllowed guards only →cleared. Moves to blocked/conditional
are ungated by design; boundary should be documented in GOVERNANCE.md.

## 4. Recommended action order

1. Close out #7 properly: createContext verification + restart-persistence test
2. #17: canonical clearance predicate (evidence + owner approval) — closes the bypass
3. #16/#22: server-derived identity, then MCP bootstrap decision
4. Reword AGENTS.md rule 3 (small docs PR)
5. RLS runtime tests (npm run test:db) — review PDF finding 4
