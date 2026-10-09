# Manual migrations

These SQL files are applied by hand via the Supabase SQL Editor, in numeric
order. They capture changes that Drizzle Kit cannot generate:

- 0001 — evidence hash chain and append-only trigger
- 0002 — Supabase auth.users → public.users linkage
- 0003 — product clearance enforcement (feature/enforce-product-clearance branch)
- 0004 — RLS policies retargeted from authenticated to public

We do NOT use `supabase db push`. The Supabase CLI migration history table is
not maintained in this project. Drizzle Kit and these manual files are the
source of truth. To recreate the database on a fresh Supabase project:

1. `npx drizzle-kit migrate` (schema)
2. `psql` or SQL Editor: run 0001, 0002, 0003, 0004 in order
3. Run the `reset role; alter policy ... to public;` statements if the
   policies were created by a Drizzle migration with `to: authenticatedRole`.

Never modify the remote schema without committing the change here.
