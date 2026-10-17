# Recovered-source secret exposure (2026-10-16)

The commit `Recover literal storefront source (176 files) from Manus Path A task`
(`695842a`) copied literal source and config from the Manus workspace into
`docs/recovery/literal-source/`. Several of those files carried **live secrets**,
and this repository is **public**, so the values were world-readable.

## What was exposed (values never printed)

| File | Field |
| --- | --- |
| `A1__render-api-connector-draft.json` | `env.RENDER_API_KEY` |
| `A1__zai-api-connector-draft.json` | `env.ZAI_API_KEY` |
| `A1__.project-config.json` | `git_remote.token`, `secrets.BUILT_IN_FORGE_API_KEY`, `secrets.JWT_SECRET`, `secrets.VITE_FRONTEND_FORGE_API_KEY` |
| `B1__webhook.test.mjs` | `signingSecret` |

## Required response

1. **Rotate every exposed credential** (a public key is compromised on push).
   The Render key for this app was rotated first. Rotate the rest:
   the ZAI key, the forge/built-in API key, the JWT secret, and the git token.
   - There are two Render keys: `RENDER_API_KEY` (luma-foundry-platform) and
     `RENDER_API_KEY_2` (ember-signal). Confirm which one this dump held before
     assuming only one is affected.
2. **Purge history.** Removing the values in a new commit does not remove them
   from the public history. Rotate first, then rewrite history to drop the blob:
   ```bash
   git filter-repo --path docs/recovery/literal-source --invert-paths
   ```
   and force-push every branch. Because the repo is public, treat any clone or
   fork as already having the old values.
3. **Fix the generator.** The recovery dump must not copy live secrets. Strip or
   placeholder secret-shaped fields at generation time, and keep the `.gitignore`
   rules added here so the files cannot be re-added by accident.

## What this commit does

- Redacts the secret values in the four files above (structure kept, values
  replaced).
- Adds `.gitignore` rules for the recovered config/connector dumps.

It does **not** rewrite history; that is step 2 and needs a force-push.
