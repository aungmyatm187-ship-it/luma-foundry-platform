-- Migration 0001: Evidence hash chain and append-only enforcement.
-- Applied via Supabase SQL Editor on 2026-10-09.
--
-- Note: pgcrypto lives in the `extensions` schema on Supabase, not `public`.
-- The trigger function sets search_path = public, extensions and calls
-- extensions.digest() to be safe in both cases.

create or replace function public.evidence_hash_chain()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  last_hash text;
  payload text;
begin
  select row_hash into last_hash
  from public.evidence
  where product_id = new.product_id
  order by recorded_at desc
  limit 1;

  new.prev_hash := last_hash;

  payload :=
    coalesce(last_hash, '') || '|' ||
    new.product_id::text || '|' ||
    new.kind::text || '|' ||
    new.reference || '|' ||
    new.note || '|' ||
    new.recorded_by::text || '|' ||
    new.recorded_at::text;

  new.row_hash := encode(extensions.digest(payload, 'sha256'), 'hex');

  return new;
end;
$$;

create or replace function public.evidence_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'evidence is append-only; % is not permitted', tg_op
    using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists evidence_hash_chain_trigger on public.evidence;
create trigger evidence_hash_chain_trigger
  before insert on public.evidence
  for each row
  execute function public.evidence_hash_chain();

drop trigger if exists evidence_append_only_trigger on public.evidence;
create trigger evidence_append_only_trigger
  before update or delete on public.evidence
  for each row
  execute function public.evidence_append_only();
