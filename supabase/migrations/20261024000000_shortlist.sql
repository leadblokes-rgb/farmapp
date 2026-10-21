-- Milestone 4: groups, farm access to applicants, visa yes/no, shortlist and bulk decisions.

-- ---------------------------------------------------------------------------
-- Travel groups (a flag only: each member still applies individually).
-- ---------------------------------------------------------------------------

create table public.worker_groups (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  -- Short code a worker shares with friends so they can join.
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  created_at timestamptz not null default now()
);

alter table public.worker_profiles
  add column group_id uuid references public.worker_groups (id) on delete set null;
create index worker_profiles_group_idx on public.worker_profiles (group_id);

alter table public.worker_groups enable row level security;
-- Groups are only read through my_group(); no direct access.

create function public.create_group()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.worker_groups;
begin
  if public.my_role() is distinct from 'worker' then
    raise exception 'Only workers can create groups' using errcode = '42501';
  end if;
  insert into public.worker_groups (created_by) values (auth.uid()) returning * into g;
  update public.worker_profiles set group_id = g.id, travel_mode = 'group', group_size = greatest(group_size, 2)
   where user_id = auth.uid();
  if not found then
    raise exception 'Complete your profile first' using errcode = 'P0001';
  end if;
  return g.invite_code;
end;
$$;

create function public.join_group(p_invite_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid uuid;
begin
  if public.my_role() is distinct from 'worker' then
    raise exception 'Only workers can join groups' using errcode = '42501';
  end if;
  select id into gid from public.worker_groups where invite_code = upper(trim(p_invite_code));
  if gid is null then
    raise exception 'No group with that code' using errcode = 'P0002';
  end if;
  update public.worker_profiles set group_id = gid, travel_mode = 'group', group_size = greatest(group_size, 2)
   where user_id = auth.uid();
end;
$$;

create function public.leave_group()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.worker_profiles set group_id = null, travel_mode = 'solo', group_size = 1 where user_id = auth.uid();
$$;

-- The caller's group: invite code and member first names (nothing else is shared between members).
create function public.my_group()
returns table (invite_code text, member_id uuid, member_name text, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select g.invite_code, wp.user_id, split_part(wp.full_name, ' ', 1), wp.user_id = auth.uid()
  from public.worker_profiles me
  join public.worker_groups g on g.id = me.group_id
  join public.worker_profiles wp on wp.group_id = g.id
  where me.user_id = auth.uid()
  order by wp.user_id = auth.uid() desc, wp.full_name;
$$;

revoke execute on function public.create_group() from public, anon;
revoke execute on function public.join_group(text) from public, anon;
revoke execute on function public.leave_group() from public, anon;
revoke execute on function public.my_group() from public, anon;
grant execute on function public.create_group() to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.leave_group() to authenticated;
grant execute on function public.my_group() to authenticated;

-- ---------------------------------------------------------------------------
-- Farms may read the profile, availability and photo of workers who applied to their jobs.
-- Visa details and nationality stay private (see applicant_visa_summary below).
-- ---------------------------------------------------------------------------

create function public.is_my_applicant(p_worker_id uuid)
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
    where a.worker_id = p_worker_id and f.owner_id = auth.uid()
  ) and public.is_active();
$$;

create function public.is_my_applicant_folder(p_folder text)
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
    where a.worker_id::text = p_folder and f.owner_id = auth.uid()
  ) and public.is_active();
$$;

create policy "worker_profiles: farm reads applicants" on public.worker_profiles for select to authenticated
  using (public.is_my_applicant(user_id));
create policy "worker_availability: farm reads applicants" on public.worker_availability for select to authenticated
  using (public.is_my_applicant(worker_id));
create policy "avatars: farm reads applicants" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.is_my_applicant_folder((storage.foldername(name))[1]));

-- Yes/no visa check for one application. Farms never see the expiry date or nationality.
create function public.applicant_visa_summary(p_application_id uuid)
returns table (visa_type public.visa_type, visa_valid_through_job_end boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select wp.visa_type,
         wp.visa_type = 'citizen_pr' or coalesce(wp.visa_expiry >= j.end_date, false)
  from public.applications a
  join public.jobs j on j.id = a.job_id
  join public.worker_private wp on wp.user_id = a.worker_id
  where a.id = p_application_id and public.owns_job(a.job_id);
$$;

revoke execute on function public.applicant_visa_summary(uuid) from public, anon;
grant execute on function public.applicant_visa_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Shortlist: applicants for one of the caller's jobs, with everything the card needs.
-- Scores are written by the rank-applicants Edge Function (packages/matching);
-- this function only reads them, so ranking logic stays out of SQL.
-- ---------------------------------------------------------------------------

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
  visa_valid_through_job_end boolean
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
         priv.visa_type = 'citizen_pr' or coalesce(priv.visa_expiry >= j.end_date, false)
  from public.applications a
  join public.jobs j on j.id = a.job_id
  join public.worker_profiles wp on wp.user_id = a.worker_id
  left join public.worker_private priv on priv.user_id = a.worker_id
  left join public.postcodes pc on pc.postcode = wp.current_postcode
  where a.job_id = p_job_id
    and a.status <> 'withdrawn'
    and public.owns_job(p_job_id)
  order by a.match_score desc nulls last, a.created_at;
$$;

revoke execute on function public.job_shortlist(uuid) from public, anon;
grant execute on function public.job_shortlist(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Accept or decline one or many applications (farms hire 20–50 at a time).
-- Only 'applied' applications on the caller's own jobs change; returns how many changed.
-- An accepted worker can later be declined (e.g. they pulled out), not the other way round,
-- so a decline the worker has already seen is never silently reversed.
-- ---------------------------------------------------------------------------

create function public.decide_applications(p_application_ids uuid[], p_decision public.application_status)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if p_decision not in ('accepted', 'declined') then
    raise exception 'Decision must be accepted or declined' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.applications a
    where a.id = any (p_application_ids) and not public.owns_job(a.job_id)
  ) then
    raise exception 'You can only decide on applications to your own jobs' using errcode = '42501';
  end if;

  update public.applications
     set status = p_decision, decided_at = now()
   where id = any (p_application_ids)
     and (status = 'applied' or (status = 'accepted' and p_decision = 'declined'));
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke execute on function public.decide_applications(uuid[], public.application_status) from public, anon;
grant execute on function public.decide_applications(uuid[], public.application_status) to authenticated;

-- ---------------------------------------------------------------------------
-- Scores are written only by the rank-applicants Edge Function (service role).
-- p_scores: [{ "application_id": uuid, "score": number, "breakdown": {...} }]
-- ---------------------------------------------------------------------------

create function public.save_match_scores(p_scores jsonb, p_ranker_version text)
returns integer
language sql
set search_path = ''
as $$
  with s as (
    select (e ->> 'application_id')::uuid as id, (e ->> 'score')::numeric as score, e -> 'breakdown' as breakdown
    from jsonb_array_elements(p_scores) as e
  ), u as (
    update public.applications a
       set match_score = s.score, score_breakdown = s.breakdown, ranker_version = p_ranker_version
      from s where a.id = s.id
    returning 1
  )
  select count(*)::int from u;
$$;

revoke execute on function public.save_match_scores(jsonb, text) from public, anon, authenticated;
grant execute on function public.save_match_scores(jsonb, text) to service_role;
