-- Migration 0009: per-owner goal workspaces, last-owner protection, strict attribution.
--
-- STATUS: DRAFT. NOT APPLIED. Never run this against production until the
-- production goal-owner mapping has been reviewed and supplied in the transaction-local
-- setting documented below, and the disposable-database tests have passed.
--
-- Apply after 0001-0008 as the same database administrator/table owner used for
-- the prior manual migrations, in ONE transaction. The temporary tables below use
-- ON COMMIT DROP. Do not execute statements from this file in separate transactions.
--
-- Goal-owner map input:
--   For a database with zero goals, omit the setting (or supply the empty JSON array).
--   For a database with one or more goals, set the transaction-local custom setting
--   `app.bridge_0009_goal_owner_map` to a JSON array of objects with `goal_id` and
--   `owner_id`, using public.users.id UUIDs, before executing this file in the same
--   transaction. Every existing goal must appear exactly once. The migration does
--   not infer production ownership from the old shared-workspace backfill.
--   Missing, malformed, incomplete, duplicate, or extra map entries abort the whole
--   transaction. This parameter is data input only; it is not an authorization bypass.
--
-- A successful split creates one active workspace per distinct mapped goal owner,
-- moves each goal and its child rows there, and archives (does not delete) the old
-- goal-bearing workspaces. Existing member rows and invitation history are retained
-- in archived workspaces; unaccepted invitations are revoked. Users left without
-- any active workspace receive a personal workspace they own. Collaboration on new
-- per-owner workspaces must use the existing 0008 invite-and-accept flow.
--
-- Strict attribution semantics:
--   * new goals: owner_id is overwritten with public.users.id for auth.uid(); goal
--     ownership is immutable through ordinary row UPDATEs;
--   * decisions: decided_by and decided_by_user_id are overwritten from the actor's
--     current public.users.role and internal users.id on INSERT/UPDATE;
--   * evidence: recorded_by and recorded_by_user_id are overwritten from the actor's
--     current public.users.role and internal users.id on INSERT, before z90 hash-chain;
--   * global role `pending` remains `pending` in the DB record. It cannot be forged as
--     `owner`, `operator_a`, or `operator_b` by client-supplied fields. The API may
--     impose additional role-specific workflow restrictions.
--   * writes requiring attribution with no auth.uid() fail closed. Historical rows
--     are not rewritten for attribution; the only historical owner change is the
--     explicit, reviewed goal-owner map required above.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Preconditions and temporary map structures
-- ─────────────────────────────────────────────────────────────────────────────
DO $precheck$
BEGIN
  IF to_regclass('public.users') IS NULL
     OR to_regclass('public.goals') IS NULL
     OR to_regclass('public.workspaces') IS NULL
     OR to_regclass('public.workspace_members') IS NULL
     OR to_regclass('public.products') IS NULL
     OR to_regclass('public.work_items') IS NULL
     OR to_regclass('public.handoffs') IS NULL
     OR to_regclass('public.decisions') IS NULL
     OR to_regclass('public.evidence') IS NULL
     OR to_regclass('public.workspace_invitations') IS NULL THEN
    RAISE EXCEPTION '0009 requires the complete 0007/0008 workspace schema';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
    RAISE EXCEPTION 'app_user must exist (see migration 0006)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
    RAISE EXCEPTION 'service_role must exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute
     WHERE attrelid = 'public.decisions'::regclass
       AND attname = 'decided_by_user_id' AND NOT attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute
     WHERE attrelid = 'public.evidence'::regclass
       AND attname = 'recorded_by_user_id' AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION '0009 requires the 0008 attribution columns';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'evidence'
      AND t.tgname = 'z90_evidence_hash_chain_trigger' AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION '0009 requires the 0008 z90 evidence hash-chain trigger';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.workspaces w
     WHERE NOT EXISTS (
       SELECT 1 FROM public.workspace_members m
        WHERE m.workspace_id = w.id AND m.role = 'owner'
     )
  ) THEN
    RAISE EXCEPTION 'pre-existing ownerless workspace found; resolve it explicitly before 0009';
  END IF;
END;
$precheck$;

