# Manual migrations

These SQL files are applied by hand via the Supabase SQL Editor, in numeric
order. They capture changes that Drizzle Kit cannot generate:

- 0001 — evidence hash chain and append-only trigger
- 0002 — Supabase `auth.users` → `public.users` linkage
- 0003 — database product-clearance trigger (checks required evidence kinds)
- 0004 — RLS policies retargeted to `PUBLIC` so the non-member `app_user` role is covered
- 0005 — security-linter fixes for trigger functions
- 0006 — least-privilege table grants and `app_user` deployment assertions
- 0007 — workspace membership: `workspaces`/`workspace_members` tables, `workspace_id`
  on all governance tables with backfill and same-workspace composite foreign keys,
  workspace-membership RLS replacing the per-user policies, `create_workspace()` and
  RLS helper functions, and a replacement signup trigger that assigns the global
  role `pending` plus a personal workspace
- 0008 — consent-based invitations: `workspace_invitations` (7-day expiry,
  single-use, revoke-and-replace), four SECURITY DEFINER lifecycle functions
  (`create_invitation`/`accept_invitation`/`revoke_invitation`/`list_my_invitations`),
  direct membership writes closed, database-derived attribution columns and
  `a10_` triggers on decisions/evidence, and a branching evidence hash payload
  that commits new rows to the database-derived actor

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
3. In the Supabase SQL Editor, run manual files `0001` through `0008` in order.
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

## What migration 0008 locks in

`0008` makes workspace membership consent-based and makes attribution
database-owned. `scripts/test-rls-postgres.mjs` applies it after the 0007-era
assertions and pins all of the following as built:

- **Invitations are the only membership path.** The
  `workspace_members_insert_owners` policy is dropped and the INSERT grant is
  revoked: no role (owners included) can insert membership rows directly any
  more. `accept_invitation()` is the sole writer of `workspace_members`.
- **The lifecycle functions are the single authority.** `create_invitation`
  (owner-only, 7-day expiry fixed inside the function, revoke-and-replace of
  the outstanding invitation for the same invitee), `accept_invitation`
  (invitee-only, single-use, refuses revoked/expired, race-safe row lock),
  `revoke_invitation` (owner-only, idempotent while pending, refuses accepted
  invitations) and `list_my_invitations` (the caller's still-actionable
  invitations). Their rejections are mapped by the API:
  `28000`→UNAUTHORIZED, `42501`→FORBIDDEN, `P0002`→NOT_FOUND,
  `P0001`/`22023`→BAD_REQUEST; anything else fails closed.
- **Invitation RLS is SELECT-only for the parties.** The invitee and the
  owning workspace owner can read a row; there are no INSERT/UPDATE/DELETE
  policies and, for `app_user`, no UPDATE/DELETE grants either.
- **Attribution is database-derived.** `a10_decisions_attribution_trigger` and
  `a10_evidence_attribution_trigger` set `decided_by_user_id` /
  `recorded_by_user_id` from `auth.uid()` on every write, overwriting any
  client-supplied value. Historical rows keep NULL and are never backfilled
  with guessed identities.
- **The evidence hash commits to the actor.** The hash trigger is renamed to
  `z90_evidence_hash_chain_trigger` (the `a10_` prefix guarantees the
  attribution trigger fires first) and the hash function now branches: rows
  with NULL attribution keep the exact 0001/0006 payload (historical chains
  verify forever); attributed rows add `recorded_by_user_id` to the payload.
  The branch is a pure function of the row, so one chain can span both
  payload generations and verification stays self-describing.

## What migration 0007 does to existing data (current behavior)

The backfill in `0007` is deterministic, and `scripts/test-rls-postgres.mjs`
replays it against synthetic pre-0007 fixtures to pin that behavior:

- If any goals exist, ONE shared workspace named `Luma Foundry` is created and
  every pre-existing goal (with its products, work_items, handoffs, decisions,
  and evidence) is placed in it. Users who owned a goal or hold the global role
  `operator_a`/`operator_b` become members; a user whose global role is `owner`
  becomes a workspace owner; if that leaves no owner, the oldest user is
  promoted. Consequence: rows that were previously private to one user become
  readable and editable by every member of the shared workspace — that is a
  product/data-sharing decision, recorded here as implemented and pending
  product confirmation.
- Users not placed in the shared workspace (no goal, no operator role, or a
  global `owner` with no goals) get a personal workspace they own, matching the
  post-0007 signup trigger.
- The evidence hash payload deliberately excludes `workspace_id`; user triggers
  are disabled only for the single-column backfill, so pre-existing hash chains
  remain verifiable (asserted by the test suite).

Known gaps deliberately NOT changed here, awaiting design review:

- **Last-owner protection.** The "every workspace has at least one owner"
  invariant is enforced only while 0007 runs (its closing verification block);
  there is no runtime guard, so a sole owner can currently self-leave or demote
  themselves and leave a workspace ownerless. The test suite pins this current
  behavior and marks it as an unresolved gate; add a product rule before
  altering any policy.
- **Backfill grouping.** Whether all legacy goals belong in one shared
  workspace (versus per-owner workspaces) is the data-sharing decision above;
  the suite tests the behavior as built.

Never modify the remote schema without committing the corresponding change
here. Do not apply these files to production as part of this test workflow;
review and schedule production migration separately after checking existing
cross-goal references and role grants.
