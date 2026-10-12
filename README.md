# Luma Foundry Platform

AI workshop and automation platform for building and shipping premium digital products.
It carries a product through **Goal → Product → Work Item → Handoff → Decision**, with a
hard governance gate: **a product cannot be marked `cleared` until every required piece of
evidence is recorded.**

That rule is enforced in code (`packages/core/src/governance.ts`) and reached from every
surface, so an agent and the web app cannot disagree about what "commercially cleared" means.

## Why this exists

Luma Foundry was built by two Manus operators working a review discipline by hand:

- **Operator A** — the Premium Product Factory. Builds the 50 products.
- **Operator B** — the Master Brand Architect. Reviews, records evidence, gates clearance.
  Operator B never edits product code; evidence and data handoff only.

That discipline worked, and every product it produced still sits at
`Conditional / blocked pending evidence` — nothing was ever cleared on a claim. This
repository turns that discipline into an enforceable foundation, so the same rigour can be
applied by humans and agents at platform scale.

The pure domain rules live in `packages/core`; the package also contains repository
interfaces and in-memory / Drizzle-Postgres adapters. Application surfaces call the shared
rules rather than implementing a separate clearance policy.

## Quick start

```bash
npm ci
npm run check           # typecheck + all workspace tests + build
```

## Run locally

```bash
npm run dev:mcp         # MCP server on stdio
npm run dev:api         # http://localhost:3000/api/trpc
npm run dev:storefront  # http://localhost:4178
```

The storefront's `POST /api/enquiry` is implemented by its local Node server and appends to a
gitignored JSONL file. The current Cloudflare Worker configuration deploys static assets only;
production enquiry handling and durable storage are **not verified or implied**. See
[docs/AGENT_RUNBOOK.md](docs/AGENT_RUNBOOK.md) and [docs/CLOUDFLARE_DEPLOY.md](docs/CLOUDFLARE_DEPLOY.md).

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

The read-only `get_release_passport` MCP tool exports a portable JSON snapshot of product
status, evidence coverage, and blockers. It omits evidence locations by default and does not
claim to verify those sources or provide a legal opinion. See
[docs/RELEASE_PASSPORT.md](docs/RELEASE_PASSPORT.md).

## Layout

```
packages/core/         domain model, pure governance rules, repository adapters
packages/ai/           provider-agnostic AI adapter boundary (mock only; opt-in)
packages/mcp-server/   Model Context Protocol tool surface   → bin: luma-mcp
packages/gateway/      Telegram/Discord/Slack bot server      → bin: luma-bot
apps/api/              tRPC workspace API
apps/slack/            Slack command router (adapter over core)
storefront/            static catalogue, product pages, buyer terms, local Node enquiry server
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
extensions, and `npm install --no-audit --no-fund && npm run build` on first open. Ports 3000 (API)
and 4178 (storefront) are forwarded automatically.

## CI / automation

- `.github/workflows/ci.yml` — typecheck, test, build, MCP handshake probe, storefront smoke test, and disposable-PostgreSQL RLS tests.
- `.github/workflows/agent-review.yml` — OpenHands PR review gated on `OPENHANDS_API_KEY`.
- `.github/workflows/storefront-deploy.yml` — Cloudflare Worker deployment of static `storefront/` assets via `wrangler.toml`.
- `.github/workflows/labeler.yml` — auto-label PRs by changed path.
- `.github/dependabot.yml` — weekly npm + GitHub Actions dependency updates.

## Documentation

| Doc | Contents |
|---|---|
| [docs/AGENT_RUNBOOK.md](docs/AGENT_RUNBOOK.md) | Project context, safe run/test/deploy workflow, task priorities, and reusable agent prompt |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, boundaries, why one rule set |
| [docs/MCP.md](docs/MCP.md) | Tool reference, transports, hosting |
| [docs/GOVERNANCE.md](docs/GOVERNANCE.md) | Evidence model and clearance rules |
| [docs/RELEASE_PASSPORT.md](docs/RELEASE_PASSPORT.md) | Portable evidence export and trust boundaries |
| [docs/COLLABORATION.md](docs/COLLABORATION.md) | Manus ↔ OpenHands working protocol |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Stack choices and the reasoning |
| [docs/SECURITY.md](docs/SECURITY.md) | Trust boundaries and secret handling |
| [docs/CLOUDFLARE_DEPLOY.md](docs/CLOUDFLARE_DEPLOY.md) | Worker deployment behavior and guardrails |
| [docs/BOTS.md](docs/BOTS.md) | Telegram/Discord/Slack bot setup |

## Status

Foundation + static storefront. The domain, governance gate, MCP/API surfaces, bot gateway,
CI, and catalogue are implemented. There is no active browser workspace UI wired to the API;
recovered UI material is a reference, not a drop-in implementation. Core rules remain storage-
agnostic; production database and hosted authentication are environment-specific. The AI
package has a mock provider only. No checkout/payment provider is active, and commercial
clearance still requires human evidence (`counsel_review`) — see
[docs/recovery/RECOVERY_REPORT.md](docs/recovery/RECOVERY_REPORT.md).