CREATE TEMP TABLE bridge_0009_goal_owner_map (
  goal_id  uuid PRIMARY KEY,
  owner_id uuid NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE bridge_0009_old_workspaces (
  workspace_id uuid PRIMARY KEY
) ON COMMIT DROP;

CREATE TEMP TABLE bridge_0009_owner_workspaces (
  owner_id    uuid PRIMARY KEY,
  workspace_id uuid NOT NULL UNIQUE
) ON COMMIT DROP;

-- This migration changes workspace IDs across related tables and must not race
-- with application writes, invitation acceptance, signup, or role promotion.
-- ACCESS EXCLUSIVE is intentionally disruptive: schedule a maintenance window.
LOCK TABLE public.users,
           public.workspaces,
           public.workspace_members,
           public.goals,
           public.products,
           public.work_items,
           public.handoffs,
           public.decisions,
           public.evidence,
           public.workspace_invitations
  IN ACCESS EXCLUSIVE MODE;

DO $locked_precheck$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.workspaces w
     WHERE NOT EXISTS (
       SELECT 1 FROM public.workspace_members m
        WHERE m.workspace_id = w.id AND m.role = 'owner'
     )
  ) THEN
    RAISE EXCEPTION 'pre-existing ownerless workspace found after locks; resolve it explicitly before 0009';
  END IF;
END;
$locked_precheck$;

CREATE TEMP TABLE bridge_0009_evidence_snapshot ON COMMIT DROP AS
SELECT id, row_hash, prev_hash, recorded_by, recorded_by_user_id, recorded_at
  FROM public.evidence;

DO $load_goal_owner_map$
DECLARE
  v_raw text;
  v_map jsonb;
  v_goal_count bigint;
  v_map_count bigint;
BEGIN
  SELECT count(*) INTO v_goal_count FROM public.goals;
  v_raw := nullif(current_setting('app.bridge_0009_goal_owner_map', true), '');

  IF v_raw IS NULL THEN
    IF v_goal_count > 0 THEN
      RAISE EXCEPTION
        '0009 requires app.bridge_0009_goal_owner_map for a non-empty goals table; no owner mapping was supplied';
    END IF;
    v_map := '[]'::jsonb;
  ELSE
    BEGIN
      v_map := v_raw::jsonb;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'app.bridge_0009_goal_owner_map is not valid JSON';
    END;
  END IF;

  IF jsonb_typeof(v_map) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'goal-owner map must be a JSON array';
  END IF;

  IF v_goal_count = 0 AND jsonb_array_length(v_map) <> 0 THEN
    RAISE EXCEPTION 'goal-owner map must be empty when public.goals is empty';
  END IF;

  INSERT INTO bridge_0009_goal_owner_map (goal_id, owner_id)
  SELECT item.goal_id, item.owner_id
    FROM jsonb_to_recordset(v_map) AS item(goal_id uuid, owner_id uuid);

  SELECT count(*) INTO v_map_count FROM bridge_0009_goal_owner_map;
  IF v_map_count <> v_goal_count THEN
    RAISE EXCEPTION 'goal-owner map must contain exactly one row for every existing goal';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.goals g
      LEFT JOIN bridge_0009_goal_owner_map m ON m.goal_id = g.id
     WHERE m.goal_id IS NULL
  ) THEN
    RAISE EXCEPTION 'goal-owner map is missing one or more existing goal IDs';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM bridge_0009_goal_owner_map m
      LEFT JOIN public.goals g ON g.id = m.goal_id
     WHERE g.id IS NULL
  ) THEN
    RAISE EXCEPTION 'goal-owner map contains an unknown goal ID';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM bridge_0009_goal_owner_map m
      LEFT JOIN public.users u ON u.id = m.owner_id
     WHERE u.id IS NULL
  ) THEN
    RAISE EXCEPTION 'goal-owner map contains an owner ID absent from public.users';
  END IF;
END;
$load_goal_owner_map$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Archive marker and workspace split
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.workspaces
  ADD COLUMN archived_at timestamptz,
  ADD COLUMN owner_guard_version bigint NOT NULL DEFAULT 0,
  ADD CONSTRAINT workspaces_owner_guard_version_check CHECK (owner_guard_version >= 0);

