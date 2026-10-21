-- Milestone 3: job posting, swipe feed, applications.

create type public.job_role_type as enum ('picking', 'packing', 'pruning', 'planting', 'machinery', 'livestock', 'general');
create type public.pay_type as enum ('hourly', 'piece_rate');
create type public.job_status as enum ('open', 'filled', 'closed');
create type public.swipe_direction as enum ('like', 'pass');
create type public.application_status as enum ('applied', 'accepted', 'declined', 'withdrawn', 'completed');

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  role_type public.job_role_type not null,
  description text not null default '' check (char_length(description) <= 2000),
  postcode text not null check (postcode ~ '^\d{4}$'),
  -- Filled from public.postcodes by trigger; null if the postcode isn't in our reference data yet.
  lat double precision,
  lng double precision,
  region_id text references public.regions (id),
  start_date date not null,
  end_date date not null,
  workers_needed integer not null check (workers_needed between 1 and 500),
  pay_type public.pay_type not null,
  pay_rate_cents integer not null check (pay_rate_cents > 0),
  piece_rate_unit text check (char_length(piece_rate_unit) <= 40),
  min_hourly_guarantee_cents integer check (min_hourly_guarantee_cents > 0),
  hours_per_week smallint not null check (hours_per_week between 1 and 80),
  accommodation_provided boolean not null default false,
  accommodation_cost_week_cents integer check (accommodation_cost_week_cents >= 0),
  transport_provided boolean not null default false,
  car_required boolean not null default false,
  likely_specified_work boolean not null default false,
  status public.job_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  -- Horticulture Award: piece-rate workers must be guaranteed at least the minimum hourly rate,
  -- so piece-rate jobs must say what they guarantee (and what the rate is per).
  check (pay_type = 'hourly' or (min_hourly_guarantee_cents is not null and char_length(coalesce(piece_rate_unit, '')) >= 2))
);

create index jobs_feed_idx on public.jobs (status, end_date);
create index jobs_farm_idx on public.jobs (farm_id);

create trigger jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();

create function public.jobs_fill_location()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.postcode is distinct from old.postcode then
    select pc.lat, pc.lng, pc.region_id into new.lat, new.lng, new.region_id
    from public.postcodes pc where pc.postcode = new.postcode;
  end if;
  return new;
end;
$$;

create trigger jobs_fill_location before insert or update on public.jobs
  for each row execute function public.jobs_fill_location();

-- ---------------------------------------------------------------------------
-- Swipes and applications
-- ---------------------------------------------------------------------------

create table public.swipes (
  worker_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  direction public.swipe_direction not null,
  created_at timestamptz not null default now(),
  primary key (worker_id, job_id)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  worker_id uuid not null references public.profiles (id) on delete cascade,
  status public.application_status not null default 'applied',
  -- Written by the matching module (milestone 4).
  match_score numeric(5, 1),
  score_breakdown jsonb,
  ranker_version text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (job_id, worker_id)
);

create index applications_job_idx on public.applications (job_id, status);
create index applications_worker_idx on public.applications (worker_id);

