-- Trust loop: start-day check-in, automatic job completion, no-show disputes, blind two-way
-- ratings, and reporting reviews.

alter table public.applications add column completed_at timestamptz;

-- True if the caller owns the job this application is for.
create function public.owns_application_job(p_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.applications a
    join public.jobs j on j.id = a.job_id
    join public.farms f on f.id = j.farm_id
    where a.id = p_application_id and f.owner_id = auth.uid()
  ) and public.is_active();
$$;

-- ---------------------------------------------------------------------------
-- Attendance: the farm marks each accepted worker from the job's start date.
-- ---------------------------------------------------------------------------

create table public.attendance (
  application_id uuid primary key references public.applications (id) on delete cascade,
  status public.attendance_status not null,
  marked_at timestamptz not null default now(),
  -- A worker can dispute a no-show once; the Croppr team then upholds or overturns it.
  disputed_at timestamptz,
  dispute_report_id bigint,
  dispute_outcome text check (dispute_outcome in ('upheld', 'overturned')),
  resolved_at timestamptz
);

alter table public.attendance enable row level security;
create policy "attendance: worker reads own" on public.attendance for select to authenticated
  using (exists (select 1 from public.applications a where a.id = application_id and a.worker_id = auth.uid()));
create policy "attendance: farm reads own jobs" on public.attendance for select to authenticated
  using (public.owns_application_job(application_id));
create policy "attendance: admin read" on public.attendance for select to authenticated
  using (public.is_admin());
-- Written only through mark_attendance() and the dispute functions.

create function public.mark_attendance(p_application_ids uuid[], p_status public.attendance_status)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if exists (
    select 1 from unnest(p_application_ids) as ids(id)
    where not public.owns_application_job(ids.id)
  ) then
    raise exception 'You can only check in workers on your own jobs' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.applications a where a.id = any (p_application_ids) and a.status <> 'accepted'
  ) then
    raise exception 'Only accepted workers can be checked in' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.applications a join public.jobs j on j.id = a.job_id
    where a.id = any (p_application_ids) and j.start_date > current_date
  ) then
    raise exception 'You can check workers in from the job''s start date' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.attendance t
    where t.application_id = any (p_application_ids) and t.disputed_at is not null and t.resolved_at is null
  ) then
    raise exception 'The worker has disputed this no-show. The Croppr team will decide.' using errcode = '22023';
  end if;

  insert into public.attendance (application_id, status)
  select distinct id, p_status from unnest(p_application_ids) as ids(id)
  on conflict (application_id) do update
    set status = excluded.status, marked_at = now(),
        disputed_at = null, dispute_report_id = null, dispute_outcome = null, resolved_at = null
    where public.attendance.status is distinct from excluded.status;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke execute on function public.mark_attendance(uuid[], public.attendance_status) from public, anon;
grant execute on function public.mark_attendance(uuid[], public.attendance_status) to authenticated;
revoke execute on function public.owns_application_job(uuid) from public, anon;
grant execute on function public.owns_application_job(uuid) to authenticated;

-- A new no-show tells the worker straight away, so they can dispute it if it's wrong.
create function public.notify_attendance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'no_show' and (tg_op = 'INSERT' or old.status is distinct from 'no_show') then
    perform public.notify('no_show_marked', jsonb_build_object('application_id', new.application_id));
  end if;
  return new;
end;
$$;
create trigger attendance_notify after insert or update of status on public.attendance
  for each row execute function public.notify_attendance();

-- ---------------------------------------------------------------------------
-- Completion: once a job has ended, accepted workers marked "showed" (and not "left early")
-- become completed. No-shows, early leavers and unmarked workers stay accepted.
-- Runs daily (pg_cron, below) and whenever the app asks for pending reviews.
-- ---------------------------------------------------------------------------

