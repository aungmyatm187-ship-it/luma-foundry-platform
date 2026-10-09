-- Migration 0003: enforce the evidence-kind clearance gate in Postgres.
-- Apply as the owner of public.products/public.evidence or as a database admin.
-- The SECURITY DEFINER function reads evidence as its owner so RLS on evidence
-- cannot hide the rows needed for the invariant. All object references are
-- schema-qualified and the search path is empty to prevent object shadowing.

CREATE OR REPLACE FUNCTION public.enforce_product_clearance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  required_kinds text[] := ARRAY[
    'source_commit',
    'design_history',
    'asset_licence',
    'contributor_rights',
    'dependency_sbom',
    'third_party_notices',
    'counsel_review',
    'buyer_terms'
  ];
  missing_kinds text[];
BEGIN
  IF NEW.status = 'cleared' THEN
    SELECT ARRAY(
      SELECT unnest(required_kinds)
      EXCEPT
      SELECT DISTINCT evidence.kind::text
      FROM public.evidence AS evidence
      WHERE evidence.product_id = NEW.id
    )
    INTO missing_kinds;

    IF cardinality(missing_kinds) > 0 THEN
      RAISE EXCEPTION 'cannot set product % to cleared: missing evidence kinds: %',
        NEW.id,
        array_to_string(missing_kinds, ', ')
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_product_clearance_trigger ON public.products;
CREATE TRIGGER enforce_product_clearance_trigger
  BEFORE INSERT OR UPDATE OF status ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_product_clearance();

REVOKE EXECUTE ON FUNCTION public.enforce_product_clearance() FROM PUBLIC, anon, authenticated;
