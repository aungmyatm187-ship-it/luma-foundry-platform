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

## Layout

```
packages/core/         domain model + governance rules (no I/O)
packages/mcp-server/   Model Context Protocol tool surface   → bin: luma-mcp
packages/gateway/      Telegram/Discord/Slack bot server      → bin: luma-bot
apps/api/              tRPC workspace API
apps/slack/            Slack command router (adapter over core)
storefront/            deployable static storefront (shop/template/licence + enquiry)
```

## CLIs

```bash
npm run dev:mcp            # MCP server on stdio (luma-mcp)
npx luma-bot --check       # verify the Telegram bot token
npx luma-bot --runs        # print open workflow runs
npx luma-bot --demo        # run the gateway locally, exercise `help` via CLI
TELEGRAM_BOT_TOKEN=... npx luma-bot   # serve webhooks; see docs/BOTS.md
```

## Development environment

GitHub Codespaces is preconfigured (`.devcontainer/`): Node 22, Copilot
extensions, and `npm install && npm run build` on first open. Ports 3000 (API)
and 4178 (storefront) are forwarded automatically.

## CI / automation

- `.github/workflows/ci.yml` — typecheck, test, build, MCP handshake probe, storefront smoke test.
- `.github/workflows/agent-review.yml` — OpenHands PR review gated on `OPENHANDS_API_KEY`.
- `.github/workflows/storefront-deploy.yml` — Cloudflare Pages deploy of `storefront/`.
- `.github/workflows/labeler.yml` — auto-label PRs by changed path.
- `.github/dependabot.yml` — weekly npm + GitHub Actions dependency updates.

## Documentation

| Doc | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, boundaries, why one rule set |
| [docs/MCP.md](docs/MCP.md) | Tool reference, transports, hosting |
| [docs/GOVERNANCE.md](docs/GOVERNANCE.md) | Evidence model and clearance rules |
| [docs/COLLABORATION.md](docs/COLLABORATION.md) | Manus ↔ OpenHands working protocol |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Stack choices and the reasoning |
| [docs/SECURITY.md](docs/SECURITY.md) | Trust boundaries and secret handling |
| [docs/BOTS.md](docs/BOTS.md) | Telegram/Discord/Slack bot setup |

## Status

Foundation + storefront. The domain, governance gate, both surfaces, CI, and the
deployable storefront are real and tested. Persistence is in-memory by design — swap in a
Drizzle/Postgres repository behind `packages/core` when it is needed, without changing any
rule. Commercial clearance remains gated on human evidence (`counsel_review`) — see
[docs/recovery/RECOVERY_REPORT.md](docs/recovery/RECOVERY_REPORT.md).