COMMENT ON COLUMN public.workspaces.archived_at IS
  'Set by migration 0009 for legacy shared workspaces after their goals are moved. Archived workspaces are hidden from ordinary workspace membership/ownership helpers; rows are retained for audit/history.';

COMMENT ON COLUMN public.workspaces.owner_guard_version IS
  'Internal serialization counter incremented by the workspace-member guard so concurrent owner changes serialize even under stronger transaction isolation.';

INSERT INTO bridge_0009_old_workspaces (workspace_id)
SELECT DISTINCT g.workspace_id
  FROM public.goals g
  JOIN bridge_0009_goal_owner_map m ON m.goal_id = g.id;

DO $create_goal_owner_workspaces$
DECLARE
  v_owner record;
  v_workspace_id uuid;
  v_name text;
BEGIN
  FOR v_owner IN
    SELECT DISTINCT m.owner_id, u.name
      FROM bridge_0009_goal_owner_map m
      JOIN public.users u ON u.id = m.owner_id
     ORDER BY m.owner_id
  LOOP
    v_name := coalesce(nullif(btrim(v_owner.name), ''), 'Owner') || '''s workspace';

    INSERT INTO public.workspaces (name)
    VALUES (v_name)
    RETURNING id INTO v_workspace_id;

    INSERT INTO bridge_0009_owner_workspaces (owner_id, workspace_id)
    VALUES (v_owner.owner_id, v_workspace_id);

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, v_owner.owner_id, 'owner');
  END LOOP;
END;
$create_goal_owner_workspaces$;

-- Reassigning parent and child workspace_id values must be atomic. 0007's
-- composite FKs are temporarily removed and recreated below; no row is deleted.
ALTER TABLE public.products
  DROP CONSTRAINT products_goal_workspace_fk;
ALTER TABLE public.work_items
  DROP CONSTRAINT work_items_goal_workspace_fk,
  DROP CONSTRAINT work_items_product_workspace_fk;
ALTER TABLE public.handoffs
  DROP CONSTRAINT handoffs_goal_workspace_fk,
  DROP CONSTRAINT handoffs_product_workspace_fk;
ALTER TABLE public.decisions
  DROP CONSTRAINT decisions_goal_workspace_fk,
  DROP CONSTRAINT decisions_product_workspace_fk;
ALTER TABLE public.evidence
  DROP CONSTRAINT evidence_product_workspace_fk;

-- The 0008 decisions trigger stamps every UPDATE. Temporarily remove it so this
-- migration's workspace-only move does not erase or rewrite historical actor IDs.
DROP TRIGGER IF EXISTS a10_decisions_attribution_trigger ON public.decisions;

UPDATE public.goals g
   SET owner_id = m.owner_id,
       workspace_id = ow.workspace_id
  FROM bridge_0009_goal_owner_map m
  JOIN bridge_0009_owner_workspaces ow ON ow.owner_id = m.owner_id
 WHERE g.id = m.goal_id;

UPDATE public.products p
   SET workspace_id = g.workspace_id
  FROM public.goals g
  JOIN bridge_0009_goal_owner_map m ON m.goal_id = g.id
 WHERE p.goal_id = g.id;

UPDATE public.work_items wi
   SET workspace_id = g.workspace_id
  FROM public.goals g
  JOIN bridge_0009_goal_owner_map m ON m.goal_id = g.id
 WHERE wi.goal_id = g.id;

UPDATE public.handoffs h
   SET workspace_id = g.workspace_id
  FROM public.goals g
  JOIN bridge_0009_goal_owner_map m ON m.goal_id = g.id
 WHERE h.goal_id = g.id;

UPDATE public.decisions d
   SET workspace_id = g.workspace_id
  FROM public.goals g
  JOIN bridge_0009_goal_owner_map m ON m.goal_id = g.id
 WHERE d.goal_id = g.id;

-- Evidence is append-only and its existing hash excludes workspace_id. This
-- one-column relocation must not run the append-only/hash user triggers and must
-- never change row_hash, prev_hash, recorded_by, or attribution IDs.
ALTER TABLE public.evidence DISABLE TRIGGER USER;
UPDATE public.evidence e
   SET workspace_id = p.workspace_id
  FROM public.products p
  JOIN bridge_0009_owner_workspaces ow
    ON ow.workspace_id = p.workspace_id
 WHERE e.product_id = p.id;
ALTER TABLE public.evidence ENABLE TRIGGER USER;

-- Restore the same-workspace integrity guards after the atomic relocation.
ALTER TABLE public.products
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

-- Pending invitations for a soon-to-be-archived shared workspace are not carried
-- into any new owner's workspace. They are revoked; accepted invite rows remain as
-- history, and former collaborators must be invited to a new workspace explicitly.
UPDATE public.workspace_invitations wi
   SET revoked_at = now()
  FROM bridge_0009_old_workspaces old
 WHERE wi.workspace_id = old.workspace_id
   AND wi.accepted_at IS NULL
   AND wi.revoked_at IS NULL;

UPDATE public.workspaces w
   SET archived_at = now()
  FROM bridge_0009_old_workspaces old
 WHERE w.id = old.workspace_id;

-- The archived shared workspaces are hidden from active membership helpers below.
-- Give each registered user with no remaining active workspace a personal one;
-- no former collaborator is silently added to another owner's workspace.
DO $ensure_personal_workspaces$
DECLARE
  v_user record;
  v_workspace_id uuid;
BEGIN
  FOR v_user IN
    SELECT u.id, u.name
      FROM public.users u
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.workspace_members m
         JOIN public.workspaces w ON w.id = m.workspace_id
        WHERE m.user_id = u.id
          AND w.archived_at IS NULL
     )
     ORDER BY u.id
  LOOP
    INSERT INTO public.workspaces (name)
    VALUES (coalesce(nullif(btrim(v_user.name), ''), 'Personal') || '''s workspace')
    RETURNING id INTO v_workspace_id;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, v_user.id, 'owner');
  END LOOP;
