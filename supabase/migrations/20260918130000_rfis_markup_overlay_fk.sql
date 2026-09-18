-- Additive FK only. Does not create or replace public.rfis (PR #12 /
-- 20260918021000_rfis.sql already did) and does not touch billing_customers.
--
-- PR #12 left markup_id as uuid without an FK so Generate RFI could ship
-- before markup_overlays. After share-folder tables exist, attach the overlay
-- reference. Safe if the constraint is already present (old #9 draft).

do $$
begin
  if to_regclass('public.rfis') is null then
    raise exception 'public.rfis is missing; apply 20260918021000_rfis.sql first';
  end if;
  if to_regclass('public.markup_overlays') is null then
    raise exception 'public.markup_overlays is missing; apply 20260918020000_share_markup_rfi_trial.sql first';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rfis_markup_id_fkey'
      and conrelid = 'public.rfis'::regclass
  ) then
    alter table public.rfis
      add constraint rfis_markup_id_fkey
      foreign key (markup_id)
      references public.markup_overlays (id)
      on delete set null;
  end if;
end
$$;
