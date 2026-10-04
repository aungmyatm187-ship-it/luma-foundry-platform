# Decisions

Stack choices, and the reasoning. Each entry states what was chosen, what was rejected, and
why — so the next person can revisit the decision rather than guess at it.

## D1 — One rule set, many surfaces

**Chosen:** put the clearance rule in `packages/core` and make MCP and tRPC thin adapters.
**Rejected:** implement the rule separately in the API and the agent surface.

If two surfaces each decide what "cleared" means, they will eventually disagree, and the
disagreement will resolve in favour of whichever one is easier to bypass. One implementation,
tested once, reachable everywhere.

## D2 — Governance as a pure function

**Chosen:** `evaluateClearance` is pure — takes a product and evidence, returns a report.
**Rejected:** fold the check into the status-writing method.

A pure function can be called speculatively. A UI can show "3 evidence kinds missing" without
writing anything, and an agent can ask the same question before acting. The side-effecting
guard (`assertTransitionAllowed`) calls the pure function rather than duplicating it.

## D3 — MCP as a first-class surface

**Chosen:** expose the platform over MCP from the start.
**Rejected:** build a REST API and add an agent integration later.

The platform's whole purpose is that agents drive it. If the agent surface is an afterthought
it inherits whatever the UI was allowed to do, including the shortcuts. Building it first means
the governance gate is designed into the tool contract, and `check_clearance` becomes the
natural first call rather than something bolted on.

## D4 — stdio now, Streamable HTTP when hosted

**Chosen:** stdio transport, with Streamable HTTP documented for multi-tenant hosting.
**Rejected:** start with HTTP.

stdio is the right default while the server runs next to its client — no auth surface, no
network exposure, no tenant isolation problem to get wrong. Streamable HTTP is the correct
answer for a hosted platform, but it brings credential brokering and tenant isolation
requirements that should be designed deliberately, not inherited by accident.

## D5 — npm workspaces

**Chosen:** npm workspaces with TypeScript project references.
**Rejected:** pnpm (not installable in this environment), Turborepo (extra machinery for
three packages).

`npm` ships with Node. Project references give incremental builds and correct cross-package
type checking without a task runner. The `pnpm` symlink was blocked by permissions here, which
is exactly the kind of environment fragility a foundation should not depend on.

## D6 — In-memory storage, for now

**Chosen:** `Workspace` holds state in memory.
**Rejected:** start with Postgres and Drizzle.

The domain shape is still settling, and a database would slow every experiment while adding
migration overhead to changes that may not survive the week. The shipped site already has the
matching tables, so the migration path is known and direct. Storage is the one thing here
that can be swapped without touching a rule.

## D7 — tRPC for the web surface

**Chosen:** tRPC, mirroring the procedures the existing `/workspace` app already calls.
**Rejected:** REST.

The shipped app is already tRPC. Matching it means the existing client keeps working and there
is no translation layer to maintain. The fetch adapter keeps deployment options open.

## D8 — Tests without mocks

**Chosen:** real `Workspace`, real MCP client over the SDK's in-memory transport, real tRPC
caller.
**Rejected:** stubbed collaborators.

The governance gate is the thing that must not break. A test that mocks the store proves the
mock behaves, not the rule. Connecting a real MCP client to a real server exercises the actual
JSON-RPC path, including schema conversion and error wrapping.

## D9 — CI probes the MCP handshake

**Chosen:** CI runs an `initialize` + `tools/list` probe against the built server.
**Rejected:** rely on unit tests alone.

Unit tests import the module directly and would pass even if the server could not start,
could not negotiate a protocol version, or exited on a bad stdio read. The probe catches the
class of failure that only appears when the process is actually run.

## D10 — DNS: keep Manus authoritative, do not cut over to Cloudflare yet

**Chosen:** leave `lumafoundry.live` resolving via the registrar's existing
`ns1/ns2.globaldomaingroup.com` (which points at `104.18.26.246`), and repair the
Cloudflare zone's placeholder records in place.
**Rejected:** changing the registrar nameservers to Cloudflare now.

