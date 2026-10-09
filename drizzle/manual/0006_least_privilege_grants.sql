-- Migration 0006: explicit least-privilege table access.
-- apply as a database administrator after provisioning app_user as a LOGIN role.
-- app_user must be non-superuser, NOBYPASSRLS, and not own (or be a member of
-- the owner role for) any workspace table. This migration fails closed when
-- those deployment preconditions are not met.

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
  payload :=
    coalesce(last_hash, '') || '|' ||
    NEW.product_id::text || '|' ||
    NEW.kind::text || '|' ||
    NEW.reference || '|' ||
    NEW.note || '|' ||
    NEW.recorded_by::text || '|' ||
    NEW.recorded_at::text;
  NEW.row_hash := encode(extensions.digest(payload, 'sha256'), 'hex');
  RETURN NEW;
END;
$function$;

DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
    RAISE EXCEPTION 'app_user must be provisioned before applying migration 0006';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles AS role
    WHERE role.rolname = 'app_user'
      AND (NOT role.rolcanlogin OR role.rolsuper OR role.rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'app_user must be a LOGIN, non-superuser with BYPASSRLS disabled';
  END IF;

  IF pg_catalog.pg_has_role('app_user', 'service_role', 'USAGE') THEN
    RAISE EXCEPTION 'app_user must not inherit the privileged service_role';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid = relation.relowner
    WHERE namespace.nspname = 'public'
      AND relation.relname IN ('users', 'goals', 'products', 'work_items', 'handoffs', 'decisions', 'evidence')
      AND pg_catalog.pg_has_role('app_user', owner_role.rolname, 'USAGE')
  ) THEN
    RAISE EXCEPTION 'app_user must not own or inherit ownership of workspace tables';
  END IF;
END;
$migration$;

-- Client roles use the authenticated API, not direct workspace-table access.
-- Remove Supabase/default grants; RLS policies remain defense in depth.
REVOKE ALL ON TABLE
  public.users,
  public.goals,
  public.products,
  public.work_items,
  public.handoffs,
  public.decisions,
  public.evidence
FROM PUBLIC, anon, authenticated;

-- The API's request-scoped DrizzleRepository is the only ordinary CRUD path.
GRANT USAGE ON SCHEMA public, auth TO app_user;
GRANT EXECUTE ON FUNCTION auth.uid() TO app_user;
GRANT SELECT ON TABLE public.users TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.goals,
  public.products,
  public.work_items,
  public.handoffs,
  public.decisions,
  public.evidence
TO app_user;

-- Keep the privileged administrative role usable only with its server-only key.
GRANT ALL PRIVILEGES ON TABLE
  public.users,
  public.goals,
  public.products,
  public.work_items,
  public.handoffs,
  public.decisions,
  public.evidence
TO service_role;

-- New tables default to no Data API access. Each future table migration must
-- grant only the operations its intended server role requires.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