END;
$ensure_personal_workspaces$;

-- The trigger will be recreated after the function body has been hardened below.

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Hide archived workspaces from all ordinary membership helper checks
-- ─────────────────────────────────────────────────────────────────────────────
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
      JOIN public.workspaces AS w ON w.id = m.workspace_id
     WHERE m.workspace_id = p_workspace_id
       AND m.user_id = public.current_user_id()
       AND w.archived_at IS NULL
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
      JOIN public.workspaces AS w ON w.id = m.workspace_id
     WHERE m.workspace_id = p_workspace_id
       AND m.user_id = public.current_user_id()
       AND m.role = 'owner'
       AND w.archived_at IS NULL
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
      JOIN public.workspaces AS w ON w.id = mine.workspace_id
     WHERE mine.user_id = public.current_user_id()
       AND theirs.user_id = p_user_id
       AND w.archived_at IS NULL
  )
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Last-owner and membership-identity guards
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_workspace_member_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_workspace_id uuid;
  v_other_owners bigint;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'workspace member identity is immutable; use invitation/acceptance for membership changes'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_workspace_id := NEW.workspace_id;
  ELSE
    v_workspace_id := OLD.workspace_id;
  END IF;

  -- Serialize owner demotion/removal against the workspace row. If the parent
  -- workspace itself is being deleted and its FK cascade reaches this trigger,
  -- allow the cascade; there is no surviving workspace to orphan.
  UPDATE public.workspaces w
     SET owner_guard_version = w.owner_guard_version + 1
   WHERE w.id = v_workspace_id;
  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE'
     OR (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role <> 'owner') THEN
    SELECT count(*)
      INTO v_other_owners
      FROM public.workspace_members m
     WHERE m.workspace_id = v_workspace_id
       AND m.role = 'owner'
       AND m.user_id <> OLD.user_id;

    IF v_other_owners = 0 THEN
      RAISE EXCEPTION 'cannot remove or demote the last workspace owner; promote another member first'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assert_workspace_has_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_workspace_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'workspaces' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    v_workspace_id := NEW.id;
  ELSE
    IF TG_OP = 'DELETE' THEN
      v_workspace_id := OLD.workspace_id;
    ELSE
      v_workspace_id := NEW.workspace_id;
    END IF;
  END IF;

  -- A deleted workspace has no surviving owner invariant to check.
  IF NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = v_workspace_id) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members m
     WHERE m.workspace_id = v_workspace_id
       AND m.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'every surviving workspace must have at least one owner'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS a05_workspace_member_change_guard ON public.workspace_members;
