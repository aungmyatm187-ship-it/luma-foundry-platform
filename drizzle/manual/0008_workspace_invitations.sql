-- Migration 0008: consent-based workspace invitations + database-derived attribution.
--
-- Apply as the same database administrator that applied 0007, as ONE transaction
-- (Drizzle's migrator and the Supabase SQL editor both do this).
-- Requires PostgreSQL 12+.
--
--   1. Creates workspace_invitations (7-day expiry, single-use, revoke-and-replace).
--   2. Adds decided_by_user_id / recorded_by_user_id attribution columns.
--   3. Closes direct membership writes: drops the workspace_members INSERT policy
--      and revokes the INSERT grant. Membership rows are henceforth created only
--      by accept_invitation().
--   4. Installs four SECURITY DEFINER functions as the single authority for the
--      invitation lifecycle, mapped by the API to tRPC errors:
--        28000 not authenticated              -> UNAUTHORIZED
--        42501 insufficient privilege / RLS   -> FORBIDDEN
--        P0002 no_data_found                  -> NOT_FOUND
--        P0001 / 22023 rule rejections        -> BAD_REQUEST
--   5. Installs a10_ attribution triggers that derive the acting user from
--      auth.uid() on every decisions write and every evidence INSERT. They are
--      named a10_* so they fire BEFORE the hash-chain trigger, which 0008 renames
--      to z90_*; the row hash therefore commits to the database-derived actor.
--
-- Assumptions:
--   * Migrations 0001-0007 are applied.
--   * The 0001/0006 hash payload is preserved bit-for-bit for rows whose
--     recorded_by_user_id is NULL (every row written before 0008). Historical
--     rows verify forever; only newly attributed rows use the extended payload.
--   * Historical attribution stays NULL: pre-0008 rows are never backfilled
--     with guessed identities.

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
  IF to_regclass('public.workspace_members') IS NULL THEN
    RAISE EXCEPTION 'workspace_members must exist (see migration 0007)';
  END IF;
END;
$precheck$;

-- ───────────────────────────────────────────────────────────────
-- 1. Invitations table
-- ───────────────────────────────────────────────────────────────
CREATE TABLE public.workspace_invitations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  invitee_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  invited_by     uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  invited_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  accepted_at    timestamptz,
  accepted_by    uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  revoked_at     timestamptz,
  CONSTRAINT workspace_invitations_expiry_check
    CHECK (expires_at > invited_at),
  CONSTRAINT workspace_invitations_accept_pair_check
    CHECK ((accepted_at IS NULL) = (accepted_by IS NULL)),
  CONSTRAINT workspace_invitations_revoked_not_accepted_check
    CHECK (NOT (revoked_at IS NOT NULL AND accepted_at IS NOT NULL))
);

CREATE INDEX workspace_invitations_invitee_pending_idx
  ON public.workspace_invitations (invitee_user_id, expires_at)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE INDEX workspace_invitations_workspace_pending_idx
  ON public.workspace_invitations (workspace_id, expires_at)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

