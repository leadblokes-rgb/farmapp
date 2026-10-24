-- Jobs say whether they're casual, part-time or full-time. The Horticulture Award minimum differs:
-- casual includes the 25% loading (see packages/shared/src/config/payRules.ts). Existing jobs are casual.

create type public.employment_type as enum ('casual', 'part_time', 'full_time');
alter table public.jobs add column employment_type public.employment_type not null default 'casual';

drop function public.job_feed(text[], date, date, integer, boolean, integer, boolean);
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
  farm_logo_path text,
  viewer_visa_subclass text,
  specified_work_eligible boolean,
  specified_work_label text,
  employment_type public.employment_type
)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select (select wp.visa_type::text from public.worker_private wp
             where wp.user_id = auth.uid() and wp.visa_type in ('417', '462')) as subclass
  )
  select j.id, j.farm_id, f.business_name, f.is_labour_hire, j.title, j.role_type, j.description,
         j.postcode, pc.locality, r.name, j.lat, j.lng, j.start_date, j.end_date, j.workers_needed,
         j.pay_type, j.pay_rate_cents, j.piece_rate_unit, j.min_hourly_guarantee_cents, j.hours_per_week,
         j.accommodation_provided, j.accommodation_cost_week_cents, j.transport_provided, j.car_required,
         j.likely_specified_work, f.rating_avg, f.rating_count, f.logo_path,
         me.subclass,
         case me.subclass when '417' then j.eligible_417 when '462' then j.eligible_462 end,
         case when me.subclass is not null then public.specified_work_label(j.postcode, j.role_type, me.subclass) end,
         j.employment_type
  from public.jobs j
  cross join me
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

drop function public.farm_open_jobs(uuid);
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
  applied boolean,
  employment_type public.employment_type
)
language sql
stable
security invoker
set search_path = ''
as $$
  select j.id, j.title, j.role_type, pc.locality, j.start_date, j.end_date, j.pay_type, j.pay_rate_cents,
         j.piece_rate_unit, j.min_hourly_guarantee_cents, j.hours_per_week, j.accommodation_provided,
         exists (select 1 from public.applications a
                 where a.job_id = j.id and a.worker_id = auth.uid() and a.status <> 'withdrawn'),
         j.employment_type
  from public.jobs j
  join public.farms_public f on f.id = j.farm_id
  left join public.postcodes pc on pc.postcode = j.postcode
  where j.farm_id = p_farm_id and j.status = 'open' and j.end_date >= current_date
  order by j.start_date;
$$;
revoke execute on function public.farm_open_jobs(uuid) from public, anon;
grant execute on function public.farm_open_jobs(uuid) to authenticated;
