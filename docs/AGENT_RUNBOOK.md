# Luma Foundry Platform — agent runbook

**Purpose:** give a new contributor or agent enough project context to start an assigned task without requiring the owner to retell the history. Pair this with the root [`AGENTS.md`](../AGENTS.md). Re-check all external status before action; dated observations below are not live guarantees.

## 1. Product and maturity

Luma Foundry is an AI workshop/automation platform for producing premium digital products. Its workflow is **Goal → Product → Work Item → Handoff → Decision**, with an evidence gate around commercial clearance.

This repository is a working foundation, not a finished SaaS product. The domain, governance, MCP server, tRPC API, bot gateway, CI, and static storefront are implemented. Production database configuration and hosted authentication remain environment-specific. `packages/ai` has a provider boundary and mock provider; production AI providers are not implemented. No checkout/payment provider is active.

There is no active browser workspace UI wired to the API. The recovered React workspace under `docs/recovery/literal-source/` is historical material, not a safe drop-in: its enums, fields, and identity assumptions differ from the current API. Use it as a visual reference only, and build a new UI against current contracts if that task is approved.

## 2. The rule that must never change accidentally

`packages/core/src/governance.ts` owns `REQUIRED_EVIDENCE`, `evaluateClearance`, and `assertTransitionAllowed`. A product may enter `cleared` only when all eight kinds are recorded:

| Evidence kind | Usual producer | What it establishes |
|---|---|---|
| `source_commit` | machine / builder | Traceability only |
| `dependency_sbom` | machine / builder | Traceability only |
| `third_party_notices` | machine / builder | A generated notice inventory, not counsel approval |
| `buyer_terms` | machine / owner | Terms record, not payment-provider setup |
| `design_history` | human / owner | Design provenance record |
| `asset_licence` | human / owner or licensor | Rights evidence |
| `contributor_rights` | human / owner or contributor | Rights evidence |
| `counsel_review` | qualified human counsel | Human legal review record |

A passing build, live URL, source commit, or SBOM is **not** legal clearance. Never generate or claim missing human review. `conditional` is a valid honest status and is not the same as `cleared`.

The release passport (`packages/core/src/release-passport.ts`; MCP `get_release_passport`) packages current status, evidence coverage, and blockers. It is read-only; it does not authenticate the recorder, verify referenced files, confirm owner approval, or give a legal opinion. References are omitted by default.

## 3. Architecture map

```text
MCP client ──> packages/mcp-server ──┐
Web client ──> apps/api (tRPC) ───────┼──> packages/core
Chat app ────> packages/gateway ─────┘      ├─ domain types + pure governance
                                             ├─ Workspace / repository contracts
                                             └─ in-memory + Drizzle/Postgres adapters
storefront/ ── static catalogue, product pages, buyer terms
```

- **`packages/core`**: domain types in `src/types.ts`; governance gate; synchronous `Workspace`; async repository abstraction and adapters; evidence/passport logic. Pure decisions stay isolated from I/O.
- **`packages/mcp-server`**: MCP tools validated with Zod; delegates behavior to core. Tests use the real SDK client/server and in-memory transport.
- **`apps/api`**: tRPC procedures used by the web surface; delegates to core.
- **`packages/gateway`**: Telegram/Discord/Slack adapters over shared workflows; signature validation is the public webhook trust boundary.
- **`packages/ai`**: provider abstraction with a mock; do not imply a live model integration.
- **`storefront/`**: shop, product direction/template page, licence/terms, and a **local Node** `POST /api/enquiry`. That handler uses `node:fs` to append to a gitignored JSONL ledger. It is not a Worker API or durable production storage.
- **`drizzle/`**: Drizzle schema migrations. **`drizzle/manual/`**: additional manual SQL changes for Supabase, applied in numeric order.

Read [`ARCHITECTURE.md`](ARCHITECTURE.md), [`GOVERNANCE.md`](GOVERNANCE.md), [`SECURITY.md`](SECURITY.md), [`COLLABORATION.md`](COLLABORATION.md), and the dated [product/platform review](reviews/2026-10-09-fluid-prompt-pack.md) for authoritative details.

