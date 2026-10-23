-- Bug fixes: day tracker validation (no future dates, plausible hours and pay periods) and public reference data.
-- Static limits are CHECKs; "not in the future" needs today's date, so it's a trigger.
-- One day of slack allows for the worker's timezone being ahead of the database (UTC).

alter table public.shift_logs drop constraint shift_logs_hours_check;
alter table public.shift_logs add constraint shift_logs_hours_check check (hours > 0 and hours <= 16) not valid;

-- NOT VALID: enforced for new and edited rows only, so existing test data can't block the migration.
alter table public.payslips
  add constraint payslips_period_length_check check (period_end - period_start + 1 <= 62) not valid,
  add constraint payslips_hours_check check (hours_total <= 16 * days_worked) not valid;

create function public.shift_logs_no_future()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.work_date > current_date + 1 then
    raise exception 'You can''t log a shift in the future' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function public.payslips_no_future()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.period_end > current_date + 1 then
    raise exception 'The pay period can''t end in the future' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger shift_logs_no_future before insert or update on public.shift_logs
  for each row execute function public.shift_logs_no_future();
create trigger payslips_no_future before insert or update on public.payslips
  for each row execute function public.payslips_no_future();

-- Regions and postcodes are public reference data. Let the app read them before sign-in too,
-- so a fresh or refreshing session never sees an empty list.
create policy "regions: public read" on public.regions for select to anon using (true);
create policy "postcodes: public read" on public.postcodes for select to anon using (true);
grant select on public.regions, public.postcodes to anon;
