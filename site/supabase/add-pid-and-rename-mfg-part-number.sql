do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'equipment' and column_name = 'part_number'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'equipment' and column_name = 'mfg_part_number'
  ) then
    alter table public.equipment rename column part_number to mfg_part_number;
  end if;
end $$;

alter table public.equipment
  add column if not exists pid text not null default 'n/a';

update public.equipment
set pid = 'n/a'
where pid is null or btrim(pid) = '';