## 4. Setup and common runs

Requirements: Node.js 20+ (CI/Codespaces use Node 22), npm, and a shell. From a clean clone:

```bash
npm ci
npm run check                    # typecheck + all workspace tests + build
```

Useful commands:

```bash
npm run dev:mcp                  # MCP server over stdio
npm run dev:api                  # tRPC API at http://localhost:3000/api/trpc
npm run dev:storefront            # local Node storefront at http://localhost:4178
npm run evidence                 # generate evidence inventory/report locally
npm run test:db                  # DB/RLS regression suite; disposable LOCAL DB only
```

Gateway CLIs are available after build/install; see [`BOTS.md`](BOTS.md). Storefront route behavior and its smoke test are in [`../storefront/README.md`](../storefront/README.md).

### Database-test safety boundary

`scripts/test-rls-postgres.mjs` refuses to run unless `RLS_TEST_DATABASE_URL` points to a local host (`localhost`, `127.0.0.1`, or `::1`) and database path `/luma_rls_test`. Use only a disposable local PostgreSQL 17 database. Never point this test at production. CI provisions its own disposable PostgreSQL 17 service.

## 5. Validation and definition of done

For normal code changes, run:

```bash
npm run check
git diff --check
```

`npm run check` runs `npm run typecheck`, `npm test` (all workspaces, including storefront smoke tests), and `npm run build`. CI additionally probes the built MCP server with JSON-RPC `initialize`/`tools/list` and replays migrations/tests RLS against disposable Postgres 17.

Tests intentionally avoid mocks at the governance boundary. Add/adjust real-path tests with code changes. If a check cannot run because a service or disposable DB is unavailable, state that accurately; do not claim it passed.

## 6. Database and Supabase operating rules

1. Establish the target project/environment first; never infer production from a local `project_id` string.
2. Commit the corresponding schema/grant change in this repository before changing any remote schema.
3. Drizzle migrations and manual SQL migrations are separate. Apply Drizzle migrations through the documented migration connection; apply files in `drizzle/manual/` via the Supabase SQL Editor, in numeric order.
4. **Do not use `supabase db push`** for this project: the Supabase CLI migration-history table is intentionally not maintained. `drizzle/manual/README.md` is authoritative.
5. Never run `npm run test:db`, `db reset`, seed scripts, or exploratory writes against production.
6. Read and verify RLS policies, table ACLs, default ACLs, ownership, and role flags before proposing a privilege change. RLS does not cover every table privilege (for example, `TRUNCATE`). “RLS enabled” does not prove table grants are safe.
7. A read-only Supabase audit on **2026-10-13** found a mismatch between live grants/default privileges and the intent of manual migration `0006`. Revalidate before action. The current `0006` source does not explicitly clear pre-existing `app_user` write privileges on `public.users` or `app_user` default table privileges; any repair should be a reviewed, source-controlled follow-up migration. No remote database change was made during that audit.

## 7. Deployment and external services

### Cloudflare and storefront

- `wrangler.toml` defines Worker `luma-foundry` and serves static assets from `./storefront`.
- `.github/workflows/storefront-deploy.yml` deploys a **Cloudflare Worker**, not Pages, on pushes to `main` touching `storefront/**` or `wrangler.toml`, or by manual dispatch. It requires GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; it skips deployment when the token is absent.
- The current Wrangler config has only a static-assets directory and no Worker handler or durable storage binding. `storefront/server.mjs` uses Node APIs (`node:http`, `node:fs/promises`), so the local enquiry endpoint is not demonstrated to run in the Worker. A successful static deploy or `lumafoundry.live` HTTP 200 does **not** prove the production enquiry POST works or persists data. Design and test a Worker-compatible endpoint plus durable storage before claiming production lead capture.
- Cloudflare **Workers Builds** PR checks are separate from the `main` deploy workflow. Do not conflate their status.
- **2026-10-13 observation:** `lumafoundry.live` returned HTTP 200. The connected Cloudflare account had `luma-foundry` but not `luma-foundry-platform`; the two failed PR build links pointed to another account, so their logs were not accessible from that connector. Refresh before action.
- DNS/registrar nameserver changes are explicitly not authorized by default. See decision D10 in [`DECISIONS.md`](DECISIONS.md); ask the owner before any cutover or production deploy.

