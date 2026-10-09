-- Migration 0004: retarget RLS policies from `authenticated` to `public`.
--
-- Supabase reserves the `authenticated` role for users created by Supabase
-- Auth. Our application connects as `app_user`, which is not — and cannot be —
-- a member of `authenticated` (the grant requires ADMIN on that role, which is
-- reserved for Supabase's service account).
--
-- `TO PUBLIC` makes the policies apply to every database role, including
-- `app_user`. It does not grant table privileges by itself. Migration 0006
-- grants workspace CRUD to `app_user`, limits `public.users` to SELECT, and
-- removes direct workspace-table grants from `anon` and `authenticated`.
-- RLS then scopes app_user queries through auth.uid() to the current user.
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
