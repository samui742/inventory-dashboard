alter table public.equipment
  add column if not exists deploy_date date,
  add column if not exists calibration_required boolean not null default false;
