-- Specified-work postcode lists now live only in the database (no copy in the app), with a version,
-- last-checked date and source for each list, like visaRules.ts. Updating a list doesn't need an
-- app release; see docs/admin-runbook.md ("Specified-work postcode lists").
--
-- Eligibility = postcode + job role type + the worker's visa subclass. Jobs and tracker employers
-- are tagged automatically, and re-tagged whenever a list changes.

-- ---------------------------------------------------------------------------
-- Lists and their postcode ranges
-- ---------------------------------------------------------------------------

create table public.specified_work_lists (
  id bigint generated always as identity primary key,
  category text not null,
  visa_subclass text not null check (visa_subclass in ('417', '462')),
  /** Shown to workers, e.g. "plant & animal cultivation". */
  label text not null,
  version text not null,
  last_checked date not null,
  source_url text not null,
  needs_expert_review boolean not null default true,
  is_current boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (category, visa_subclass, version)
);
-- Exactly one current list per category and visa subclass.
create unique index specified_work_lists_current_idx on public.specified_work_lists (category, visa_subclass)
  where is_current;

alter table public.specified_work_lists enable row level security;
create policy "specified_work_lists: public read" on public.specified_work_lists for select to anon, authenticated
  using (true);
grant select on public.specified_work_lists to anon, authenticated;

insert into public.specified_work_lists (category, visa_subclass, label, version, last_checked, source_url, is_current, notes)
select 'plant_animal_cultivation', s, 'plant & animal cultivation', '2026-10', date '2026-10-23',
       'https://www.legislation.gov.au/F2022L00271/latest/text', true,
       'Compiled from secondary sources (Home Affairs site unreachable at the time). Check against the instrument before launch.'
from unnest(array['417', '462']) as s;

-- The ranges move from (category, visa_subclass) to the list they belong to.
alter table public.specified_work_postcodes add column list_id bigint references public.specified_work_lists (id) on delete cascade;
update public.specified_work_postcodes p
   set list_id = l.id
  from public.specified_work_lists l
 where l.category = p.category and l.visa_subclass = p.visa_subclass and l.is_current;
alter table public.specified_work_postcodes
  alter column list_id set not null,
  drop constraint specified_work_postcodes_pkey,
  drop column category,
  drop column visa_subclass,
  add primary key (list_id, postcode_from),
  add check (postcode_to >= postcode_from);

-- Which job role types belong to which specified-work category.
create table public.specified_work_role_categories (
  role_type public.job_role_type not null,
  category text not null,
  primary key (role_type, category)
);
alter table public.specified_work_role_categories enable row level security;
create policy "specified_work_role_categories: public read" on public.specified_work_role_categories
  for select to anon, authenticated using (true);
grant select on public.specified_work_role_categories to anon, authenticated;
insert into public.specified_work_role_categories (role_type, category)
select r, 'plant_animal_cultivation' from unnest(enum_range(null::public.job_role_type)) as r;

-- ---------------------------------------------------------------------------
-- Lookups
-- ---------------------------------------------------------------------------

