-- Milestone 2: worker profiles, private visa details, farms + verification, admin tools.

create type public.visa_type as enum ('417', '462', 'other', 'citizen_pr');
create type public.travel_mode as enum ('solo', 'group');
create type public.verification_status as enum ('pending', 'verified', 'rejected');

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reference data: regions and postcodes (readable by any signed-in user).
-- Only a Queensland subset for the MVP; load the full Australia Post / ABS dataset before launch.
-- ---------------------------------------------------------------------------

create table public.regions (
  id text primary key,
  name text not null,
  state text not null,
  centroid_lat double precision not null,
  centroid_lng double precision not null
);

create table public.postcodes (
  postcode text primary key check (postcode ~ '^\d{4}$'),
  locality text not null,
  state text not null,
  lat double precision not null,
  lng double precision not null,
  region_id text references public.regions (id)
);

alter table public.regions enable row level security;
alter table public.postcodes enable row level security;
create policy "regions: signed-in read" on public.regions for select to authenticated using (true);
create policy "postcodes: signed-in read" on public.postcodes for select to authenticated using (true);

insert into public.regions (id, name, state, centroid_lat, centroid_lng) values
  ('lockyer-valley', 'Lockyer Valley', 'QLD', -27.57, 152.30),
  ('darling-downs', 'Darling Downs', 'QLD', -27.56, 151.95),
  ('granite-belt', 'Granite Belt & Southern Downs', 'QLD', -28.55, 151.95),
  ('bundaberg', 'Bundaberg & Wide Bay', 'QLD', -24.95, 152.20),
  ('bowen-burdekin', 'Bowen & Burdekin', 'QLD', -19.80, 147.85),
  ('atherton-tablelands', 'Atherton Tablelands', 'QLD', -17.13, 145.45),
  ('cassowary-coast', 'Cassowary Coast', 'QLD', -17.73, 145.98),
  ('sunshine-coast-hinterland', 'Sunshine Coast Hinterland & Gympie', 'QLD', -26.40, 152.75);

-- Approximate town-centre coordinates (good enough for distance ranking).
insert into public.postcodes (postcode, locality, state, lat, lng, region_id) values
  ('4000', 'Brisbane City', 'QLD', -27.4698, 153.0251, null),
  ('4311', 'Lowood', 'QLD', -27.4650, 152.5760, 'lockyer-valley'),
  ('4341', 'Laidley', 'QLD', -27.6320, 152.3920, 'lockyer-valley'),
  ('4342', 'Forest Hill', 'QLD', -27.5900, 152.3550, 'lockyer-valley'),
  ('4343', 'Gatton', 'QLD', -27.5580, 152.2760, 'lockyer-valley'),
  ('4350', 'Toowoomba', 'QLD', -27.5598, 151.9507, 'darling-downs'),
  ('4370', 'Warwick', 'QLD', -28.2150, 152.0340, 'granite-belt'),
  ('4380', 'Stanthorpe', 'QLD', -28.6540, 151.9340, 'granite-belt'),
  ('4382', 'Ballandean', 'QLD', -28.7960, 151.8420, 'granite-belt'),
  ('4570', 'Gympie', 'QLD', -26.1900, 152.6650, 'sunshine-coast-hinterland'),
  ('4660', 'Childers', 'QLD', -25.2370, 152.2780, 'bundaberg'),
  ('4670', 'Bundaberg', 'QLD', -24.8661, 152.3489, 'bundaberg'),
  ('4671', 'Gin Gin', 'QLD', -24.9930, 151.9580, 'bundaberg'),
  ('4805', 'Bowen', 'QLD', -20.0130, 148.2470, 'bowen-burdekin'),
  ('4807', 'Ayr', 'QLD', -19.5740, 147.4060, 'bowen-burdekin'),
  ('4810', 'Townsville', 'QLD', -19.2590, 146.8169, null),
  ('4854', 'Tully', 'QLD', -17.9330, 145.9230, 'cassowary-coast'),
  ('4860', 'Innisfail', 'QLD', -17.5240, 146.0310, 'cassowary-coast'),
  ('4870', 'Cairns', 'QLD', -16.9186, 145.7781, null),
  ('4880', 'Mareeba', 'QLD', -16.9930, 145.4230, 'atherton-tablelands'),
  ('4883', 'Atherton', 'QLD', -17.2680, 145.4770, 'atherton-tablelands');