-- ───────────────────────────────────────────────────────────────
-- 2. Attribution columns (nullable; pre-0008 rows keep historical NULL)
-- ───────────────────────────────────────────────────────────────
ALTER TABLE public.decisions
  ADD COLUMN decided_by_user_id uuid,
  ADD CONSTRAINT decisions_decided_by_user_id_fk
    FOREIGN KEY (decided_by_user_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.evidence
  ADD COLUMN recorded_by_user_id uuid,
  ADD CONSTRAINT evidence_recorded_by_user_id_fk
    FOREIGN KEY (recorded_by_user_id) REFERENCES public.users (id) ON DELETE RESTRICT;

-- ───────────────────────────────────────────────────────────────
-- 3. Close direct membership writes; open invitation reads
-- ───────────────────────────────────────────────────────────────
-- The owner INSERT policy was 0007's sanctioned provisioning path. From 0008
-- membership is consent-based: only accept_invitation() writes rows here, so
-- the policy (and the grant below) is removed rather than tightened.
DROP POLICY IF EXISTS workspace_members_insert_owners ON public.workspace_members;

-- Invitation parties read their rows directly; every write goes through the
-- SECURITY DEFINER functions, so there are deliberately no INSERT/UPDATE/DELETE
-- policies on this table.
CREATE POLICY workspace_invitations_select_parties ON public.workspace_invitations
  AS PERMISSIVE FOR SELECT TO public
  USING (
    invitee_user_id = public.current_user_id()
    OR public.is_workspace_owner(workspace_id)
  );

-- ───────────────────────────────────────────────────────────────
-- 4. Invitation lifecycle (SECURITY DEFINER, the single authority)
-- ───────────────────────────────────────────────────────────────
-- search_path is pinned and every reference is schema-qualified, mirroring the
-- 0007 helper functions.

-- Owners invite. Expiry is database policy (7 days), never a client argument;
-- a live invitation for the same invitee is revoked-and-replaced so at most one
-- actionable invitation per (workspace, invitee) exists at any time.
CREATE OR REPLACE FUNCTION public.create_invitation(p_workspace_id uuid, p_invitee_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid := public.current_user_id();
  v_invitation_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_workspace_owner(p_workspace_id) THEN
    RAISE EXCEPTION 'only workspace owners may invite' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users AS u WHERE u.id = p_invitee_user_id) THEN
    RAISE EXCEPTION 'invitee user not found' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.workspace_members AS m
     WHERE m.workspace_id = p_workspace_id AND m.user_id = p_invitee_user_id
  ) THEN
    RAISE EXCEPTION 'user is already a member of this workspace' USING ERRCODE = '22023';
  END IF;

  UPDATE public.workspace_invitations
     SET revoked_at = now()
   WHERE workspace_id = p_workspace_id
     AND invitee_user_id = p_invitee_user_id
     AND accepted_at IS NULL
     AND revoked_at IS NULL
     AND expires_at > now();

  INSERT INTO public.workspace_invitations
    (workspace_id, invitee_user_id, invited_by, invited_at, expires_at)
  VALUES
    (p_workspace_id, p_invitee_user_id, v_user, now(), now() + interval '7 days')
  RETURNING id INTO v_invitation_id;

  RETURN v_invitation_id;
END;
$function$;

-- Invitees accept. Single-use and race-safe: the row is locked FOR UPDATE and
-- re-checked inside the transaction, so two concurrent accepts cannot both
-- succeed. The workspace_members row is inserted here and nowhere else.
CREATE OR REPLACE FUNCTION public.accept_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid := public.current_user_id();
  v_invitation public.workspace_invitations;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_invitation
    FROM public.workspace_invitations
   WHERE id = p_invitation_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_invitation.invitee_user_id <> v_user THEN
    RAISE EXCEPTION 'this invitation was issued to a different user' USING ERRCODE = 'P0001';
  END IF;
  IF v_invitation.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'invitation was revoked' USING ERRCODE = 'P0001';
  END IF;
  IF v_invitation.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'invitation was already accepted' USING ERRCODE = 'P0001';
  END IF;
  IF v_invitation.expires_at <= now() THEN
    RAISE EXCEPTION 'invitation expired' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.workspace_members AS m
     WHERE m.workspace_id = v_invitation.workspace_id AND m.user_id = v_user
  ) THEN
    RAISE EXCEPTION 'already a member of this workspace' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_invitation.workspace_id, v_user, 'member');

  UPDATE public.workspace_invitations
     SET accepted_at = now(),
         accepted_by = v_user
   WHERE id = p_invitation_id;
END;
$function$;

-- Owners revoke. Revoking is idempotent while the invitation is unaccepted;
-- an accepted invitation can no longer be revoked (the member must be removed
-- through the existing membership administration instead).
CREATE OR REPLACE FUNCTION public.revoke_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid := public.current_user_id();
  v_invitation public.workspace_invitations;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_invitation
    FROM public.workspace_invitations
   WHERE id = p_invitation_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.is_workspace_owner(v_invitation.workspace_id) THEN
    RAISE EXCEPTION 'only workspace owners may revoke invitations' USING ERRCODE = '42501';
  END IF;
  IF v_invitation.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'invitation was already accepted and cannot be revoked' USING ERRCODE = 'P0001';
  END IF;
  IF v_invitation.revoked_at IS NOT NULL THEN
    RETURN;
  END IF;

  UPDATE public.workspace_invitations
     SET revoked_at = now()
   WHERE id = p_invitation_id;
