-- Job alerts: one daily digest by default, instant pushes only for great matches, and
-- per-person notification settings.
--
-- How a new job reaches a worker:
--   1. notify_job_alert (on a job opening) calls send-push with event 'job_alert'.
--   2. send-push asks job_alert_recipients() who matches, scores each match with the ranker,
--      and either pushes straight away (score >= JOB_ALERT_INSTANT_MIN_SCORE, the worker kept
--      "instant alerts for great matches" on, and fewer than 3 instant alerts today) or queues
--      the job in job_alert_queue.
--   3. Once a day send_job_alert_digest() asks send-push to send one summary per worker from
--      the queue (take_job_alert_digests()).

alter table public.job_alerts
  add column instant_top_matches boolean not null default true;

-- Recipients: same filters as before, plus the worker's availability dates from their profile
-- (if they've set any, the job must overlap one). The old 3-a-day cap is gone: everything that
-- isn't sent instantly waits for the digest, and send-push caps instant alerts itself.
create or replace function public.job_alert_recipients(p_job_id uuid)
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
    and (not exists (select 1 from public.worker_availability wa where wa.worker_id = al.worker_id)
         or exists (select 1 from public.worker_availability wa
                    where wa.worker_id = al.worker_id
                      and wa.start_date <= j.end_date and wa.end_date >= j.start_date))
    and not exists (select 1 from public.swipes s where s.job_id = j.id and s.worker_id = al.worker_id);
$$;
revoke execute on function public.job_alert_recipients(uuid) from public, anon, authenticated;
grant execute on function public.job_alert_recipients(uuid) to service_role;

-- Matching jobs waiting for the worker's daily digest. Only send-push (service role) uses it.
create table public.job_alert_queue (
  worker_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  score numeric not null default 0,
  created_at timestamptz not null default now(),
  primary key (worker_id, job_id)
);
alter table public.job_alert_queue enable row level security;
revoke all on public.job_alert_queue from anon, authenticated;

-- Empties the queue and returns one row per worker: how many jobs are still worth telling them
-- about (open, not swiped, alerts still on) and the best one. Service role only.
create function public.take_job_alert_digests()
returns table (worker_id uuid, job_count integer, top_job_title text, top_farm_name text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with taken as (
    -- "where true": PostgREST blocks unqualified deletes (pg_safeupdate).
    delete from public.job_alert_queue q where true returning q.worker_id, q.job_id, q.score
  ), live as (
    select t.worker_id, t.score, j.title, f.business_name, j.start_date
    from taken t
    join public.jobs j on j.id = t.job_id and j.status = 'open' and j.end_date >= current_date
    join public.farms f on f.id = j.farm_id
    join public.job_alerts al on al.worker_id = t.worker_id and al.enabled
    join public.profiles p on p.id = t.worker_id and p.status = 'active'
    where not exists (select 1 from public.swipes s where s.job_id = t.job_id and s.worker_id = t.worker_id)
  )
  select l.worker_id,
         count(*)::integer,
         (array_agg(l.title order by l.score desc, l.start_date))[1],
         (array_agg(l.business_name order by l.score desc, l.start_date))[1]
  from live l
  group by l.worker_id;
end;
$$;
revoke execute on function public.take_job_alert_digests() from public, anon, authenticated;
grant execute on function public.take_job_alert_digests() to service_role;

create function public.send_job_alert_digest()
returns void
language sql
security definer
set search_path = ''
as $$
  select public.notify('job_alert_digest', '{}'::jsonb);
$$;
revoke execute on function public.send_job_alert_digest() from public, anon, authenticated;

-- 08:00 UTC is 6pm in Queensland: after a day's new jobs, before people plan tomorrow.
do $$
begin
  perform cron.schedule('croppr-job-digest', '0 8 * * *', 'select public.send_job_alert_digest()');
exception when others then
  raise notice 'pg_cron not available (%); job alert digest not scheduled', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notification settings. No row = everything on. Job alerts have their own settings
-- (job_alerts above).
--   messages  - new chat messages
--   updates   - applications, decisions, no-shows, "did this work out?", ratings
--   reminders - day-one check-in reminders for farms
-- ---------------------------------------------------------------------------

create table public.notification_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  messages boolean not null default true,
  updates boolean not null default true,
  reminders boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_prefs enable row level security;
create policy "notification_prefs: owner" on public.notification_prefs for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create trigger notification_prefs_updated_at before update on public.notification_prefs
  for each row execute function public.set_updated_at();
