create or replace function public.prevent_duplicate_equipment_serial()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  normalized_serial text;
begin
  normalized_serial := lower(regexp_replace(btrim(new.serial_number), '\\s+', ' ', 'g'));
  if normalized_serial = '' or normalized_serial in ('n/a', 'na', 'none') then
    return new;
  end if;

  if exists (
    select 1 from public.equipment
    where id is distinct from new.id
      and lower(regexp_replace(btrim(serial_number), '\\s+', ' ', 'g')) = normalized_serial
  ) then
    raise exception using
      errcode = '23505',
      message = 'An equipment record with this serial number already exists';
  end if;
  return new;
end;
$$;

drop trigger if exists equipment_unique_serial on public.equipment;
create trigger equipment_unique_serial
before insert or update of serial_number on public.equipment
for each row execute function public.prevent_duplicate_equipment_serial();