-- ---------------------------------------------------------------------------
-- Workers
-- ---------------------------------------------------------------------------

-- What farms may eventually see (from milestone 4, only for workers who applied to them).
create table public.worker_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 80),
  photo_path text,
  current_postcode text not null check (current_postcode ~ '^\d{4}$'),
  travel_mode public.travel_mode not null default 'solo',
  group_size smallint not null default 1 check (group_size between 1 and 20),
  has_car boolean not null default false,
  needs_accommodation boolean not null default false,
  skills text[] not null default '{}',
  years_experience smallint not null default 0 check (years_experience between 0 and 50),
  experience_summary text not null default '' check (char_length(experience_summary) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (travel_mode = 'group' or group_size = 1)
);

-- Sensitive: only ever readable by the worker themselves (and admins).
-- Farms get a yes/no "visa covers the job dates" answer via a function in milestone 4.
create table public.worker_private (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  nationality text not null check (nationality ~ '^[A-Z]{2}$'),
  visa_type public.visa_type not null,
  visa_expiry date,
  updated_at timestamptz not null default now(),
  check (visa_type = 'citizen_pr' or visa_expiry is not null)
);

create table public.worker_availability (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  check (end_date >= start_date)
);
create index worker_availability_worker_idx on public.worker_availability (worker_id);

create table public.worker_regions (
  worker_id uuid not null references public.profiles (id) on delete cascade,
  region_id text not null references public.regions (id),
  primary key (worker_id, region_id)
);

create trigger worker_profiles_updated_at before update on public.worker_profiles
  for each row execute function public.set_updated_at();
create trigger worker_private_updated_at before update on public.worker_private
  for each row execute function public.set_updated_at();

alter table public.worker_profiles enable row level security;
alter table public.worker_private enable row level security;
alter table public.worker_availability enable row level security;
alter table public.worker_regions enable row level security;

-- Owner has full access while active and a worker; admins can read.
create policy "worker_profiles: owner" on public.worker_profiles for all to authenticated
  using (user_id = auth.uid() and public.is_active())
  with check (user_id = auth.uid() and public.my_role() = 'worker');
create policy "worker_profiles: admin read" on public.worker_profiles for select to authenticated
  using (public.is_admin());

create policy "worker_private: owner" on public.worker_private for all to authenticated
  using (user_id = auth.uid() and public.is_active())
  with check (user_id = auth.uid() and public.my_role() = 'worker');
create policy "worker_private: admin read" on public.worker_private for select to authenticated
  using (public.is_admin());

create policy "worker_availability: owner" on public.worker_availability for all to authenticated
  using (worker_id = auth.uid() and public.is_active())
  with check (worker_id = auth.uid() and public.my_role() = 'worker');

create policy "worker_regions: owner" on public.worker_regions for all to authenticated
  using (worker_id = auth.uid() and public.is_active())
  with check (worker_id = auth.uid() and public.my_role() = 'worker');

