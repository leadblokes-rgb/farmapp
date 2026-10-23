-- Saved jobs, job alerts, and eligible specified-work postcodes.

-- ---------------------------------------------------------------------------
-- Specified-work postcodes (plant and animal cultivation only). Mirrors
-- packages/shared/src/config/specifiedWorkPostcodes.ts; a unit test keeps them in sync.
-- ---------------------------------------------------------------------------

create table public.specified_work_postcodes (
  category text not null,
  visa_subclass text not null check (visa_subclass in ('417', '462')),
  postcode_from integer not null,
  postcode_to integer not null,
  primary key (category, visa_subclass, postcode_from)
);
alter table public.specified_work_postcodes enable row level security;
create policy "specified_work_postcodes: public read" on public.specified_work_postcodes for select to anon, authenticated
  using (true);
grant select on public.specified_work_postcodes to anon, authenticated;

insert into public.specified_work_postcodes (category, visa_subclass, postcode_from, postcode_to) values
  ('plant_animal_cultivation', '417', 2311, 2312),
  ('plant_animal_cultivation', '417', 2328, 2411),
  ('plant_animal_cultivation', '417', 2420, 2490),
  ('plant_animal_cultivation', '417', 2536, 2551),
  ('plant_animal_cultivation', '417', 2575, 2594),
  ('plant_animal_cultivation', '417', 2618, 2739),
  ('plant_animal_cultivation', '417', 2787, 2898),
  ('plant_animal_cultivation', '417', 2899, 2899),
  ('plant_animal_cultivation', '417', 800, 899),
  ('plant_animal_cultivation', '417', 4124, 4125),
  ('plant_animal_cultivation', '417', 4133, 4133),
  ('plant_animal_cultivation', '417', 4211, 4211),
  ('plant_animal_cultivation', '417', 4270, 4272),
  ('plant_animal_cultivation', '417', 4275, 4275),
  ('plant_animal_cultivation', '417', 4280, 4280),
  ('plant_animal_cultivation', '417', 4285, 4285),
  ('plant_animal_cultivation', '417', 4287, 4287),
  ('plant_animal_cultivation', '417', 4307, 4499),
  ('plant_animal_cultivation', '417', 4510, 4510),
  ('plant_animal_cultivation', '417', 4512, 4512),
  ('plant_animal_cultivation', '417', 4515, 4519),
  ('plant_animal_cultivation', '417', 4522, 4899),
  ('plant_animal_cultivation', '417', 5000, 5999),
  ('plant_animal_cultivation', '417', 7000, 7999),
  ('plant_animal_cultivation', '417', 3139, 3139),
  ('plant_animal_cultivation', '417', 3211, 3334),
  ('plant_animal_cultivation', '417', 3340, 3424),
  ('plant_animal_cultivation', '417', 3430, 3649),
  ('plant_animal_cultivation', '417', 3658, 3749),
  ('plant_animal_cultivation', '417', 3753, 3753),
  ('plant_animal_cultivation', '417', 3756, 3756),
  ('plant_animal_cultivation', '417', 3758, 3758),
  ('plant_animal_cultivation', '417', 3762, 3762),
  ('plant_animal_cultivation', '417', 3764, 3764),
  ('plant_animal_cultivation', '417', 3778, 3781),
  ('plant_animal_cultivation', '417', 3783, 3783),
  ('plant_animal_cultivation', '417', 3797, 3797),
  ('plant_animal_cultivation', '417', 3799, 3799),
  ('plant_animal_cultivation', '417', 3810, 3909),
  ('plant_animal_cultivation', '417', 3921, 3925),
  ('plant_animal_cultivation', '417', 3945, 3974),
  ('plant_animal_cultivation', '417', 3979, 3979),
  ('plant_animal_cultivation', '417', 3981, 3996),
  ('plant_animal_cultivation', '417', 6041, 6044),
  ('plant_animal_cultivation', '417', 6055, 6056),
  ('plant_animal_cultivation', '417', 6069, 6069),
  ('plant_animal_cultivation', '417', 6076, 6076),
  ('plant_animal_cultivation', '417', 6083, 6084),
  ('plant_animal_cultivation', '417', 6111, 6111),
  ('plant_animal_cultivation', '417', 6121, 6126),
  ('plant_animal_cultivation', '417', 6200, 6799),
  ('plant_animal_cultivation', '462', 2311, 2312),
  ('plant_animal_cultivation', '462', 2328, 2411),
  ('plant_animal_cultivation', '462', 2420, 2490),
  ('plant_animal_cultivation', '462', 2536, 2551),
  ('plant_animal_cultivation', '462', 2575, 2594),
  ('plant_animal_cultivation', '462', 2618, 2739),
  ('plant_animal_cultivation', '462', 2787, 2898),
  ('plant_animal_cultivation', '462', 2899, 2899),
  ('plant_animal_cultivation', '462', 800, 899),
  ('plant_animal_cultivation', '462', 4124, 4125),
  ('plant_animal_cultivation', '462', 4133, 4133),
  ('plant_animal_cultivation', '462', 4211, 4211),
  ('plant_animal_cultivation', '462', 4270, 4272),
  ('plant_animal_cultivation', '462', 4275, 4275),
  ('plant_animal_cultivation', '462', 4280, 4280),
  ('plant_animal_cultivation', '462', 4285, 4285),
  ('plant_animal_cultivation', '462', 4287, 4287),
  ('plant_animal_cultivation', '462', 4307, 4499),
  ('plant_animal_cultivation', '462', 4510, 4510),
  ('plant_animal_cultivation', '462', 4512, 4512),
  ('plant_animal_cultivation', '462', 4515, 4519),
  ('plant_animal_cultivation', '462', 4522, 4899),
  ('plant_animal_cultivation', '462', 5000, 5999),
  ('plant_animal_cultivation', '462', 7000, 7999),
  ('plant_animal_cultivation', '462', 3139, 3139),
  ('plant_animal_cultivation', '462', 3211, 3334),
  ('plant_animal_cultivation', '462', 3340, 3424),
  ('plant_animal_cultivation', '462', 3430, 3649),
  ('plant_animal_cultivation', '462', 3658, 3749),
  ('plant_animal_cultivation', '462', 3753, 3753),
  ('plant_animal_cultivation', '462', 3756, 3756),
  ('plant_animal_cultivation', '462', 3758, 3758),
  ('plant_animal_cultivation', '462', 3762, 3762),
  ('plant_animal_cultivation', '462', 3764, 3764),
  ('plant_animal_cultivation', '462', 3778, 3781),
  ('plant_animal_cultivation', '462', 3783, 3783),
  ('plant_animal_cultivation', '462', 3797, 3797),
  ('plant_animal_cultivation', '462', 3799, 3799),
  ('plant_animal_cultivation', '462', 3810, 3909),
  ('plant_animal_cultivation', '462', 3921, 3925),
  ('plant_animal_cultivation', '462', 3945, 3974),
  ('plant_animal_cultivation', '462', 3979, 3979),
  ('plant_animal_cultivation', '462', 3981, 3996),
  ('plant_animal_cultivation', '462', 6041, 6044),
  ('plant_animal_cultivation', '462', 6055, 6056),
  ('plant_animal_cultivation', '462', 6069, 6069),
  ('plant_animal_cultivation', '462', 6076, 6076),
  ('plant_animal_cultivation', '462', 6083, 6084),
  ('plant_animal_cultivation', '462', 6111, 6111),
  ('plant_animal_cultivation', '462', 6121, 6126),
  ('plant_animal_cultivation', '462', 6200, 6799);

