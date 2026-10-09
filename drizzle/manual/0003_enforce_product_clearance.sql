-- drizzle/manual/0003_enforce_product_clearance.sql
-- Enforce product clearance at the DB level: a product cannot be set to
-- status = 'cleared' unless every REQUIRED_EVIDENCE kind is present.

CREATE OR REPLACE FUNCTION public.enforce_product_clearance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.status = 'cleared' THEN
    SELECT ARRAY(
      SELECT unnest(required_kinds)
      EXCEPT
      SELECT DISTINCT kind::text FROM public.evidence WHERE product_id = NEW.id
    ) INTO missing_kinds;

    IF missing_kinds IS NOT NULL AND cardinality(missing_kinds) > 0 THEN
      RAISE EXCEPTION 'cannot set product % to cleared: missing evidence kinds: %',
        NEW.id,
        array_to_string(missing_kinds, ', ');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_product_clearance_trigger ON public.products;

CREATE TRIGGER enforce_product_clearance_trigger
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_product_clearance();