-- The label of the current list this postcode + role type is eligible under for a visa subclass,
-- or null if it isn't on any list.
create function public.specified_work_label(p_postcode text, p_role_type public.job_role_type, p_subclass text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select l.label
  from public.specified_work_lists l
  join public.specified_work_role_categories rc on rc.category = l.category and rc.role_type = p_role_type
  join public.specified_work_postcodes p on p.list_id = l.id
  where l.is_current and l.visa_subclass = p_subclass
    and p_postcode ~ '^\d{4}$' and p_postcode::int between p.postcode_from and p.postcode_to
  order by l.category
  limit 1;
$$;

-- Plant & animal cultivation check (kept for existing callers).
create or replace function public.is_specified_work_postcode(p_postcode text, p_subclass text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.specified_work_label(p_postcode, 'picking', p_subclass) is not null;
$$;

-- For the app's forms: eligibility of a postcode (and role type) for both subclasses, plus the
-- caller's own visa subclass and the list details for the disclaimer.
create function public.specified_work_check(p_postcode text, p_role_type public.job_role_type default 'picking')
returns table (
  eligible_417 boolean,
  eligible_462 boolean,
  my_visa_subclass text,
  label text,
  list_version text,
  last_checked date
)
language sql
stable
security definer
set search_path = ''
as $$
  select public.specified_work_label(p_postcode, p_role_type, '417') is not null,
         public.specified_work_label(p_postcode, p_role_type, '462') is not null,
         (select wp.visa_type::text from public.worker_private wp
           where wp.user_id = auth.uid() and wp.visa_type in ('417', '462')),
         coalesce(public.specified_work_label(p_postcode, p_role_type, '417'),
                  public.specified_work_label(p_postcode, p_role_type, '462')),
         (select max(l.version) from public.specified_work_lists l where l.is_current),
         (select min(l.last_checked) from public.specified_work_lists l where l.is_current);
$$;
revoke execute on function public.specified_work_check(text, public.job_role_type) from public, anon;
grant execute on function public.specified_work_check(text, public.job_role_type) to authenticated;

-- ---------------------------------------------------------------------------
-- Automatic tagging: jobs (per subclass) and tracker employers (for the worker's own visa)
-- ---------------------------------------------------------------------------

alter table public.jobs
  add column eligible_417 boolean not null default false,
  add column eligible_462 boolean not null default false;

create function public.jobs_tag_specified_work()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.eligible_417 := public.specified_work_label(new.postcode, new.role_type, '417') is not null;
  new.eligible_462 := public.specified_work_label(new.postcode, new.role_type, '462') is not null;
  return new;
end;
$$;
create trigger jobs_tag_specified_work before insert or update of postcode, role_type on public.jobs
  for each row execute function public.jobs_tag_specified_work();

-- Tracker employers: is this postcode eligible for the worker's visa? Null when it doesn't apply
-- (no postcode, or the worker isn't on a 417/462). Employers have no role type; the tracker is for
-- farm work, so plant & animal cultivation is assumed.
alter table public.employers_worked add column postcode_eligible boolean;

create function public.employer_postcode_eligible(p_worker_id uuid, p_postcode text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_postcode is null or wp.visa_type is null or wp.visa_type not in ('417', '462') then null
              else public.specified_work_label(p_postcode, 'picking', wp.visa_type::text) is not null end
  from (select 1) one
  left join public.worker_private wp on wp.user_id = p_worker_id;
$$;
revoke execute on function public.employer_postcode_eligible(uuid, text) from public, anon, authenticated;

create function public.employers_tag_specified_work()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.postcode_eligible := public.employer_postcode_eligible(new.worker_id, new.postcode);
  return new;
end;
$$;
create trigger employers_tag_specified_work before insert or update of postcode on public.employers_worked
  for each row execute function public.employers_tag_specified_work();

-- A worker who changes visa gets their employers re-checked.
create function public.worker_visa_retag_employers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.visa_type is distinct from old.visa_type then
    update public.employers_worked e
       set postcode_eligible = public.employer_postcode_eligible(e.worker_id, e.postcode)
     where e.worker_id = new.user_id;
  end if;
  return new;
end;
$$;
create trigger worker_private_retag_employers after update of visa_type on public.worker_private
  for each row execute function public.worker_visa_retag_employers();

-- Re-tag everything when a list or its postcodes change.
create function public.refresh_specified_work_tags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.jobs j
     set eligible_417 = public.specified_work_label(j.postcode, j.role_type, '417') is not null,
         eligible_462 = public.specified_work_label(j.postcode, j.role_type, '462') is not null;
  update public.employers_worked e
     set postcode_eligible = public.employer_postcode_eligible(e.worker_id, e.postcode);
  return null;
end;
$$;
create trigger specified_work_lists_refresh after insert or update or delete on public.specified_work_lists
  for each statement execute function public.refresh_specified_work_tags();
create trigger specified_work_postcodes_refresh after insert or update or delete on public.specified_work_postcodes
  for each statement execute function public.refresh_specified_work_tags();

-- Tag what already exists.
update public.jobs set eligible_417 = public.specified_work_label(postcode, role_type, '417') is not null,
                       eligible_462 = public.specified_work_label(postcode, role_type, '462') is not null;
update public.employers_worked set postcode_eligible = public.employer_postcode_eligible(worker_id, postcode);

-- Admin (dashboard only): make a newly loaded list version the current one.
create function public.admin_activate_specified_work_list(p_list_id bigint, p_note text default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  l public.specified_work_lists;
begin
  select * into l from public.specified_work_lists where id = p_list_id;
  if not found then
    raise exception 'List % not found', p_list_id;
  end if;
  update public.specified_work_lists set is_current = false
   where category = l.category and visa_subclass = l.visa_subclass and is_current and id <> p_list_id;
  update public.specified_work_lists set is_current = true where id = p_list_id;
  insert into public.admin_actions (action, note)
  values ('activate_specified_work_list:' || l.visa_subclass || ':' || l.version, p_note);
end;
$$;
revoke execute on function public.admin_activate_specified_work_list(bigint, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Job feed: eligibility for the viewing worker's own visa (null if they aren't on a 417/462).
-- ---------------------------------------------------------------------------

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
  specified_work_label text
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
         case when me.subclass is not null then public.specified_work_label(j.postcode, j.role_type, me.subclass) end
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
