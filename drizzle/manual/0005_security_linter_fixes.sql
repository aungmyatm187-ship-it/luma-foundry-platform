-- Migration 0005: Supabase Security Advisor fixes.
--
-- Applied via `supabase db query --linked` on 2026-10-09 from Ubuntu PRoot.
-- The Supabase CLI runs as postgres, unlike the SQL Editor which runs as anon.
--
-- Fixes:
--   * function_search_path_mutable on public.evidence_append_only
--   * anon/authenticated_security_definer_function_executable on
--     public.enforce_product_clearance and public.evidence_hash_chain
--
-- Not touched: handle_new_user and rls_auto_enable are Supabase-owned and
-- intentionally SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.evidence_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $func$
BEGIN
  RAISE EXCEPTION 'evidence is append-only; % is not permitted', tg_op
    USING errcode = 'restrict_violation';
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.enforce_product_clearance() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.evidence_hash_chain() FROM public, anon, authenticated;
