# Cloudflare Worker deployment

This repository configures the static storefront as a **Cloudflare Worker with static assets**. It does not use the Cloudflare Pages deployment flow described by older notes.

## Source of truth

- Worker config: [`../wrangler.toml`](../wrangler.toml) — `name = "luma-foundry"`, assets directory `./storefront`.
- GitHub workflow: [`../.github/workflows/storefront-deploy.yml`](../.github/workflows/storefront-deploy.yml) — invokes `cloudflare/wrangler-action@v4` with `command: deploy`.
- CI: [`../.github/workflows/ci.yml`](../.github/workflows/ci.yml) — typecheck, tests, build, MCP handshake, storefront smoke test, and disposable-Postgres RLS tests.

The deployment workflow runs on pushes to `main` that change `storefront/**` or `wrangler.toml`, and on `workflow_dispatch`. It requires these GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

If the token is absent, the job verifies required assets and explicitly skips deployment. Never print, commit, or copy token values into prompts or repository files.

## Critical runtime limitation

`storefront/server.mjs` is a local Node server. It uses `node:http` and `node:fs/promises`; `POST /api/enquiry` appends to `storefront/enquiries.jsonl` (gitignored). The current `wrangler.toml` declares a static asset directory and has no Worker entry point or durable storage binding. Therefore:

- the local enquiry endpoint works when running `npm run dev:storefront`;
- deploying the static assets does **not** demonstrate that the Node API runs in the Worker;
- a live page returning HTTP 200 does **not** prove enquiry submission or data persistence works in production;
- do not submit test enquiries to the live site.

Before claiming production lead capture, design a Worker-compatible request handler and explicitly chosen durable store/binding, add tests, and document migration/retention/access rules. Do not guess a provider or configure paid services without an owner decision.

## Distinguish deployment paths

The Cloudflare **Workers Builds** checks shown on pull requests are not the same as `.github/workflows/storefront-deploy.yml`. The workflow above deploys Worker `luma-foundry` from `main`; a PR check may use a separate Cloudflare Build trigger, account, or script. Diagnose the exact check URL and connected account before drawing conclusions.

## Safe operating procedure

1. Inspect this file, the workflow, `wrangler.toml`, and current GitHub checks.
2. Confirm the Cloudflare account and Worker targeted by the exact check/deploy.
3. Verify `npm run check` before considering a code release.
4. Do not deploy or change production resources unless the owner explicitly authorized that exact action.
5. Do not change registrar nameservers as part of a routine deploy. Decision D10 in [`DECISIONS.md`](DECISIONS.md) keeps the registrar authoritative until the owner deliberately reopens that decision.

## Last checked operational notes

**2026-10-13; re-check before acting.** `https://lumafoundry.live/` returned HTTP 200 with TLS verification passing. That response does not prove the domain is served by the connected Worker or that the enquiry API works. The authorized Cloudflare account contained `luma-foundry` but not `luma-foundry-platform`. The two failed PR Worker Build links pointed to a different Cloudflare account, so their logs could not be inspected through the connected account. The available `luma-foundry` deployment record showed one version receiving 100% traffic; its resource modification timestamp was later than the newest listed deployment, so verify whether that was configuration-only or an unpublished code change.

To investigate those PR checks, connect the Cloudflare account named in the check links and read its build status/logs. Do not try to repair the integration by changing DNS, token scopes, or production deployments without a reviewed plan and owner authorization.

## Historical note

Earlier notes referred to Pages permissions and a pending zone state. The current repository workflow uses Workers (`wrangler deploy`), so those Pages instructions are not a valid deployment procedure. Re-check current Cloudflare account/DNS status through authorized read-only access rather than relying on old status text.