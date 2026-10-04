# Cloudflare deploy — token spec & secret wiring

Goal: make `.github/workflows/storefront-deploy.yml` actually publish `storefront/`
to Cloudflare Pages and serve it on `lumafoundry.live`. This is blocked on two
things that are *not* code: (1) the Cloudflare token lacks Pages permission, and
(2) the zone is still `pending` (nameservers not cut over).

## 1. Least-privilege token to create

Do NOT reuse the token currently committed to the `API-keys` repo. It has
`Account API Tokens Write` + `User Details Write`, which means anyone holding it
can mint new tokens on the whole account. Create a scoped replacement:

| Scope | Permission group | Resources |
|---|---|---|
| Account | **Cloudflare Pages: Edit** | All zones in account `284bdebcfe9bd5a1370cefef08873db0` |
| Zone | **DNS: Edit** | Zone `lumafoundry.live` |
| Zone | **Zone: Read** | Zone `lumafoundry.live` |

Steps (dashboard): **My Profile → API Tokens → Create Token → Create Custom Token**
→ set the three permission rows above → **IP Address Filtering**: optional
(github-runners change IPs, so leave unrestricted or use a broad range) → Continue
→ Create → copy the token once.

Pages:Edit lets `wrangler pages deploy` push builds. DNS:Edit lets the workflow
(or you) add the CNAME that binds `lumafoundry.live` / `www` to the Pages project.
Zone:Read is needed to look up the zone id.

## 2. GitHub secrets to add

Repo **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | the scoped token from step 1 |
| `CLOUDFLARE_ACCOUNT_ID` | `284bdebcfe9bd5a1370cefef08873db0` |

The workflow already reads these names; it self-skips if they are absent, so
committing it first was safe.

## 3. DNS cutover (still required)

Until the registrar nameservers are changed to Cloudflare, the zone stays
`pending` and Pages cannot serve the apex. In the Cloudflare dashboard the zone
shows **assigned nameservers** `ethan.ns.cloudflare.com` and
`phoenix.ns.cloudflare.com`. Change those two nameservers at the registrar
(Global Domain Group) to the Cloudflare pair. This is the deliberate, reversible
step recorded in `docs/DECISIONS.md` (D10) — it has NOT been done yet.

## 4. Post-deploy bind

After the first successful Pages deploy, create the Pages project:
`wrangler pages project create lumafoundry --production-branch main`, then add
custom domains `lumafoundry.live` and `www.lumafoundry.live`. The Pages dashboard
will emit the exact CNAME targets; add them as DNS records using the token's
DNS:Edit scope.

## 5. Current state (verified 2026-10-04)

- Token `55ef6b33…` (in API-keys repo) is active but has **no Pages permission** —
  `GET /accounts/{id}/pages/projects` returns `10000 Authentication error`.
- Zone `lumafoundry.live` = `373994cb766f1abdf9a5136ffa982c44`, status `pending`.
- Live nameservers still `ns1/ns2.globaldomaingroup.com`; apex A `104.18.26.246`.
