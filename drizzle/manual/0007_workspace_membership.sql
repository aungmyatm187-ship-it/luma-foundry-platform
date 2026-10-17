-- Migration 0007: workspace membership (multi-user collaboration).
--
-- Apply as the same database administrator that applied 0006, as ONE transaction
-- (Drizzle's migrator and the Supabase SQL editor both do this).
-- Requires PostgreSQL 12+ (ALTER TYPE ... ADD VALUE inside a transaction).
--
--   1. Adds `pending` to the `role` enum: new signups get no operator role.
--   2. Creates workspaces + workspace_members (workspace role: owner | member).
--   3. Adds workspace_id to goals, products, work_items, handoffs, decisions and
--      evidence, backfills it, then enforces NOT NULL and same-workspace FKs.
--   4. Replaces the per-user RLS policies with workspace-membership policies.
--   5. Replaces handle_new_user(): no global owner; each signup gets a personal
--      workspace it owns.
--
-- Assumptions:
--   * Migrations 0001-0006 are applied. Any append-only/hash-chain triggers on
--     public.evidence (not in 0006) are disabled only while workspace_id is
--     backfilled, then re-enabled. Hash columns are never modified, and the hash
--     payload deliberately does NOT include workspace_id, so existing chains
--     stay verifiable.
--   * The evidence kinds / governance gate are untouched.

-- ───────────────────────────────────────────────────────────────
-- 0. Preconditions
-- ───────────────────────────────────────────────────────────────
DO $precheck$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
    RAISE EXCEPTION 'app_user must exist (see migration 0006)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
    RAISE EXCEPTION 'service_role must exist';
  END IF;
END;
$precheck$;

-- ───────────────────────────────────────────────────────────────
-- 1. Enums
-- ───────────────────────────────────────────────────────────────
-- `pending` = signed up, no operator role assigned yet. The new value is not
-- used by any statement in this transaction (only by the trigger at runtime).
ALTER TYPE public.role ADD VALUE IF NOT EXISTS 'pending';

CREATE TYPE public.workspace_role AS ENUM ('owner', 'member');

-- ───────────────────────────────────────────────────────────────
-- 2. New tables
-- ───────────────────────────────────────────────────────────────
CREATE TABLE public.workspaces (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.workspace_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  role         public.workspace_role NOT NULL DEFAULT 'member',
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_members_pkey PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX workspace_members_user_idx ON public.workspace_members (user_id);

ALTER TABLE public.workspaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- ───────────────────────────────────────────────────────────────
-- 3. workspace_id columns (nullable until backfilled)
-- ───────────────────────────────────────────────────────────────
ALTER TABLE public.goals      ADD COLUMN workspace_id uuid;
ALTER TABLE public.products   ADD COLUMN workspace_id uuid;
ALTER TABLE public.work_items ADD COLUMN workspace_id uuid;
ALTER TABLE public.handoffs   ADD COLUMN workspace_id uuid;
ALTER TABLE public.decisions  ADD COLUMN workspace_id uuid;
ALTER TABLE public.evidence   ADD COLUMN workspace_id uuid;

-- ───────────────────────────────────────────────────────────────
-- 4. Backfill (no data loss: every existing row lands in a workspace)
-- ───────────────────────────────────────────────────────────────
-- Rule: if any goals exist, create ONE default workspace "Luma Foundry".
--   Members: every user who owns a goal, plus every operator_a / operator_b user.
--   Workspace role: 'owner' if the user's global role is 'owner', else 'member'.
--   (If that leaves no owner, the oldest user is promoted.)
-- Every other existing user gets a personal workspace they own, matching what the
-- new signup trigger does. All existing goals (and their children) go to the
-- default workspace.
DO $backfill$
DECLARE
  default_ws  uuid;
  personal_ws uuid;
  usr         record;
BEGIN
  IF EXISTS (SELECT 1 FROM public.goals) THEN
    INSERT INTO public.workspaces (name) VALUES ('Luma Foundry')
    RETURNING id INTO default_ws;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    SELECT default_ws,
           u.id,
           CASE WHEN u.role = 'owner' THEN 'owner'::public.workspace_role
                ELSE 'member'::public.workspace_role END
      FROM public.users AS u
     WHERE u.role IN ('operator_a', 'operator_b')
        OR EXISTS (SELECT 1 FROM public.goals AS g WHERE g.owner_id = u.id);

    IF NOT EXISTS (
      SELECT 1 FROM public.workspace_members AS m
       WHERE m.workspace_id = default_ws AND m.role = 'owner'
    ) THEN
      UPDATE public.workspace_members
         SET role = 'owner'
       WHERE workspace_id = default_ws
         AND user_id = (
           SELECT m.user_id
             FROM public.workspace_members AS m
             JOIN public.users AS u ON u.id = m.user_id
            WHERE m.workspace_id = default_ws
            ORDER BY u.created_at, u.id
            LIMIT 1
         );
    END IF;

    UPDATE public.goals SET workspace_id = default_ws;

    UPDATE public.products AS p
       SET workspace_id = g.workspace_id
      FROM public.goals AS g WHERE g.id = p.goal_id;

    UPDATE public.work_items AS w
       SET workspace_id = g.workspace_id
      FROM public.goals AS g WHERE g.id = w.goal_id;

    UPDATE public.handoffs AS h
       SET workspace_id = g.workspace_id
      FROM public.goals AS g WHERE g.id = h.goal_id;

    UPDATE public.decisions AS d
       SET workspace_id = g.workspace_id
      FROM public.goals AS g WHERE g.id = d.goal_id;
  END IF;

  -- Everyone not placed above gets a personal workspace they own.
  FOR usr IN
    SELECT u.id, u.name
      FROM public.users AS u
     WHERE NOT EXISTS (
       SELECT 1 FROM public.workspace_members AS m WHERE m.user_id = u.id
     )
  LOOP
    INSERT INTO public.workspaces (name) VALUES (usr.name || '''s workspace')
    RETURNING id INTO personal_ws;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (personal_ws, usr.id, 'owner');
  END LOOP;
END;
$backfill$;

-- Evidence is append-only: suspend user triggers (append-only guard / hash chain)
-- for this one column backfill only. row_hash / prev_hash are not touched.
ALTER TABLE public.evidence DISABLE TRIGGER USER;

UPDATE public.evidence AS e
   SET workspace_id = p.workspace_id
  FROM public.products AS p
 WHERE p.id = e.product_id;

ALTER TABLE public.evidence ENABLE TRIGGER USER;

-- ───────────────────────────────────────────────────────────────
-- 5. Enforce NOT NULL, indexes, and same-workspace integrity
-- ───────────────────────────────────────────────────────────────
ALTER TABLE public.goals      ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.products   ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.work_items ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.handoffs   ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.decisions  ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.evidence   ALTER COLUMN workspace_id SET NOT NULL;

CREATE INDEX goals_workspace_idx      ON public.goals      (workspace_id);
CREATE INDEX products_workspace_idx   ON public.products   (workspace_id);
CREATE INDEX work_items_workspace_idx ON public.work_items (workspace_id);
CREATE INDEX handoffs_workspace_idx   ON public.handoffs   (workspace_id);
CREATE INDEX decisions_workspace_idx  ON public.decisions  (workspace_id);
CREATE INDEX evidence_workspace_idx   ON public.evidence   (workspace_id);

-- goals is the root: the only direct FK to workspaces. ON DELETE RESTRICT so a
-- workspace holding governance data cannot be dropped by accident.
ALTER TABLE public.goals
  ADD CONSTRAINT goals_workspace_id_fk
    FOREIGN KEY (workspace_id) REFERENCES public.workspaces (id) ON DELETE RESTRICT,
  ADD CONSTRAINT goals_id_workspace_id_unique UNIQUE (id, workspace_id);

-- Children carry composite FKs so a row can never point at a parent in a
-- different workspace (RLS WITH CHECK alone would not stop a user who belongs
-- to two workspaces from mixing them).
ALTER TABLE public.products
  ADD CONSTRAINT products_id_workspace_id_unique UNIQUE (id, workspace_id),
  ADD CONSTRAINT products_goal_workspace_fk
    FOREIGN KEY (goal_id, workspace_id)
    REFERENCES public.goals (id, workspace_id) ON DELETE CASCADE;

ALTER TABLE public.work_items
  ADD CONSTRAINT work_items_goal_workspace_fk
    FOREIGN KEY (goal_id, workspace_id)
    REFERENCES public.goals (id, workspace_id) ON DELETE CASCADE,
  ADD CONSTRAINT work_items_product_workspace_fk
    FOREIGN KEY (product_id, workspace_id)
    REFERENCES public.products (id, workspace_id) ON DELETE CASCADE;

ALTER TABLE public.handoffs
  ADD CONSTRAINT handoffs_goal_workspace_fk
    FOREIGN KEY (goal_id, workspace_id)
    REFERENCES public.goals (id, workspace_id) ON DELETE CASCADE,
  ADD CONSTRAINT handoffs_product_workspace_fk
    FOREIGN KEY (product_id, workspace_id)
    REFERENCES public.products (id, workspace_id) ON DELETE CASCADE;

ALTER TABLE public.decisions
  ADD CONSTRAINT decisions_goal_workspace_fk
    FOREIGN KEY (goal_id, workspace_id)
    REFERENCES public.goals (id, workspace_id) ON DELETE CASCADE,
  ADD CONSTRAINT decisions_product_workspace_fk
    FOREIGN KEY (product_id, workspace_id)
    REFERENCES public.products (id, workspace_id) ON DELETE CASCADE;

ALTER TABLE public.evidence
  ADD CONSTRAINT evidence_product_workspace_fk
    FOREIGN KEY (product_id, workspace_id)
    REFERENCES public.products (id, workspace_id) ON DELETE CASCADE;

-- ───────────────────────────────────────────────────────────────
-- 6. RLS helper functions
-- ───────────────────────────────────────────────────────────────
-- SECURITY DEFINER (owned by the admin, who bypasses RLS) so policies can read
-- workspace_members / users without recursing into their own policies.
-- search_path is pinned and every reference is schema-qualified.
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT u.id
    FROM public.users AS u
   WHERE u.auth_user_id = (SELECT auth.uid())
$function$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.workspace_members AS m
     WHERE m.workspace_id = p_workspace_id
       AND m.user_id = public.current_user_id()
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.workspace_members AS m
     WHERE m.workspace_id = p_workspace_id
       AND m.user_id = public.current_user_id()
       AND m.role = 'owner'
  )
$function$;

CREATE OR REPLACE FUNCTION public.shares_workspace_with(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.workspace_members AS mine
      JOIN public.workspace_members AS theirs
        ON theirs.workspace_id = mine.workspace_id
     WHERE mine.user_id = public.current_user_id()
       AND theirs.user_id = p_user_id
  )
$function$;

-- Workspace creation goes through this function (creator becomes owner), so
-- clients never need INSERT on workspaces.
CREATE OR REPLACE FUNCTION public.create_workspace(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid := public.current_user_id();
  v_ws   uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF coalesce(btrim(p_name), '') = '' THEN
    RAISE EXCEPTION 'workspace name is required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.workspaces (name) VALUES (btrim(p_name)) RETURNING id INTO v_ws;
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_ws, v_user, 'owner');
  RETURN v_ws;
END;
$function$;

REVOKE ALL ON FUNCTION
  public.current_user_id(),
  public.is_workspace_member(uuid),
  public.is_workspace_owner(uuid),
  public.shares_workspace_with(uuid),
  public.create_workspace(text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.current_user_id(),
  public.is_workspace_member(uuid),
  public.is_workspace_owner(uuid),
  public.shares_workspace_with(uuid),
  public.create_workspace(text)
TO app_user, service_role;

-- ───────────────────────────────────────────────────────────────
-- 7. Table grants for the new tables (same least-privilege model as 0006)
-- ───────────────────────────────────────────────────────────────
REVOKE ALL ON TABLE public.workspaces, public.workspace_members
FROM PUBLIC, anon, authenticated;

-- No INSERT on workspaces for app_user: creation is via create_workspace().
GRANT SELECT, UPDATE, DELETE ON TABLE public.workspaces TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workspace_members TO app_user;

GRANT ALL PRIVILEGES ON TABLE public.workspaces, public.workspace_members TO service_role;

-- ───────────────────────────────────────────────────────────────
-- 8. RLS: drop per-user policies, create workspace-membership policies
-- ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS goals_own_rows      ON public.goals;
DROP POLICY IF EXISTS products_own_rows   ON public.products;
DROP POLICY IF EXISTS work_items_own_rows ON public.work_items;
DROP POLICY IF EXISTS handoffs_own_rows   ON public.handoffs;
DROP POLICY IF EXISTS decisions_own_rows  ON public.decisions;
DROP POLICY IF EXISTS evidence_own_rows   ON public.evidence;

-- Core tables: any workspace member may SELECT/INSERT/UPDATE/DELETE rows of that
-- workspace. WITH CHECK stops moving/creating rows in a workspace you're not in.
CREATE POLICY goals_workspace_members ON public.goals
  AS PERMISSIVE FOR ALL TO public
  USING      (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY products_workspace_members ON public.products
  AS PERMISSIVE FOR ALL TO public
  USING      (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY work_items_workspace_members ON public.work_items
  AS PERMISSIVE FOR ALL TO public
  USING      (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY handoffs_workspace_members ON public.handoffs
  AS PERMISSIVE FOR ALL TO public
  USING      (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY decisions_workspace_members ON public.decisions
  AS PERMISSIVE FOR ALL TO public
  USING      (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY evidence_workspace_members ON public.evidence
  AS PERMISSIVE FOR ALL TO public
  USING      (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

-- workspaces: members read; owners rename/delete. (Insert: create_workspace().)
CREATE POLICY workspaces_select_members ON public.workspaces
  AS PERMISSIVE FOR SELECT TO public
  USING (public.is_workspace_member(id));

CREATE POLICY workspaces_update_owners ON public.workspaces
  AS PERMISSIVE FOR UPDATE TO public
  USING      (public.is_workspace_owner(id))
  WITH CHECK (public.is_workspace_owner(id));

CREATE POLICY workspaces_delete_owners ON public.workspaces
  AS PERMISSIVE FOR DELETE TO public
  USING (public.is_workspace_owner(id));

-- workspace_members: members see the roster; only owners add/change members;
-- owners may remove anyone, and any member may remove themselves (leave).
CREATE POLICY workspace_members_select ON public.workspace_members
  AS PERMISSIVE FOR SELECT TO public
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY workspace_members_insert_owners ON public.workspace_members
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY workspace_members_update_owners ON public.workspace_members
  AS PERMISSIVE FOR UPDATE TO public
  USING      (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY workspace_members_delete_owner_or_self ON public.workspace_members
  AS PERMISSIVE FOR DELETE TO public
  USING (
    public.is_workspace_owner(workspace_id)
    OR user_id = public.current_user_id()
  );

-- users: keep users_own_rows (0006 grants SELECT only, so nobody can self-edit
-- their global role); additionally let workspace peers see each other's rows
-- so the UI can show names/roles of collaborators.
CREATE POLICY users_workspace_peers ON public.users
  AS PERMISSIVE FOR SELECT TO public
  USING (public.shares_workspace_with(id));

-- ───────────────────────────────────────────────────────────────
-- 9. Fix the signup trigger function
-- ───────────────────────────────────────────────────────────────
-- Replaces the 0002 version, which gave every signup the global role 'owner'.
-- Now: global role = 'pending' (no operator role until a service_role admin
-- assigns operator_a / operator_b), plus a personal workspace the user owns.
-- Access to anyone else's workspace requires an owner adding them as a member.
-- The existing on_auth_user_created trigger keeps pointing at this function.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_name    text;
  v_user_id uuid;
  v_ws_id   uuid;
BEGIN
  v_name := coalesce(NEW.raw_user_meta_data->>'name', NEW.email, 'Unnamed');

  INSERT INTO public.users (auth_user_id, name, role)
  VALUES (NEW.id, v_name, 'pending')
  RETURNING id INTO v_user_id;

  INSERT INTO public.workspaces (name)
  VALUES (v_name || '''s workspace')
  RETURNING id INTO v_ws_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_ws_id, v_user_id, 'owner');

  RETURN NEW;
END;
$function$;

-- Trigger functions are not meant to be callable through the API.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ───────────────────────────────────────────────────────────────
-- 10. Post-migration sanity checks (fail the whole migration if violated)
-- ───────────────────────────────────────────────────────────────
DO $verify$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.workspaces AS w
     WHERE NOT EXISTS (
       SELECT 1 FROM public.workspace_members AS m
        WHERE m.workspace_id = w.id AND m.role = 'owner'
     )
  ) THEN
    RAISE EXCEPTION 'every workspace must have at least one owner';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.users AS u
     WHERE NOT EXISTS (
       SELECT 1 FROM public.workspace_members AS m WHERE m.user_id = u.id
     )
  ) THEN
    RAISE EXCEPTION 'every user must belong to at least one workspace';
  END IF;
END;
$verify$;
