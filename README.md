# Luma Foundry Platform

AI workshop and automation platform for building and shipping premium digital products.
It carries a product through **Goal → Product → Work Item → Handoff → Decision**, with a
hard governance gate: **a product cannot be marked `cleared` until every required piece of
evidence is recorded.**

That rule is not documentation. It is enforced in code (`packages/core/src/governance.ts`)
and reachable from every surface, so an agent and the web UI cannot disagree about what
"commercially cleared" means.

## Why this exists

Luma Foundry was built by two Manus operators working a review discipline by hand:

- **Operator A** — the Premium Product Factory. Builds the 50 products.
- **Operator B** — the Master Brand Architect. Reviews, records evidence, gates clearance.
  Operator B never edits product code; evidence and data handoff only.

That discipline worked, and every product it produced still sits at
`Conditional / blocked pending evidence` — nothing was ever cleared on a claim. This
repository turns that discipline into an enforceable foundation, so the same rigour can be
applied by humans and agents at platform scale.

## Layout

```
packages/core/         domain model + governance rules (no I/O)
packages/mcp-server/   Model Context Protocol tool surface
apps/api/              tRPC workspace API
docs/                  architecture, MCP, governance, decisions
```

`packages/core` holds all the rules and touches no database, network, or filesystem. Every
other surface is a thin adapter over it.

## Quick start

```bash
npm install
npm run build
npm test
```

All three must pass before anything ships. CI enforces it.

## Surfaces

**MCP server** — exposes the platform as 11 tools so any MCP client (Manus, OpenHands,
Claude, an IDE) can drive the pipeline:

```bash
npm run dev:mcp          # stdio
```

**tRPC API** — the surface the web app calls:

```bash
npm run dev:api          # http://localhost:3000/api/trpc
```

## The governance gate

```ts
import { Workspace, evaluateClearance } from '@luma/core';

const ws = new Workspace();
const owner = ws.createUser('Owner', 'owner');
const goal = ws.createGoal({ ownerId: owner.id, title: 'Launch Batch 01', outcome: 'Cleared' });
const product = ws.createProduct({
  goalId: goal.id, name: 'Axiom Grid', category: 'AI infrastructure', route: '/axiom-grid',
});

ws.updateProductStatus(product.id, 'cleared');
// throws GovernanceError — missing all 8 required evidence kinds
```

Required evidence before clearance:

`source_commit · design_history · asset_licence · contributor_rights ·
dependency_sbom · third_party_notices · counsel_review · buyer_terms`

`source_commit` and `dependency_sbom` are **traceability only**. They prove an artefact
exists. They never prove ownership, licence, or permission to sell. The engine says so
explicitly when they are the only evidence present.

## Documentation

| Doc | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, boundaries, why one rule set |
| [docs/MCP.md](docs/MCP.md) | Tool reference, transports, hosting |
| [docs/GOVERNANCE.md](docs/GOVERNANCE.md) | Evidence model and clearance rules |
| [docs/COLLABORATION.md](docs/COLLABORATION.md) | Manus ↔ OpenHands working protocol |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Stack choices and the reasoning |
| [docs/SECURITY.md](docs/SECURITY.md) | Trust boundaries and secret handling |

## Status

Foundation only. The domain, governance gate, both surfaces, and CI are real and tested
(20 tests). Persistence is in-memory by design — swap in a Drizzle/Postgres repository
behind `packages/core` when it is needed, without changing any rule.