CREATE TRIGGER a05_workspace_member_change_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_workspace_member_change();

DROP TRIGGER IF EXISTS z95_workspace_owner_invariant_members ON public.workspace_members;
CREATE CONSTRAINT TRIGGER z95_workspace_owner_invariant_members
  AFTER INSERT OR UPDATE OR DELETE ON public.workspace_members
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_workspace_has_owner();

DROP TRIGGER IF EXISTS z95_workspace_owner_invariant_workspaces ON public.workspaces;
CREATE CONSTRAINT TRIGGER z95_workspace_owner_invariant_workspaces
  AFTER INSERT ON public.workspaces
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_workspace_has_owner();

-- The existing UPDATE policy requires the actor to remain an owner in its
-- WITH CHECK clause, so it cannot express an authorized self-demotion. This
-- narrowly scoped RPC checks owner status before the change; the row trigger
-- still rejects demotion/removal if the caller is the last owner.
CREATE OR REPLACE FUNCTION public.set_workspace_member_role(
  p_workspace_id uuid,
  p_user_id uuid,
  p_role public.workspace_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id uuid := public.current_user_id();
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_workspace_owner(p_workspace_id) THEN
    RAISE EXCEPTION 'only an active workspace owner may change member roles'
      USING ERRCODE = '42501';
  END IF;
  IF p_role IS NULL THEN
    RAISE EXCEPTION 'workspace role is required' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
    FROM public.workspace_members m
   WHERE m.workspace_id = p_workspace_id
     AND m.user_id = p_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'workspace member not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.workspace_members
     SET role = p_role
   WHERE workspace_id = p_workspace_id
     AND user_id = p_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION
  public.guard_workspace_member_change(),
  public.assert_workspace_has_owner()
FROM PUBLIC, anon, authenticated, app_user, service_role;

REVOKE ALL ON FUNCTION
  public.set_workspace_member_role(uuid, uuid, public.workspace_role)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.set_workspace_member_role(uuid, uuid, public.workspace_role)
TO app_user;

-- No application/admin service role may TRUNCATE away the protected membership
-- rows. A database owner can still perform emergency maintenance deliberately.
REVOKE TRUNCATE ON TABLE public.workspace_members
FROM PUBLIC, anon, authenticated, app_user, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Database-derived goal and global-role attribution
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.goals_owner_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_actor_id := public.current_user_id();
    IF v_actor_id IS NULL THEN
      RAISE EXCEPTION 'authenticated actor required to create a goal'
        USING ERRCODE = '28000';
    END IF;
    NEW.owner_id := v_actor_id;
    RETURN NEW;
  END IF;

  -- Goal ownership is historical attribution, not a client-editable assignment.
  -- A future ownership-transfer feature must be a separate audited SECURITY DEFINER
  -- function; ordinary UPDATE cannot rewrite the creator/owner field.
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
    RAISE EXCEPTION 'goal owner_id and workspace_id are immutable; client-supplied ownership or workspace changes are not accepted'
      USING ERRCODE = '42501';
  END IF;
  NEW.owner_id := OLD.owner_id;
  NEW.workspace_id := OLD.workspace_id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decisions_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id uuid;
  v_actor_role public.role;
BEGIN
  v_actor_id := public.current_user_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'authenticated actor required for decision writes'
      USING ERRCODE = '28000';
  END IF;

  SELECT u.role
    INTO v_actor_role
    FROM public.users u
   WHERE u.id = v_actor_id
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'authenticated actor has no public.users identity'
      USING ERRCODE = '28000';
  END IF;

  NEW.decided_by_user_id := v_actor_id;
  NEW.decided_by := v_actor_role;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.evidence_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id uuid;
  v_actor_role public.role;
BEGIN
  v_actor_id := public.current_user_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'authenticated actor required for evidence writes'
      USING ERRCODE = '28000';
  END IF;

  SELECT u.role
    INTO v_actor_role
    FROM public.users u
   WHERE u.id = v_actor_id
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'authenticated actor has no public.users identity'
      USING ERRCODE = '28000';
  END IF;

  NEW.recorded_by_user_id := v_actor_id;
  NEW.recorded_by := v_actor_role;
  RETURN NEW;
END;
$function$;

-- Install the goal trigger only after historical goal ownership has been mapped.
DROP TRIGGER IF EXISTS a10_goals_owner_attribution_trigger ON public.goals;
CREATE TRIGGER a10_goals_owner_attribution_trigger
  BEFORE INSERT OR UPDATE OF owner_id, workspace_id ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.goals_owner_attribution();

-- Decisions trigger derives both the role label and the internal user ID.
DROP TRIGGER IF EXISTS a10_decisions_attribution_trigger ON public.decisions;
CREATE TRIGGER a10_decisions_attribution_trigger
  BEFORE INSERT OR UPDATE ON public.decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.decisions_attribution();

-- Evidence actor trigger MUST sort before the hash-chain trigger. PostgreSQL fires
-- same-event BEFORE triggers alphabetically: a10_evidence_attribution_trigger
-- precedes z90_evidence_hash_chain_trigger. The existing 0008 hash function hashes
-- both recorded_by and recorded_by_user_id, so it now commits to DB-derived role
-- and identity. Legacy rows are not modified by this migration.
DROP TRIGGER IF EXISTS a10_evidence_attribution_trigger ON public.evidence;
CREATE TRIGGER a10_evidence_attribution_trigger
  BEFORE INSERT ON public.evidence
  FOR EACH ROW
  EXECUTE FUNCTION public.evidence_attribution();

REVOKE ALL ON FUNCTION
  public.goals_owner_attribution(),
  public.decisions_attribution(),
  public.evidence_attribution()
FROM PUBLIC, anon, authenticated, app_user, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Final structural/data invariants — any failure aborts the migration
-- ─────────────────────────────────────────────────────────────────────────────
DO $verify$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.goals g
    JOIN bridge_0009_old_workspaces old ON old.workspace_id = g.workspace_id
  ) THEN
    RAISE EXCEPTION 'one or more goals remain in a legacy workspace after the split';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.workspaces w
     WHERE NOT EXISTS (
       SELECT 1 FROM public.workspace_members m
        WHERE m.workspace_id = w.id AND m.role = 'owner'
     )
  ) THEN
    RAISE EXCEPTION 'workspace-owner invariant failed after 0009';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.users u
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.workspace_members m
         JOIN public.workspaces w ON w.id = m.workspace_id
        WHERE m.user_id = u.id AND w.archived_at IS NULL
     )
  ) THEN
    RAISE EXCEPTION 'one or more users have no active workspace after 0009';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM bridge_0009_evidence_snapshot s
      FULL JOIN public.evidence e ON e.id = s.id
     WHERE s.id IS NULL OR e.id IS NULL
        OR e.row_hash IS DISTINCT FROM s.row_hash
        OR e.prev_hash IS DISTINCT FROM s.prev_hash
        OR e.recorded_by IS DISTINCT FROM s.recorded_by
        OR e.recorded_by_user_id IS DISTINCT FROM s.recorded_by_user_id
        OR e.recorded_at IS DISTINCT FROM s.recorded_at
  ) THEN
    RAISE EXCEPTION 'evidence rows or hash-chain inputs changed during 0009 workspace relocation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'goals'
      AND t.tgname = 'a10_goals_owner_attribution_trigger' AND NOT t.tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'decisions'
      AND t.tgname = 'a10_decisions_attribution_trigger' AND NOT t.tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'evidence'
      AND t.tgname = 'a10_evidence_attribution_trigger' AND NOT t.tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'evidence'
      AND t.tgname = 'z90_evidence_hash_chain_trigger' AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'required 0009 attribution/hash triggers are missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'workspace_members'
      AND has_table_privilege('app_user', c.oid, 'TRUNCATE')
  ) THEN
    RAISE EXCEPTION 'app_user must not have TRUNCATE on workspace_members';
  END IF;
END;
$verify$;
