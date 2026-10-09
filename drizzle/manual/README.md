# Manual migrations

These SQL files are applied by hand via the Supabase SQL Editor, in numeric
order. They capture changes that Drizzle Kit cannot generate:

- 0001 — evidence hash chain and append-only trigger
- 0002 — Supabase `auth.users` → `public.users` linkage
- 0003 — database product-clearance trigger (checks required evidence kinds)
- 0004 — RLS policies retargeted to `PUBLIC` so the non-member `app_user` role is covered
- 0005 — security-linter fixes for trigger functions
- 0006 — least-privilege table grants and `app_user` deployment assertions

The Drizzle migration chain is separate and is applied first with
`npx drizzle-kit migrate`. It contains the initial schema and the follow-up
same-goal product foreign keys/policies. We do NOT use `supabase db push`; the
Supabase CLI migration history table is not maintained in this project.
Drizzle Kit and these manual files are the source of truth.

## Fresh-project setup

1. Provision `app_user` as a login role with `BYPASSRLS` disabled. It must not
   own workspace tables or inherit membership in their owner role. Do not put
   its password in this repository.
2. Run `npx drizzle-kit migrate` with the administrator migration connection.
3. In the Supabase SQL Editor, run manual files `0001` through `0006` in order.
4. Configure the application `DATABASE_URL` to use `app_user`; the API does
   not use direct Supabase Data API table access.
5. Run `npm run test:db` against a disposable Postgres database. CI runs this
   same migration-and-policy regression suite on each pull request.

`0006` deliberately fails if `app_user` is missing, has `BYPASSRLS`, or owns
(or inherits ownership of) a workspace table. It removes direct table grants
from `PUBLIC`, `anon`, and `authenticated`, grants the server role only the
operations it needs, and preserves `service_role` for server-only administration.
New public tables default to no Data API access in `supabase/config.toml`; grant
access explicitly in each table migration.

`0003` checks that each of the eight required evidence kinds exists for a
product. It does not verify the authenticity of evidence references or prove
that a human review actually occurred; those require separate trusted
provenance/verification controls.

Never modify the remote schema without committing the corresponding change
here. Do not apply these files to production as part of this test workflow;
review and schedule production migration separately after checking existing
cross-goal references and role grants.
