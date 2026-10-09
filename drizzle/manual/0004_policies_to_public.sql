-- Migration 0004: retarget RLS policies from `authenticated` to `public`.
--
-- Supabase reserves the `authenticated` role for users created by Supabase
-- Auth. Our application connects as `app_user`, which is not — and cannot be —
-- a member of `authenticated` (the grant requires ADMIN on that role, which is
-- reserved for Supabase's service account).
--
-- `to public` allows any role to query the table, and the row filter inside
-- each policy (using auth.uid()) still enforces isolation: anonymous users get
-- zero rows, authenticated users get only their own rows.
--
-- Applied via Supabase SQL Editor on 2026-10-09 using RESET ROLE to drop from
-- anon back to the postgres session identity.

alter policy users_own_rows       on public.users       to public;
alter policy goals_own_rows       on public.goals       to public;
alter policy products_own_rows    on public.products    to public;
alter policy work_items_own_rows  on public.work_items  to public;
alter policy handoffs_own_rows    on public.handoffs    to public;
alter policy decisions_own_rows   on public.decisions   to public;
alter policy evidence_own_rows    on public.evidence    to public;
