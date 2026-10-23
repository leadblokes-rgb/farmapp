-- Farm page (logo, photos, website, accommodation details) and crew broadcast messages.

-- ---------------------------------------------------------------------------
-- Farm page. Images live in the public farm-logos bucket under the owner's folder.
-- ---------------------------------------------------------------------------

alter table public.farms
  add column website text check (website is null or (website ~* '^https?://[^\s]+$' and char_length(website) <= 200)),
  add column accommodation_details text not null default '' check (char_length(accommodation_details) <= 1000),
  add column photos text[] not null default '{}' check (cardinality(photos) <= 6);

create or replace view public.farms_public as
  select f.id, f.business_name, f.postcode, pc.locality, pc.region_id, f.description,
         f.logo_path, f.is_labour_hire, f.verification_status, f.verified_at,
         s.rating_avg, s.rating_count,
         f.website, f.accommodation_details, f.photos
  from public.farms f
  left join public.postcodes pc on pc.postcode = f.postcode
  left join lateral (
    select round(avg(r.overall), 1) as rating_avg, count(*)::int as rating_count
    from public.farm_ratings r
    where r.farm_id = f.id and r.hidden_at is null and public.ratings_revealed(r.application_id)
  ) s on true
  where f.verification_status = 'verified';

-- The job feed gains the farm's logo for the swipe card.
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

-- Open jobs on a farm's page, with whether the caller has already applied or skipped.
create function public.farm_open_jobs(p_farm_id uuid)
returns table (
  id uuid,
  title text,
  role_type public.job_role_type,
  locality text,
  start_date date,
  end_date date,
  pay_type public.pay_type,
  pay_rate_cents integer,
  piece_rate_unit text,
  min_hourly_guarantee_cents integer,
  hours_per_week smallint,
  accommodation_provided boolean,
  applied boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select j.id, j.title, j.role_type, pc.locality, j.start_date, j.end_date, j.pay_type, j.pay_rate_cents,
         j.piece_rate_unit, j.min_hourly_guarantee_cents, j.hours_per_week, j.accommodation_provided,
         exists (select 1 from public.applications a
                 where a.job_id = j.id and a.worker_id = auth.uid() and a.status <> 'withdrawn')
  from public.jobs j
  join public.farms_public f on f.id = j.farm_id
  left join public.postcodes pc on pc.postcode = j.postcode
  where j.farm_id = p_farm_id and j.status = 'open' and j.end_date >= current_date
  order by j.start_date;
$$;
revoke execute on function public.farm_open_jobs(uuid) from public, anon;
grant execute on function public.farm_open_jobs(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Crew broadcast: one message to everyone accepted (or everyone still under review) on a job.
-- Each recipient gets it in their own chat with the farm, so replies stay private.
-- ---------------------------------------------------------------------------

alter table public.messages add column broadcast_id uuid;
create index messages_broadcast_idx on public.messages (broadcast_id) where broadcast_id is not null;

create function public.broadcast_to_crew(p_job_id uuid, p_body text, p_audience text default 'accepted')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  bid uuid := gen_random_uuid();
  app record;
  conv uuid;
  sent integer := 0;
begin
  if not public.owns_job(p_job_id) then
    raise exception 'You can only message workers on your own jobs' using errcode = '42501';
  end if;
  if p_audience not in ('accepted', 'applied') then
    raise exception 'Send to accepted workers or applicants' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 2000 then
    raise exception 'Write a message (up to 2000 characters)' using errcode = '22023';
  end if;
  if (select count(distinct m.broadcast_id)
      from public.messages m join public.conversations c on c.id = m.conversation_id
      join public.applications a on a.id = c.application_id
      where a.job_id = p_job_id and m.broadcast_id is not null and m.created_at > now() - interval '1 day') >= 10 then
    raise exception 'You can send up to 10 crew messages per job per day' using errcode = '54000';
  end if;

  for app in
    select a.id from public.applications a
    where a.job_id = p_job_id
      and (case when p_audience = 'accepted' then a.status in ('accepted', 'completed') else a.status = 'applied' end)
  loop
    conv := public.start_conversation(app.id);
    insert into public.messages (conversation_id, sender_id, body, broadcast_id)
    values (conv, auth.uid(), trim(p_body), bid);
    sent := sent + 1;
  end loop;
  return sent;
end;
$$;
revoke execute on function public.broadcast_to_crew(uuid, text, text) from public, anon;
grant execute on function public.broadcast_to_crew(uuid, text, text) to authenticated;