create function public.complete_finished_jobs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.applications a
     set status = 'completed', completed_at = now()
    from public.jobs j, public.attendance t
   where j.id = a.job_id
     and t.application_id = a.id
     and a.status = 'accepted'
     and j.end_date < current_date
     and t.status = 'showed';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.complete_finished_jobs() from public, anon;
grant execute on function public.complete_finished_jobs() to authenticated;

create or replace function public.notify_application_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'applied' then
    perform public.notify('application_created', jsonb_build_object('application_id', new.id));
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('accepted', 'declined') then
    perform public.notify('application_decided', jsonb_build_object('application_id', new.id));
  elsif tg_op = 'UPDATE' and old.status = 'withdrawn' and new.status = 'applied' then
    perform public.notify('application_created', jsonb_build_object('application_id', new.id));
  elsif tg_op = 'UPDATE' and new.status = 'completed' and old.status is distinct from 'completed' then
    perform public.notify('application_completed', jsonb_build_object('application_id', new.id));
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ratings. Blind: neither side sees the other's rating for an application (and it isn't in any
-- average) until both have rated, or 14 days after the work finished. Ratings can't be edited.
-- Farm ratings are shown to every signed-in user; worker ratings only to farms the worker
-- applied to (and to the worker).
-- ---------------------------------------------------------------------------

create table public.farm_ratings (
  application_id uuid primary key references public.applications (id) on delete cascade,
  farm_id uuid not null references public.farms (id) on delete cascade,
  worker_id uuid not null references public.profiles (id) on delete cascade,
  overall smallint not null check (overall between 1 and 5),
  accommodation smallint check (accommodation between 1 and 5),
  would_work_again boolean not null,
  comment text not null default '' check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  -- Set by an admin after a review is reported and found inappropriate.
  hidden_at timestamptz
);
create index farm_ratings_farm_idx on public.farm_ratings (farm_id);