END;
$function$;

-- The caller's still-actionable invitations: not accepted, not revoked, and
-- not expired. SECURITY DEFINER with an explicit invitee filter (the definer
-- bypasses RLS, so the filter below is the security boundary, not a policy).
CREATE OR REPLACE FUNCTION public.list_my_invitations()
RETURNS TABLE (
  id              uuid,
  workspace_id    uuid,
  invitee_user_id uuid,
  invited_by      uuid,
  invited_at      timestamptz,
  expires_at      timestamptz,
  accepted_at     timestamptz,
  accepted_by     uuid,
  revoked_at      timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid := public.current_user_id();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
    SELECT wi.id,
           wi.workspace_id,
           wi.invitee_user_id,
           wi.invited_by,
           wi.invited_at,
           wi.expires_at,
           wi.accepted_at,
           wi.accepted_by,
           wi.revoked_at
      FROM public.workspace_invitations AS wi
     WHERE wi.invitee_user_id = v_user
       AND wi.accepted_at IS NULL
       AND wi.revoked_at IS NULL
       AND wi.expires_at > now();
END;
$function$;

REVOKE ALL ON FUNCTION
  public.create_invitation(uuid, uuid),
  public.accept_invitation(uuid),
  public.revoke_invitation(uuid),
  public.list_my_invitations()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.create_invitation(uuid, uuid),
  public.accept_invitation(uuid),
  public.revoke_invitation(uuid),
  public.list_my_invitations()
TO app_user, service_role;

-- ───────────────────────────────────────────────────────────────
-- 5. Attribution triggers (a10_ fires before the z90_ hash trigger)
-- ───────────────────────────────────────────────────────────────
-- The acting user is derived from the authenticated context on every write;
-- a client-supplied value is always overwritten. When there is no
-- authenticated user (e.g. administrative maintenance), the column stays NULL
-- and the hash payload keeps its pre-0008 shape (see migration 6 below).

CREATE OR REPLACE FUNCTION public.decisions_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  NEW.decided_by_user_id := public.current_user_id();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.evidence_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  NEW.recorded_by_user_id := public.current_user_id();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS a10_decisions_attribution_trigger ON public.decisions;
CREATE TRIGGER a10_decisions_attribution_trigger
  BEFORE INSERT OR UPDATE ON public.decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.decisions_attribution();

DROP TRIGGER IF EXISTS a10_evidence_attribution_trigger ON public.evidence;
CREATE TRIGGER a10_evidence_attribution_trigger
  BEFORE INSERT ON public.evidence
  FOR EACH ROW
  EXECUTE FUNCTION public.evidence_attribution();

-- Trigger functions are not meant to be callable through the API.
REVOKE ALL ON FUNCTION
  public.decisions_attribution(),
  public.evidence_attribution()
FROM PUBLIC, anon, authenticated;

-- ───────────────────────────────────────────────────────────────
-- 6. Hash payload: commit new rows to the database-derived actor
-- ───────────────────────────────────────────────────────────────
-- The a10_ trigger runs before this one (a10_ sorts before z90_), so
-- recorded_by_user_id below is the database-derived identity, never a
-- client-supplied value. Rows with NULL attribution (everything written
-- before 0008, and unauthenticated administrative writes) keep the exact
-- 0001/0006 payload, so historical chains verify forever. The branch is a
-- pure function of the row, which keeps verification self-describing.

CREATE OR REPLACE FUNCTION public.evidence_hash_chain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  last_hash text;
  payload text;
BEGIN
  SELECT evidence.row_hash
    INTO last_hash
    FROM public.evidence AS evidence
   WHERE evidence.product_id = NEW.product_id
   ORDER BY evidence.recorded_at DESC
   LIMIT 1;

  NEW.prev_hash := last_hash;

  IF NEW.recorded_by_user_id IS NULL THEN
    -- Pre-0008 payload (0001/0006), unchanged bit-for-bit.
    payload :=
      coalesce(last_hash, '') || '|' ||
      NEW.product_id::text || '|' ||
      NEW.kind::text || '|' ||
      NEW.reference || '|' ||
      NEW.note || '|' ||
      NEW.recorded_by::text || '|' ||
      NEW.recorded_at::text;
  ELSE
    -- Post-0008 payload: the database-derived actor joins the hash.
    payload :=
      coalesce(last_hash, '') || '|' ||
      NEW.product_id::text || '|' ||
      NEW.kind::text || '|' ||
      NEW.reference || '|' ||
      NEW.note || '|' ||
      NEW.recorded_by::text || '|' ||
      NEW.recorded_by_user_id::text || '|' ||
      NEW.recorded_at::text;
  END IF;

  NEW.row_hash := encode(extensions.digest(payload, 'sha256'), 'hex');
  RETURN NEW;
END;
$function$;

-- Make the documented ordering convention explicit: attribution (a10_) fires
-- before the hash chain (z90_). Same trigger definition, new name (DROP+CREATE
-- keeps this portable to PostgreSQL 12/13, which lack ALTER TRIGGER RENAME).
DROP TRIGGER IF EXISTS z90_evidence_hash_chain_trigger ON public.evidence;
DROP TRIGGER IF EXISTS evidence_hash_chain_trigger ON public.evidence;
CREATE TRIGGER z90_evidence_hash_chain_trigger
  BEFORE INSERT ON public.evidence
  FOR EACH ROW
  EXECUTE FUNCTION public.evidence_hash_chain();

-- ───────────────────────────────────────────────────────────────
-- 7. Least-privilege grants (same model as 0006/0007)
-- ───────────────────────────────────────────────────────────────
REVOKE ALL ON TABLE public.workspace_invitations
FROM PUBLIC, anon, authenticated;

-- Reads go through the SELECT policy; writes are function-only.
GRANT SELECT ON TABLE public.workspace_invitations TO app_user;
GRANT ALL PRIVILEGES ON TABLE public.workspace_invitations TO service_role;

-- 0008 closes direct membership writes: without this revoke the grant would
-- remain but always fail the RLS check; removing it makes the boundary the
-- grant system's job too, and the suite asserts both layers.
REVOKE INSERT ON TABLE public.workspace_members FROM app_user;

-- ───────────────────────────────────────────────────────────────
-- 8. Post-migration sanity checks (fail the whole migration if violated)
-- ───────────────────────────────────────────────────────────────
DO $verify$
BEGIN
  IF to_regclass('public.workspace_invitations') IS NULL THEN
    RAISE EXCEPTION 'workspace_invitations must exist after 0008';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger AS t
     JOIN pg_catalog.pg_class AS c ON c.oid = t.tgrelid
     JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'evidence'
      AND t.tgname = 'a10_evidence_attribution_trigger' AND NOT t.tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger AS t
     JOIN pg_catalog.pg_class AS c ON c.oid = t.tgrelid
     JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'evidence'
      AND t.tgname = 'z90_evidence_hash_chain_trigger' AND NOT t.tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger AS t
     JOIN pg_catalog.pg_class AS c ON c.oid = t.tgrelid
     JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'decisions'
      AND t.tgname = 'a10_decisions_attribution_trigger' AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'attribution/hash triggers must be installed (a10_ before z90_)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'workspace_members'
       AND policyname = 'workspace_members_insert_owners'
  ) THEN
    RAISE EXCEPTION 'workspace_members_insert_owners must be dropped by 0008';
  END IF;

  IF (
    SELECT count(*) FROM pg_catalog.pg_policies
     WHERE schemaname = 'public' AND tablename = 'workspace_invitations'
  ) <> 1 THEN
    RAISE EXCEPTION 'workspace_invitations must carry exactly one (SELECT) policy';
  END IF;
END;
$verify$;