-- ---------------------------------------------------------------------------
-- RLS helpers (SECURITY DEFINER so policies on jobs/applications don't recurse into each other
-- or into farms' owner-only policies).
-- ---------------------------------------------------------------------------

create function public.owns_farm(p_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.farms where id = p_farm_id and owner_id = auth.uid()) and public.is_active();
$$;

create function public.is_verified_farm(p_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.farms f
    join public.profiles p on p.id = f.owner_id
    where f.id = p_farm_id and f.verification_status = 'verified' and p.status = 'active'
  );
$$;

create function public.owns_job(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.jobs j join public.farms f on f.id = j.farm_id
    where j.id = p_job_id and f.owner_id = auth.uid()
  ) and public.is_active();
$$;

create function public.has_applied(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.applications where job_id = p_job_id and worker_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

alter table public.jobs enable row level security;
alter table public.swipes enable row level security;
alter table public.applications enable row level security;

-- Farm owners manage their own jobs; only VERIFIED farms can create them.
create policy "jobs: owner read" on public.jobs for select to authenticated
  using (public.owns_farm(farm_id));
create policy "jobs: verified owner insert" on public.jobs for insert to authenticated
  with check (public.owns_farm(farm_id) and public.is_verified_farm(farm_id));
create policy "jobs: owner update" on public.jobs for update to authenticated
  using (public.owns_farm(farm_id))
  with check (public.owns_farm(farm_id));

-- Workers see open, current jobs from verified farms, plus any job they've applied to.
create policy "jobs: workers read open" on public.jobs for select to authenticated
  using (
    public.my_role() = 'worker'
    and (
      (status = 'open' and end_date >= current_date and public.is_verified_farm(farm_id))
      or public.has_applied(id)
    )
  );
create policy "jobs: admin read" on public.jobs for select to authenticated
  using (public.is_admin());

-- Swipes and applications are written only through the RPCs below.
create policy "swipes: owner read" on public.swipes for select to authenticated
  using (worker_id = auth.uid());

create policy "applications: worker read own" on public.applications for select to authenticated
  using (worker_id = auth.uid() and public.is_active());
create policy "applications: farm reads own jobs" on public.applications for select to authenticated
  using (public.owns_job(job_id));
create policy "applications: admin read" on public.applications for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Swiping
-- ---------------------------------------------------------------------------

-- Right swipe ('like') applies; left swipe ('pass') skips. Returns the application id for likes.
create function public.swipe_job(p_job_id uuid, p_direction public.swipe_direction)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  app_id uuid;
begin
  if public.my_role() is distinct from 'worker' then
    raise exception 'Only workers can swipe on jobs' using errcode = '42501';
  end if;
  if not exists (select 1 from public.worker_profiles where user_id = uid) then
    raise exception 'Complete your profile before applying' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.jobs j
    where j.id = p_job_id and j.status = 'open' and j.end_date >= current_date and public.is_verified_farm(j.farm_id)
  ) then
    raise exception 'This job is no longer available' using errcode = 'P0002';
  end if;

  insert into public.swipes (worker_id, job_id, direction) values (uid, p_job_id, p_direction)
  on conflict (worker_id, job_id) do update set direction = excluded.direction, created_at = now();

  if p_direction = 'like' then
    insert into public.applications (job_id, worker_id) values (p_job_id, uid)
    on conflict (job_id, worker_id) do update set status = 'applied', created_at = now(), decided_at = null
      where public.applications.status = 'withdrawn'
    returning id into app_id;
    if app_id is null then
      select id into app_id from public.applications where job_id = p_job_id and worker_id = uid;
    end if;
  end if;
  return app_id;
end;
$$;

-- Undo a swipe (mis-taps happen outdoors). An application is withdrawn only if the farm hasn't decided yet.
create function public.undo_swipe(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if exists (
    select 1 from public.applications
    where job_id = p_job_id and worker_id = uid and status in ('accepted', 'declined', 'completed')
  ) then
    raise exception 'The farm has already responded to this application' using errcode = 'P0001';
  end if;
  delete from public.applications where job_id = p_job_id and worker_id = uid and status = 'applied';
  delete from public.swipes where job_id = p_job_id and worker_id = uid;
end;
$$;

-- Withdraw an application from the Applied list (keeps the swipe so the job stays out of the feed).
create function public.withdraw_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.applications set status = 'withdrawn', decided_at = now()
   where id = p_application_id and worker_id = auth.uid() and status = 'applied';
  if not found then
    raise exception 'Application not found or already decided' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.swipe_job(uuid, public.swipe_direction) from public, anon;
revoke execute on function public.undo_swipe(uuid) from public, anon;
revoke execute on function public.withdraw_application(uuid) from public, anon;
grant execute on function public.swipe_job(uuid, public.swipe_direction) to authenticated;
grant execute on function public.undo_swipe(uuid) to authenticated;
grant execute on function public.withdraw_application(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Feed: candidate jobs for the signed-in worker, filtered but NOT ranked.
-- Ranking happens in the matching module (packages/matching), not in SQL.
-- SECURITY INVOKER: the jobs RLS above decides what the worker may see.
-- ---------------------------------------------------------------------------

create function public.job_feed(
  p_region_ids text[] default null,
  p_from date default null,
  p_to date default null,
  p_min_hourly_cents integer default null,
  p_accommodation_only boolean default false,
  p_limit integer default 100
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
  likely_specified_work boolean
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
         j.likely_specified_work
  from public.jobs j
  join public.farms_public f on f.id = j.farm_id
  left join public.postcodes pc on pc.postcode = j.postcode
  left join public.regions r on r.id = j.region_id
  where j.status = 'open'
    and j.end_date >= current_date
    and not exists (select 1 from public.swipes s where s.job_id = j.id and s.worker_id = auth.uid())
    and (p_region_ids is null or cardinality(p_region_ids) = 0 or j.region_id = any (p_region_ids))
    and (p_from is null or j.end_date >= p_from)
    and (p_to is null or j.start_date <= p_to)
    and (p_min_hourly_cents is null
         or (case when j.pay_type = 'hourly' then j.pay_rate_cents else j.min_hourly_guarantee_cents end) >= p_min_hourly_cents)
    and (not p_accommodation_only or j.accommodation_provided)
  order by j.start_date, j.id
  limit least(greatest(p_limit, 1), 200);
$$;

-- The worker's applications with job and farm details, newest first.
create function public.my_applications()
returns table (
  application_id uuid,
  status public.application_status,
  applied_at timestamptz,
  job_id uuid,
  title text,
  farm_name text,
  locality text,
  start_date date,
  end_date date,
  job_status public.job_status
)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.id, a.status, a.created_at, j.id, j.title, f.business_name, pc.locality, j.start_date, j.end_date, j.status
  from public.applications a
  join public.jobs j on j.id = a.job_id
  left join public.farms_public f on f.id = j.farm_id
  left join public.postcodes pc on pc.postcode = j.postcode
  where a.worker_id = auth.uid()
  order by a.created_at desc;
$$;