### Render

Render access is not a repository assumption. On 2026-10-13 the connector was enabled but had no stored token and workspace listing was unauthorized. Do not claim Render deployment health until authorization works and the target workspace/service is confirmed.

### External actions

Production database writes, deploys, DNS changes, billing, access control, credentials, and publishing are separate owner-authorized tasks. A request to inspect or diagnose is not approval to mutate. Prefer dry-run/build verification and explain exactly what remains pending.

## 8. Known essential follow-up work

These items were identified in code/doc review; revalidate ownership and current status before implementation. Keep tasks separate and do not bundle production operations into feature work.

1. **Identity and authorization:** several API/workflow inputs contain caller-provided actor/role fields (`recordedBy`, `decidedBy`, `fromRole`, `toRole`). Authentication alone is not authorization. Derive actor identity/role server-side and unify product-clearance with owner-approval enforcement; add cross-surface tests.
2. **Supabase grants:** resolve the dated live grant/default-ACL mismatch with a reviewed manual migration and regression tests before remote application.
3. **Storefront input safety:** catalogue strings and URLs are interpolated into `innerHTML`; validate/safely render external catalogue data and restrict unsafe URL schemes.
4. **Production enquiries:** design a Worker-compatible handler and durable storage (for example, a specifically chosen managed binding); current local filesystem append is not production persistence. Do not submit test enquiries to the live site.
5. **Real workspace UI:** implement only against current API types/auth and current status vocabularies; archived UI is not a drop-in.
6. **Mobile/accessibility:** align navigation on shop/template/licence pages; verify keyboard focus, contrast, reduced motion, and small-screen behavior.
7. **Provider and commercial activation:** production AI provider, payment/merchant-of-record, and counsel review are not implemented. These require explicit product/owner choices, not assumptions.

The dated detailed review is [`reviews/2026-10-09-fluid-prompt-pack.md`](reviews/2026-10-09-fluid-prompt-pack.md).

## 9. Collaboration roles

| Actor | Role | Boundary |
|---|---|---|
| Manus / builder | `operator_a` | Implements and records build evidence; cannot clear a product |
| OpenHands / reviewer | `operator_b` | Reviews and records rights evidence; must not edit product code |
| Owner | `owner` | Resolves decisions and owns consequential product/production choices |

Important work should be a durable platform handoff (`create_handoff`), not only a chat message. Full protocol: [`COLLABORATION.md`](COLLABORATION.md).

## 10. Current collaboration state

At the last checked state (**2026-10-13**), PR #25 contained the release-evidence-passport feature. Typecheck, tests/build, and migration replay passed; two Cloudflare Workers Builds checks failed, and CodeQL/Supabase Preview were skipped. **This status is dated; refresh GitHub checks before merging.**

For every task, first inspect `git status --short --branch`; preserve existing work. Make the smallest change that satisfies acceptance, run validation, and report files changed, checks run, blockers, and external actions not performed.

## 11. Copy/paste prompt for another agent

```text
You are working in the Luma Foundry Platform repository. Read AGENTS.md and
 docs/AGENT_RUNBOOK.md first; they contain the project context, so do not ask me to
re-explain the product or architecture. Inspect git status and relevant tests/docs,
preserve existing changes, and implement this task:

TASK: [paste the concrete task]
ACCEPTANCE: [observable outcomes / files / behavior]
CONSTRAINTS: Keep the single core governance gate; do not fabricate evidence, expose
secrets, or write to production/deploy unless I explicitly authorize that exact action.

Run npm run check and git diff --check when applicable. For database work, use only a
disposable local DB for tests and commit a source-of-truth manual migration before proposing
remote application. Return a short summary of changes, validation, remaining risks, and
any owner action required.
```