create function public.is_specified_work_postcode(p_postcode text, p_subclass text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_postcode ~ '^\d{4}$' and exists (
    select 1 from public.specified_work_postcodes s
    where s.category = 'plant_animal_cultivation' and s.visa_subclass = p_subclass
      and p_postcode::int between s.postcode_from and s.postcode_to
  );
$$;

-- ---------------------------------------------------------------------------
-- Saved jobs: kept out of the swipe feed until unsaved, applied for or skipped.
-- ---------------------------------------------------------------------------

create table public.saved_jobs (
  worker_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (worker_id, job_id)
);
alter table public.saved_jobs enable row level security;
create policy "saved_jobs: owner read" on public.saved_jobs for select to authenticated
  using (worker_id = auth.uid());
create policy "saved_jobs: owner insert" on public.saved_jobs for insert to authenticated
  with check (worker_id = auth.uid() and public.my_role() = 'worker' and public.is_active());
create policy "saved_jobs: owner delete" on public.saved_jobs for delete to authenticated
  using (worker_id = auth.uid());

-- Swiping a saved job (apply or skip) takes it off the saved list.
create function public.unsave_on_swipe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.saved_jobs where worker_id = new.worker_id and job_id = new.job_id;
  return new;
end;
$$;
create trigger swipes_unsave after insert or update on public.swipes
  for each row execute function public.unsave_on_swipe();

drop function public.job_feed(text[], date, date, integer, boolean, integer);
create function public.job_feed(
  p_region_ids text[] default null,
  p_from date default null,
  p_to date default null,
  p_min_hourly_cents integer default null,
  p_accommodation_only boolean default false,
  p_limit integer default 100,
  p_saved_only boolean default false
)
returns table (
  id uuid,
  farm_id uuid,
  farm_name text,
  farm_is_labour_hire boolean,
  title text,
  role_type public.job_role_type,
  description text,
  postcode text,
  locality text,
  region_name text,
  lat double precision,
  lng double precision,
  start_date date,
  end_date date,
  workers_needed integer,
  pay_type public.pay_type,
  pay_rate_cents integer,
  piece_rate_unit text,
  min_hourly_guarantee_cents integer,
  hours_per_week smallint,
  accommodation_provided boolean,
  accommodation_cost_week_cents integer,
  transport_provided boolean,
  car_required boolean,
  likely_specified_work boolean,
  farm_rating_avg numeric,
  farm_rating_count integer,
  farm_logo_path text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select j.id, j.farm_id, f.business_name, f.is_labour_hire, j.title, j.role_type, j.description,
         j.postcode, pc.locality, r.name, j.lat, j.lng, j.start_date, j.end_date, j.workers_needed,
         j.pay_type, j.pay_rate_cents, j.piece_rate_unit, j.min_hourly_guarantee_cents, j.hours_per_week,
         j.accommodation_provided, j.accommodation_cost_week_cents, j.transport_provided, j.car_required,
         j.likely_specified_work, f.rating_avg, f.rating_count, f.logo_path
  from public.jobs j
  join public.farms_public f on f.id = j.farm_id
  left join public.postcodes pc on pc.postcode = j.postcode
  left join public.regions r on r.id = j.region_id
  where j.status = 'open'
    and j.end_date >= current_date
    and not exists (select 1 from public.swipes s where s.job_id = j.id and s.worker_id = auth.uid())
    and exists (select 1 from public.saved_jobs sj where sj.job_id = j.id and sj.worker_id = auth.uid()) = p_saved_only
    and (p_saved_only or (
          (p_region_ids is null or cardinality(p_region_ids) = 0 or j.region_id = any (p_region_ids))
      and (p_from is null or j.end_date >= p_from)
      and (p_to is null or j.start_date <= p_to)
      and (p_min_hourly_cents is null
           or (case when j.pay_type = 'hourly' then j.pay_rate_cents else j.min_hourly_guarantee_cents end) >= p_min_hourly_cents)
      and (not p_accommodation_only or j.accommodation_provided)))
  order by j.start_date, j.id
  limit least(greatest(p_limit, 1), 200);
$$;
revoke execute on function public.job_feed(text[], date, date, integer, boolean, integer, boolean) from public, anon;
grant execute on function public.job_feed(text[], date, date, integer, boolean, integer, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Job alerts: one per worker. A new open job pushes to workers whose alert matches,
-- at most 3 alert pushes per worker per day.
-- ---------------------------------------------------------------------------

create table public.job_alerts (
  worker_id uuid primary key references public.profiles (id) on delete cascade,
  enabled boolean not null default true,
  region_ids text[] not null default '{}',
  min_hourly_cents integer check (min_hourly_cents is null or min_hourly_cents > 0),
  accommodation_only boolean not null default false,
  available_from date,
  available_to date,
  updated_at timestamptz not null default now(),
  check (available_to is null or available_from is null or available_to >= available_from)
);
alter table public.job_alerts enable row level security;
create policy "job_alerts: owner" on public.job_alerts for all to authenticated
  using (worker_id = auth.uid())
  with check (worker_id = auth.uid() and public.my_role() = 'worker' and public.is_active());
create trigger job_alerts_updated_at before update on public.job_alerts
  for each row execute function public.set_updated_at();

-- Workers to alert about a job: same filter rules as the feed, minus anyone who has already
-- swiped it or had 3 alerts in the last day. Service role only (called by send-push).
create function public.job_alert_recipients(p_job_id uuid)
returns table (worker_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select al.worker_id
  from public.job_alerts al
  join public.profiles p on p.id = al.worker_id and p.status = 'active' and p.role = 'worker'
  join public.jobs j on j.id = p_job_id
  where al.enabled
    and j.status = 'open' and j.end_date >= current_date
    and public.is_verified_farm(j.farm_id)
    and (cardinality(al.region_ids) = 0 or j.region_id = any (al.region_ids))
    and (al.min_hourly_cents is null
         or (case when j.pay_type = 'hourly' then j.pay_rate_cents else j.min_hourly_guarantee_cents end) >= al.min_hourly_cents)
    and (not al.accommodation_only or j.accommodation_provided)
    and (al.available_from is null or j.end_date >= al.available_from)
    and (al.available_to is null or j.start_date <= al.available_to)
    and not exists (select 1 from public.swipes s where s.job_id = j.id and s.worker_id = al.worker_id)
    and (select count(*) from public.notification_log n
         where n.event = 'job_alert' and n.recipient_id = al.worker_id and n.created_at > now() - interval '1 day') < 3;
$$;
revoke execute on function public.job_alert_recipients(uuid) from public, anon, authenticated;
grant execute on function public.job_alert_recipients(uuid) to service_role;

create function public.notify_job_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'open' and (tg_op = 'INSERT' or old.status is distinct from 'open') then
    perform public.notify('job_alert', jsonb_build_object('job_id', new.id));
  end if;
  return new;
end;
$$;
create trigger jobs_notify_alert after insert or update of status on public.jobs
  for each row execute function public.notify_job_alert();