The live site already resolves and serves HTTP 200 on both `lumafoundry.live`
and `www` via the current authoritative NS. The Cloudflare zone is `pending`
and contained documentation-only placeholders (apex `A 192.0.2.1`, `AAAA
2001:db8::1`). A nameserver cutover would be a destructive change for zero live
benefit. Fixed the placeholders instead: apex `A` now `104.18.26.246`, RFC3849
`AAAA` removed. The cutover remains a deliberate, reversible follow-up once the
Cloudflare zone is confirmed ready end-to-end.

## D11 — CTA: replace toast stubs with a real enquiry intake, not fake checkout

**Chosen:** a self-contained `POST /api/enquiry` lead endpoint (append-only
`enquiries.jsonl` ledger) plus a `/licence.html` buyer-terms surface.
**Rejected:** wiring a live payment path with no merchant-of-record configured.

No live Stripe/Lemon Squeezy/Resend key exists yet, and a fake "checkout" would
be dishonest. The enquiry flow is real (validates `product_id` + email, persists
to disk) and is exactly the lead-capture half that the future merchant-of-record
checkout builds on.

## D12 — Evidence: generate what is genuinely generatable, never fabricate counsel review

**Chosen:** generate `source_commit`, `dependency_sbom`, `third_party_notices`,
and `buyer_terms` from the recovered source and the real `@luma/core` audit
functions, and report `counsel_review` (and owner-signed `contributor_rights` /
`design_history`) as missing.
**Rejected:** marking any product `cleared` by synthesising a counsel review.

A product cannot be `cleared` without a qualified human IP counsel review; that
is the whole point of the gate. `scripts/generate-evidence.mjs` emits an honest
report showing 0/50 clearable and listing what is still missing, so an agent can
ask "what is missing?" and a human can close the remaining rights evidence.

## D13 — Storefront is the deployable entry point, not the recovered Vite shell

**Chosen:** `storefront/` serves `shop.html` (50-product catalogue), `template.html`
(direction page), and `licence.html` (buyer terms); `/` redirects to `/shop.html`.
**Rejected:** keeping `storefront/index.html` and `storefront/app.js`.

The recovered `index.html` was a broken Vite shell (`/src/main.tsx` does not exist in the
recovered source, and `%VITE_ANALYTICS_ENDPOINT%` is an unresolved placeholder). `app.js`
wired a `#viewing-dialog` that exists in no HTML. Both are dead weight: the shop is the real
entry point. The shared `styles.css` was the jewellery-index theme (its classes were absent
from the shop markup); it was replaced with a single dark editorial theme matching the
shop/template/licence pages.

## D14 — Storefront joins the workspace; gateway bot becomes a real CLI

**Chosen:** add `storefront` to the npm workspaces so root `npm test` runs its smoke test,
and expose the gateway bot launcher as the `luma-bot` bin.
**Rejected:** leaving the storefront outside CI and the bot launcher unbinnable.

The storefront had been built but sat outside the workspace, so CI did not exercise it and it
could drift. The gateway already had `server-cli.ts` with a shebang and `--check`/`--runs`/
`--demo`, but no `bin`, so it could not be invoked as `npx luma-bot`. Both changes are
wiring, not new behaviour.

## D15 — Codespaces + GitHub automation as first-class

**Chosen:** ship a `.devcontainer` (Node 22 + Copilot), CI storefront step, a Cloudflare
Pages deploy workflow, a path-based PR labeler, and Dependabot.
**Rejected:** ad-hoc local setup and manual dependency bumps.

The repo targets agent + human contributors; a reproducible Codespaces environment and
automated labels/dependency updates remove friction without changing domain behaviour.
The deploy workflow is safe to commit before its secrets exist (it self-skips).

## Open questions

- **Persistence target.** Postgres via Drizzle matches the shipped schema; confirm before
  implementing.
- **Auth model.** Not yet designed. The MCP server has no auth because it runs on stdio;
  a hosted deployment needs per-tenant credentials.
- **Burmese localisation.** Copy is English-only. The audience is Burmese, so this is a
  product decision before it is an engineering one.
- **Workshop model.** How the 50 products map to workshop tracks is unresolved. See
  `SITE_AND_PRODUCT_STUDY.md`.
