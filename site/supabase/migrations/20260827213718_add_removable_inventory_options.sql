alter table public.inventory_options
  add column if not exists is_removed boolean not null default false;