-- Save the whole worker profile atomically. SECURITY INVOKER, so all of the RLS above applies.
create function public.save_worker_profile(p jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  insert into public.worker_profiles as w (
    user_id, full_name, current_postcode, travel_mode, group_size, has_car,
    needs_accommodation, skills, years_experience, experience_summary
  ) values (
    uid,
    p ->> 'fullName',
    p ->> 'currentPostcode',
    (p ->> 'travelMode')::public.travel_mode,
    (p ->> 'groupSize')::smallint,
    (p ->> 'hasCar')::boolean,
    (p ->> 'needsAccommodation')::boolean,
    coalesce(array(select jsonb_array_elements_text(p -> 'skills')), '{}'),
    (p ->> 'yearsExperience')::smallint,
    coalesce(p ->> 'experienceSummary', '')
  )
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    current_postcode = excluded.current_postcode,
    travel_mode = excluded.travel_mode,
    group_size = excluded.group_size,
    has_car = excluded.has_car,
    needs_accommodation = excluded.needs_accommodation,
    skills = excluded.skills,
    years_experience = excluded.years_experience,
    experience_summary = excluded.experience_summary;

  insert into public.worker_private (user_id, nationality, visa_type, visa_expiry)
  values (uid, p ->> 'nationality', (p ->> 'visaType')::public.visa_type, (p ->> 'visaExpiry')::date)
  on conflict (user_id) do update set
    nationality = excluded.nationality,
    visa_type = excluded.visa_type,
    visa_expiry = excluded.visa_expiry;

  delete from public.worker_regions where worker_id = uid;
  insert into public.worker_regions (worker_id, region_id)
  select uid, r from jsonb_array_elements_text(p -> 'regionIds') as r;

  delete from public.worker_availability where worker_id = uid;
  insert into public.worker_availability (worker_id, start_date, end_date)
  select uid, (a ->> 'startDate')::date, (a ->> 'endDate')::date
  from jsonb_array_elements(p -> 'availability') as a;
end;
$$;

revoke execute on function public.save_worker_profile(jsonb) from public, anon;
grant execute on function public.save_worker_profile(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Farms
-- ---------------------------------------------------------------------------

-- Same ATO checksum as packages/shared/src/abn.ts.
create function public.is_valid_abn(abn text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  weights int[] := array[10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  total int := 0;
  d int;
begin
  if abn is null or abn !~ '^\d{11}$' then
    return false;
  end if;
  for i in 1..11 loop
    d := substr(abn, i, 1)::int;
    if i = 1 then d := d - 1; end if;
    total := total + d * weights[i];
  end loop;
  return total % 89 = 0;
end;
$$;

create table public.farms (
  id uuid primary key default gen_random_uuid(),
  -- One business per farm account in the MVP.
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  business_name text not null check (char_length(business_name) between 2 and 120),
  abn text not null unique check (public.is_valid_abn(abn)),
  contact_phone text not null check (contact_phone ~ '^(\+?61|0)[2-478]\d{8}$'),
  postcode text not null check (postcode ~ '^\d{4}$'),
  description text not null default '' check (char_length(description) <= 2000),
  logo_path text,
  is_labour_hire boolean not null default false,
  labour_hire_licence_number text,
  verification_status public.verification_status not null default 'pending',
  rejection_reason text,
  verified_at timestamptz,
  verified_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_labour_hire or char_length(coalesce(labour_hire_licence_number, '')) >= 3)
);

create index farms_verification_status_idx on public.farms (verification_status);

create trigger farms_updated_at before update on public.farms
  for each row execute function public.set_updated_at();

-- Farm owners can never set their own verification state:
--  * new farms always start as 'pending';
--  * a rejected farm that edits its details goes back to 'pending' (resubmission);
--  * a verified farm that changes its legal identity (name, ABN, labour hire details) is re-reviewed.
-- Admin tools run without a user JWT (dashboard / service role), so auth.uid() is null there.
create function public.guard_farm_verification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verification_status := 'pending';
    new.rejection_reason := null;
    new.verified_at := null;
    new.verified_by := null;
    return new;
  end if;

  new.owner_id := old.owner_id;
  new.verification_status := old.verification_status;
  new.rejection_reason := old.rejection_reason;
  new.verified_at := old.verified_at;
  new.verified_by := old.verified_by;

  if old.verification_status = 'rejected'
     or (old.verification_status = 'verified' and (
       new.business_name is distinct from old.business_name
       or new.abn is distinct from old.abn
       or new.is_labour_hire is distinct from old.is_labour_hire
       or new.labour_hire_licence_number is distinct from old.labour_hire_licence_number))
  then
    new.verification_status := 'pending';
    new.rejection_reason := null;
    new.verified_at := null;
    new.verified_by := null;
  end if;

  return new;
end;
$$;

create trigger farms_guard_verification before insert or update on public.farms
  for each row execute function public.guard_farm_verification();

alter table public.farms enable row level security;

create policy "farms: owner read" on public.farms for select to authenticated
  using (owner_id = auth.uid());
create policy "farms: owner insert" on public.farms for insert to authenticated
  with check (owner_id = auth.uid() and public.my_role() = 'farm');
create policy "farms: owner update" on public.farms for update to authenticated
  using (owner_id = auth.uid() and public.is_active())
  with check (owner_id = auth.uid());
create policy "farms: admin read" on public.farms for select to authenticated
  using (public.is_admin());

-- What anyone signed in may see about a farm: verified farms only, no phone number.
-- A view (owned by postgres) so it can expose selected columns of selected rows.
create view public.farms_public as
  select f.id, f.business_name, f.postcode, pc.locality, pc.region_id, f.description,
         f.logo_path, f.is_labour_hire, f.verification_status, f.verified_at
  from public.farms f
  left join public.postcodes pc on pc.postcode = f.postcode
  where f.verification_status = 'verified';

revoke all on public.farms_public from anon, public;
grant select on public.farms_public to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: worker photos (private, per-user folder) and farm logos (public).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('farm-logos', 'farm-logos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

create policy "avatars: owner read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text and public.is_active());
create policy "avatars: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: admin read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.is_admin());

create policy "farm-logos: owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'farm-logos' and (storage.foldername(name))[1] = auth.uid()::text and public.is_active());
create policy "farm-logos: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'farm-logos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "farm-logos: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'farm-logos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Account deletion (privacy): removes the auth user; everything else cascades.
-- The app deletes the user's storage files first.
-- ---------------------------------------------------------------------------

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin tools. Run from the Supabase dashboard SQL editor (see docs/admin-runbook.md).
-- They are NOT callable by app users: execute is revoked from anon/authenticated.
-- ---------------------------------------------------------------------------

create table public.admin_actions (
  id bigint generated always as identity primary key,
  action text not null,
  target_user_id uuid,
  target_farm_id uuid,
  note text,
  performed_by text not null default session_user,
  created_at timestamptz not null default now()
);
alter table public.admin_actions enable row level security;
create policy "admin_actions: admin read" on public.admin_actions for select to authenticated
  using (public.is_admin());

create function public.admin_approve_farm(p_farm_id uuid, p_note text default null)
returns public.farms
language plpgsql
set search_path = ''
as $$
declare
  result public.farms;
begin
  update public.farms
     set verification_status = 'verified', rejection_reason = null,
         verified_at = now(), verified_by = session_user
   where id = p_farm_id
  returning * into result;
  if result.id is null then
    raise exception 'Farm % not found', p_farm_id;
  end if;
  insert into public.admin_actions (action, target_farm_id, target_user_id, note)
  values ('approve_farm', p_farm_id, result.owner_id, p_note);
  return result;
end;
$$;

create function public.admin_reject_farm(p_farm_id uuid, p_reason text)
returns public.farms
language plpgsql
set search_path = ''
as $$
declare
  result public.farms;
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required; the farm sees it in the app';
  end if;
  update public.farms
     set verification_status = 'rejected', rejection_reason = p_reason,
         verified_at = null, verified_by = null
   where id = p_farm_id
  returning * into result;
  if result.id is null then
    raise exception 'Farm % not found', p_farm_id;
  end if;
  insert into public.admin_actions (action, target_farm_id, target_user_id, note)
  values ('reject_farm', p_farm_id, result.owner_id, p_reason);
  return result;
end;
$$;

create function public.admin_suspend_user(p_user_id uuid, p_reason text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required';
  end if;
  update public.profiles set status = 'suspended', updated_at = now() where id = p_user_id;
  if not found then
    raise exception 'User % not found', p_user_id;
  end if;
  -- Also block sign-in and token refresh; RLS already blocks data access via is_active().
  update auth.users set banned_until = 'infinity' where id = p_user_id;
  insert into public.admin_actions (action, target_user_id, note) values ('suspend_user', p_user_id, p_reason);
end;
$$;

create function public.admin_unsuspend_user(p_user_id uuid, p_note text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.profiles set status = 'active', updated_at = now() where id = p_user_id;
  if not found then
    raise exception 'User % not found', p_user_id;
  end if;
  update auth.users set banned_until = null where id = p_user_id;
  insert into public.admin_actions (action, target_user_id, note) values ('unsuspend_user', p_user_id, p_note);
end;
$$;

revoke execute on function public.admin_approve_farm(uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_reject_farm(uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_suspend_user(uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_unsuspend_user(uuid, text) from public, anon, authenticated;

-- Verification queue for the dashboard, oldest first.
create view public.admin_pending_farms as
  select f.id as farm_id, f.business_name, f.abn, f.is_labour_hire, f.labour_hire_licence_number,
         f.contact_phone, f.postcode, pc.locality, u.email as owner_email, f.created_at, f.updated_at
  from public.farms f
  join auth.users u on u.id = f.owner_id
  left join public.postcodes pc on pc.postcode = f.postcode
  where f.verification_status = 'pending'
  order by f.updated_at;

revoke all on public.admin_pending_farms from public, anon, authenticated;