create table public.worker_ratings (
  application_id uuid primary key references public.applications (id) on delete cascade,
  worker_id uuid not null references public.profiles (id) on delete cascade,
  farm_id uuid not null references public.farms (id) on delete cascade,
  reliability smallint not null check (reliability between 1 and 5),
  quality smallint not null check (quality between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  hidden_at timestamptz
);
create index worker_ratings_worker_idx on public.worker_ratings (worker_id);

alter table public.farm_ratings enable row level security;
alter table public.worker_ratings enable row level security;
-- Each side can read only the ratings it wrote; everything else goes through the functions below,
-- which apply the blind-reveal rule.
create policy "farm_ratings: author reads own" on public.farm_ratings for select to authenticated
  using (worker_id = auth.uid());
create policy "worker_ratings: author reads own" on public.worker_ratings for select to authenticated
  using (public.owns_farm(farm_id));

create function public.ratings_revealed(p_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (exists (select 1 from public.farm_ratings where application_id = p_application_id)
          and exists (select 1 from public.worker_ratings where application_id = p_application_id))
      or coalesce((
           select coalesce(a.completed_at, (j.end_date + 1)::timestamptz) + interval '14 days' <= now()
           from public.applications a join public.jobs j on j.id = a.job_id
           where a.id = p_application_id), false);
$$;
-- Granted to signed-in users only because views that use it (farms_public) call it as the
-- viewer. It reveals nothing beyond yes/no.
revoke execute on function public.ratings_revealed(uuid) from public, anon;
grant execute on function public.ratings_revealed(uuid) to authenticated;

-- A worker can rate the farm once they've finished: completed, or left early from a job that's over.
create function public.can_rate_farm(p_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.applications a
    join public.jobs j on j.id = a.job_id
    left join public.attendance t on t.application_id = a.id
    where a.id = p_application_id and a.worker_id = auth.uid()
      and (a.status = 'completed'
           or (a.status = 'accepted' and j.end_date < current_date and t.status = 'left_early'))
  ) and public.is_active();
$$;

-- A farm can rate a worker it checked in as having turned up (including those who left early).
create function public.can_rate_worker(p_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.applications a
    join public.attendance t on t.application_id = a.id
    where a.id = p_application_id
      and a.status in ('accepted', 'completed')
      and t.status in ('showed', 'left_early')
  ) and public.owns_application_job(p_application_id);
$$;

create function public.rate_farm(
  p_application_id uuid,
  p_overall integer,
  p_would_work_again boolean,
  p_accommodation integer default null,
  p_comment text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_rate_farm(p_application_id) then
    raise exception 'You can rate a farm once you''ve finished working there' using errcode = '42501';
  end if;
  insert into public.farm_ratings (application_id, farm_id, worker_id, overall, accommodation, would_work_again, comment)
  select a.id, j.farm_id, a.worker_id, p_overall, p_accommodation, p_would_work_again, coalesce(trim(p_comment), '')
  from public.applications a join public.jobs j on j.id = a.job_id
  where a.id = p_application_id;
exception
  when unique_violation then
    raise exception 'You''ve already rated this job' using errcode = '23505';
end;
$$;

create function public.rate_worker(
  p_application_id uuid,
  p_reliability integer,
  p_quality integer,
  p_comment text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_rate_worker(p_application_id) then
    raise exception 'You can rate workers you checked in as turning up' using errcode = '42501';
  end if;
  insert into public.worker_ratings (application_id, worker_id, farm_id, reliability, quality, comment)
  select a.id, a.worker_id, j.farm_id, p_reliability, p_quality, coalesce(trim(p_comment), '')
  from public.applications a join public.jobs j on j.id = a.job_id
  where a.id = p_application_id;
exception
  when unique_violation then
    raise exception 'You''ve already rated this worker for this job' using errcode = '23505';
end;
$$;

revoke execute on function public.can_rate_farm(uuid) from public, anon;
revoke execute on function public.can_rate_worker(uuid) from public, anon;
revoke execute on function public.rate_farm(uuid, integer, boolean, integer, text) from public, anon;
revoke execute on function public.rate_worker(uuid, integer, integer, text) from public, anon;
grant execute on function public.can_rate_farm(uuid) to authenticated;
grant execute on function public.can_rate_worker(uuid) to authenticated;
grant execute on function public.rate_farm(uuid, integer, boolean, integer, text) to authenticated;
grant execute on function public.rate_worker(uuid, integer, integer, text) to authenticated;

-- Ratings still to give: workers rate farms; farms rate workers once the job has ended.
create function public.pending_reviews()
returns table (
  application_id uuid,
  kind text,
  job_id uuid,
  job_title text,
  subject_name text,
  end_date date
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, 'farm', j.id, j.title, f.business_name, j.end_date
  from public.applications a
  join public.jobs j on j.id = a.job_id
  join public.farms f on f.id = j.farm_id
  where a.worker_id = auth.uid()
    and public.can_rate_farm(a.id)
    and not exists (select 1 from public.farm_ratings r where r.application_id = a.id)
  union all
  select a.id, 'worker', j.id, j.title, wp.full_name, j.end_date
  from public.applications a
  join public.jobs j on j.id = a.job_id
  join public.farms f on f.id = j.farm_id
  join public.worker_profiles wp on wp.user_id = a.worker_id
  where f.owner_id = auth.uid()
    and j.end_date < current_date
    and public.can_rate_worker(a.id)
    and not exists (select 1 from public.worker_ratings r where r.application_id = a.id)
  order by 6 desc, 4, 5;
$$;
revoke execute on function public.pending_reviews() from public, anon;
grant execute on function public.pending_reviews() to authenticated;

-- Public farm reviews (first name of the reviewer only).
create function public.farm_reviews(p_farm_id uuid)
returns table (
  application_id uuid,
  overall smallint,
  accommodation smallint,
  would_work_again boolean,
  comment text,
  reviewer_name text,
  job_title text,
  rated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.application_id, r.overall, r.accommodation, r.would_work_again, r.comment,
         split_part(coalesce(wp.full_name, 'A worker'), ' ', 1), j.title, r.created_at
  from public.farm_ratings r
  join public.applications a on a.id = r.application_id
  join public.jobs j on j.id = a.job_id
  left join public.worker_profiles wp on wp.user_id = r.worker_id
  where r.farm_id = p_farm_id
    and r.hidden_at is null
    and public.ratings_revealed(r.application_id)
    and public.is_active()
  order by r.created_at desc
  limit 50;
$$;
revoke execute on function public.farm_reviews(uuid) from public, anon;
grant execute on function public.farm_reviews(uuid) to authenticated;

-- Reviews of a worker: for farms the worker applied to, and for the worker themself.
create function public.worker_reviews(p_worker_id uuid)
returns table (
  application_id uuid,
  reliability smallint,
  quality smallint,
  comment text,
  farm_name text,
  job_title text,
  rated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.application_id, r.reliability, r.quality, r.comment, f.business_name, j.title, r.created_at
  from public.worker_ratings r
  join public.applications a on a.id = r.application_id
  join public.jobs j on j.id = a.job_id
  join public.farms f on f.id = r.farm_id
  where r.worker_id = p_worker_id
    and r.hidden_at is null
    and public.ratings_revealed(r.application_id)
    and (public.is_my_applicant(p_worker_id) or (p_worker_id = auth.uid() and public.is_active()))
  order by r.created_at desc
  limit 50;
$$;
revoke execute on function public.worker_reviews(uuid) from public, anon;
grant execute on function public.worker_reviews(uuid) to authenticated;

-- Reputation used by the shortlist and the ranker. Only revealed, visible ratings count.
-- A no-show counts as a 1-star reliability rating, unless the worker has disputed it and the
-- Croppr team hasn't decided yet (overturned no-shows become "showed" and don't count).
create function public.worker_reputation(p_worker_ids uuid[])
returns table (
  worker_id uuid,
  reliability_avg numeric,
  quality_avg numeric,
  rating_count integer,
  no_show_count integer,
  reliability_score numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with r as (
    select wr.worker_id, wr.reliability, wr.quality
    from public.worker_ratings wr
    where wr.worker_id = any (p_worker_ids)
      and wr.hidden_at is null
      and public.ratings_revealed(wr.application_id)
  ), ns as (
    select a.worker_id, count(*)::int as n
    from public.attendance t
    join public.applications a on a.id = t.application_id
    where a.worker_id = any (p_worker_ids)
      and t.status = 'no_show'
      and (t.disputed_at is null or t.dispute_outcome = 'upheld')
    group by a.worker_id
  ), agg as (
    select w.id,
           avg(r.reliability) as rel, avg(r.quality) as qual,
           count(r.reliability)::int as cnt, coalesce(sum(r.reliability), 0) as rel_sum,
           coalesce(max(ns.n), 0) as no_shows
    from unnest(p_worker_ids) as w(id)
    left join r on r.worker_id = w.id
    left join ns on ns.worker_id = w.id
    group by w.id
  )
  select id, round(rel, 1), round(qual, 1), cnt, no_shows,
         case when cnt + no_shows = 0 then null
              else round((rel_sum + no_shows)::numeric / (cnt + no_shows), 2) end
  from agg;
$$;
revoke execute on function public.worker_reputation(uuid[]) from public, anon, authenticated;
grant execute on function public.worker_reputation(uuid[]) to service_role;

-- ---------------------------------------------------------------------------
-- Farm rating summary on farms_public (appended columns) and in the job feed.
-- ---------------------------------------------------------------------------

create or replace view public.farms_public as
  select f.id, f.business_name, f.postcode, pc.locality, pc.region_id, f.description,
         f.logo_path, f.is_labour_hire, f.verification_status, f.verified_at,
         s.rating_avg, s.rating_count
  from public.farms f
  left join public.postcodes pc on pc.postcode = f.postcode
  left join lateral (
    select round(avg(r.overall), 1) as rating_avg, count(*)::int as rating_count
    from public.farm_ratings r
    where r.farm_id = f.id and r.hidden_at is null and public.ratings_revealed(r.application_id)
  ) s on true
  where f.verification_status = 'verified';

drop function public.job_feed(text[], date, date, integer, boolean, integer);
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
  likely_specified_work boolean,
  farm_rating_avg numeric,
  farm_rating_count integer
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
         j.likely_specified_work, f.rating_avg, f.rating_count
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
revoke execute on function public.job_feed(text[], date, date, integer, boolean, integer) from public, anon;
grant execute on function public.job_feed(text[], date, date, integer, boolean, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Shortlist and the worker's applications gain attendance and reputation.
-- ---------------------------------------------------------------------------

drop function public.job_shortlist(uuid);
create function public.job_shortlist(p_job_id uuid)
returns table (
  application_id uuid,
  worker_id uuid,
  status public.application_status,
  applied_at timestamptz,
  match_score numeric,
  score_breakdown jsonb,
  full_name text,
  photo_path text,
  locality text,
  has_car boolean,
  needs_accommodation boolean,
  travel_mode public.travel_mode,
  group_size smallint,
  group_id uuid,
  skills text[],
  years_experience smallint,
  experience_summary text,
  visa_type public.visa_type,
  visa_valid_through_job_end boolean,
  attendance public.attendance_status,
  attendance_disputed boolean,
  reliability_avg numeric,
  quality_avg numeric,
  rating_count integer,
  no_show_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.worker_id, a.status, a.created_at, a.match_score, a.score_breakdown,
         wp.full_name, wp.photo_path, pc.locality, wp.has_car, wp.needs_accommodation, wp.travel_mode,
         wp.group_size, wp.group_id, wp.skills, wp.years_experience, wp.experience_summary,
         priv.visa_type,
         priv.visa_type = 'citizen_pr' or coalesce(priv.visa_expiry >= j.end_date, false),
         t.status, t.disputed_at is not null and t.resolved_at is null,
         rep.reliability_avg, rep.quality_avg, coalesce(rep.rating_count, 0), coalesce(rep.no_show_count, 0)
  from public.applications a
  join public.jobs j on j.id = a.job_id
  join public.worker_profiles wp on wp.user_id = a.worker_id
  left join public.worker_private priv on priv.user_id = a.worker_id
  left join public.postcodes pc on pc.postcode = wp.current_postcode
  left join public.attendance t on t.application_id = a.id
  left join public.worker_reputation(array[a.worker_id]) rep on true
  where a.job_id = p_job_id
    and a.status <> 'withdrawn'
    and public.owns_job(p_job_id)
  order by a.match_score desc nulls last, a.created_at;
$$;
revoke execute on function public.job_shortlist(uuid) from public, anon;
grant execute on function public.job_shortlist(uuid) to authenticated;

drop function public.my_applications();
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
  job_status public.job_status,
  farm_id uuid,
  attendance public.attendance_status,
  disputed boolean,
  dispute_outcome text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.id, a.status, a.created_at, j.id, j.title, f.business_name, pc.locality, j.start_date, j.end_date,
         j.status, j.farm_id, t.status, t.disputed_at is not null, t.dispute_outcome
  from public.applications a
  join public.jobs j on j.id = a.job_id
  left join public.farms_public f on f.id = j.farm_id
  left join public.postcodes pc on pc.postcode = j.postcode
  left join public.attendance t on t.application_id = a.id
  where a.worker_id = auth.uid()
  order by a.created_at desc;
$$;
revoke execute on function public.my_applications() from public, anon;
grant execute on function public.my_applications() to authenticated;

-- ---------------------------------------------------------------------------
-- No-show disputes and review reports feed the existing reports queue.
-- ---------------------------------------------------------------------------

alter table public.reports
  add column review_application_id uuid references public.applications (id) on delete set null,
  add column review_kind text check (review_kind in ('farm', 'worker'));
alter table public.attendance
  add constraint attendance_dispute_report_fk foreign key (dispute_report_id) references public.reports (id) on delete set null;

create function public.dispute_no_show(p_application_id uuid, p_details text default '')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  app record;
  rid bigint;
begin
  select a.worker_id, a.job_id, t.status, t.disputed_at into app
  from public.applications a
  join public.attendance t on t.application_id = a.id
  where a.id = p_application_id;
  if not found or app.worker_id is distinct from auth.uid() or not public.is_active() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if app.status <> 'no_show' then
    raise exception 'Only a no-show can be disputed' using errcode = '22023';
  end if;
  if app.disputed_at is not null then
    raise exception 'You''ve already disputed this' using errcode = '23505';
  end if;

  insert into public.reports (reporter_id, target_user_id, target_job_id, conversation_id, reason, details)
  values (auth.uid(), public.job_owner(app.job_id), app.job_id,
          (select c.id from public.conversations c where c.application_id = p_application_id),
          'no_show_dispute', coalesce(p_details, ''))
  returning id into rid;
  update public.attendance set disputed_at = now(), dispute_report_id = rid
   where application_id = p_application_id;
  return rid;
end;
$$;
revoke execute on function public.dispute_no_show(uuid, text) from public, anon;
grant execute on function public.dispute_no_show(uuid, text) to authenticated;

-- Report a review you can see: farm reviews (anyone signed in), or worker reviews (the farm that
-- can see them, or the worker). The target is the review's author.
create function public.report_review(p_kind text, p_application_id uuid, p_details text default '')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  author uuid;
  job uuid;
  rid bigint;
begin
  if not public.is_active() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_kind = 'farm' then
    select r.worker_id, a.job_id into author, job
    from public.farm_ratings r join public.applications a on a.id = r.application_id
    where r.application_id = p_application_id and r.hidden_at is null and public.ratings_revealed(r.application_id);
  elsif p_kind = 'worker' then
    select f.owner_id, a.job_id into author, job
    from public.worker_ratings r
    join public.applications a on a.id = r.application_id
    join public.farms f on f.id = r.farm_id
    where r.application_id = p_application_id and r.hidden_at is null and public.ratings_revealed(r.application_id)
      and (public.is_my_applicant(r.worker_id) or r.worker_id = auth.uid());
  else
    raise exception 'Unknown review type' using errcode = '22023';
  end if;
  if author is null then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;

  insert into public.reports (reporter_id, target_user_id, target_job_id, reason, details, review_application_id, review_kind)
  values (auth.uid(), author, job, 'inappropriate_review', coalesce(p_details, ''), p_application_id, p_kind)
  returning id into rid;
  return rid;
end;
$$;
revoke execute on function public.report_review(text, uuid, text) from public, anon;
grant execute on function public.report_review(text, uuid, text) to authenticated;

-- Admin queue: also show the review text for review reports.
create or replace view public.admin_open_reports as
  select r.id as report_id, r.created_at, r.reason, r.details,
         ru.email as reporter_email, rp.role as reporter_role,
         r.target_user_id, tu.email as target_email, tp.role as target_role, tp.status as target_status,
         r.target_job_id, j.title as job_title, f.business_name as farm_name,
         r.conversation_id,
         (select count(*) from public.reports r2 where r2.target_user_id = r.target_user_id) as reports_against_target,
         r.review_kind, r.review_application_id,
         coalesce(fr.comment, wr.comment) as review_comment
  from public.reports r
  join auth.users ru on ru.id = r.reporter_id
  join public.profiles rp on rp.id = r.reporter_id
  left join auth.users tu on tu.id = r.target_user_id
  left join public.profiles tp on tp.id = r.target_user_id
  left join public.jobs j on j.id = r.target_job_id
  left join public.farms f on f.id = j.farm_id
  left join public.farm_ratings fr on r.review_kind = 'farm' and fr.application_id = r.review_application_id
  left join public.worker_ratings wr on r.review_kind = 'worker' and wr.application_id = r.review_application_id
  where r.status = 'open'
  order by r.created_at;
revoke all on public.admin_open_reports from public, anon, authenticated;

-- Dashboard-only admin actions (execute revoked from app users, like the other admin_* functions).
create function public.admin_resolve_no_show_dispute(p_report_id bigint, p_outcome text, p_note text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_outcome not in ('upheld', 'overturned') then
    raise exception 'Outcome must be upheld (the no-show stands) or overturned (the worker did turn up)';
  end if;
  update public.attendance
     set dispute_outcome = p_outcome,
         resolved_at = now(),
         status = case when p_outcome = 'overturned' then 'showed'::public.attendance_status else status end
   where dispute_report_id = p_report_id and resolved_at is null;
  if not found then
    raise exception 'No open no-show dispute for report %', p_report_id;
  end if;
  perform public.admin_resolve_report(
    p_report_id,
    case when p_outcome = 'overturned' then 'actioned' else 'dismissed' end::public.report_status,
    p_outcome || ': ' || coalesce(p_note, ''));
  -- An overturned no-show on a finished job now completes.
  perform public.complete_finished_jobs();
end;
$$;
revoke execute on function public.admin_resolve_no_show_dispute(bigint, text, text) from public, anon, authenticated;

create function public.admin_hide_review(p_kind text, p_application_id uuid, p_note text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  author uuid;
begin
  if p_kind = 'farm' then
    update public.farm_ratings set hidden_at = now() where application_id = p_application_id returning worker_id into author;
  elsif p_kind = 'worker' then
    update public.worker_ratings set hidden_at = now() where application_id = p_application_id returning worker_id into author;
  else
    raise exception 'Kind must be farm or worker';
  end if;
  if not found then
    raise exception 'Review not found';
  end if;
  insert into public.admin_actions (action, target_user_id, note)
  values ('hide_review:' || p_kind || ':' || p_application_id, author, p_note);
end;
$$;
revoke execute on function public.admin_hide_review(text, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Daily jobs: complete finished jobs and remind farms to check in their crew on day one.
-- ---------------------------------------------------------------------------

create function public.run_daily_jobs()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  j record;
begin
  perform public.complete_finished_jobs();
  for j in
    select distinct jb.id from public.jobs jb
    join public.applications a on a.job_id = jb.id and a.status = 'accepted'
    where jb.start_date = (now() at time zone 'Australia/Brisbane')::date
  loop
    perform public.notify('check_in_reminder', jsonb_build_object('job_id', j.id));
  end loop;
end;
$$;
revoke execute on function public.run_daily_jobs() from public, anon, authenticated;

-- 19:30 UTC is 5:30am in Queensland. pg_cron may be unavailable in some environments; the app
-- also completes jobs on demand, so this is best-effort.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('croppr-daily', '30 19 * * *', 'select public.run_daily_jobs()');
exception when others then
  raise notice 'pg_cron not available (%); daily jobs not scheduled', sqlerrm;
end;
$$;

-- Day tracker suggestions: one per farm (workers now have finished jobs too), skipping farms
-- already in the tracker.
create or replace function public.employer_suggestions()
returns table (farm_id uuid, job_id uuid, business_name text, postcode text, likely_specified_work boolean, job_title text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (f.id) f.id, j.id, f.business_name, j.postcode, j.likely_specified_work, j.title
  from public.applications a
  join public.jobs j on j.id = a.job_id
  join public.farms f on f.id = j.farm_id
  where a.worker_id = auth.uid() and a.status in ('accepted', 'completed')
    and not exists (
      select 1 from public.employers_worked e
      where e.worker_id = auth.uid() and (e.job_id = j.id or e.farm_id = f.id)
    )
  order by f.id, j.start_date desc;
$$;
