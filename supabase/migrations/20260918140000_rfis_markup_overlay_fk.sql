-- If `public.rfis` was created by 20260918021000 without markup_overlays,
-- add the overlay FK now that markup_overlays exists (PR #9 shape).
-- No-op when 20260918020000 already created rfis with this constraint.

do $$
begin
  if to_regclass('public.markup_overlays') is null then
    raise exception 'markup_overlays must exist before rfis.markup_id FK';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rfis_markup_id_fkey'
      and conrelid = 'public.rfis'::regclass
  ) then
    alter table public.rfis
      add constraint rfis_markup_id_fkey
      foreign key (markup_id) references public.markup_overlays (id)
      on delete set null;
  end if;
end $$;
