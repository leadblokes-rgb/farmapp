-- Milestone 1: identity, roles and account status.
-- Every app user has exactly one row in public.profiles, created by a trigger on auth.users.

create type public.user_role as enum ('worker', 'farm', 'admin');
create type public.account_status as enum ('active', 'suspended');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Null until the user picks "worker" or "farm". Admin is only ever granted manually.
  role public.user_role,
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per auth user. Role is set once by the user (worker/farm); admin and status are changed only by admins via the dashboard or admin_* functions.';

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- Helpers used by RLS policies across the schema.
-- SECURITY DEFINER so they can read profiles without recursing into its own policies.
-- ---------------------------------------------------------------------------

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create function public.is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

create function public.my_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid() and status = 'active';
$$;

-- ---------------------------------------------------------------------------
-- Policies. Users can read only their own profile; admins can read all.
-- There is deliberately NO insert/update/delete policy: rows are created by the
-- trigger below and the role is set through set_my_role(). Admin changes happen
-- as the service role (dashboard), which bypasses RLS.
-- ---------------------------------------------------------------------------

create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles: admins read all"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Create a profile for every new auth user. The role comes from sign-up metadata
-- (supabase.auth.signInWithOtp({ options: { data: { role } } })) but only
-- 'worker' or 'farm' are accepted; anything else (including 'admin') is ignored.
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := new.raw_user_meta_data ->> 'role';
begin
  insert into public.profiles (id, role)
  values (
    new.id,
    case when requested in ('worker', 'farm') then requested::public.user_role else null end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Let a signed-in user choose worker/farm exactly once (e.g. if metadata was missing).
-- ---------------------------------------------------------------------------

create function public.set_my_role(new_role public.user_role)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if new_role not in ('worker', 'farm') then
    raise exception 'Role % cannot be self-assigned', new_role using errcode = '42501';
  end if;

  update public.profiles
     set role = new_role, updated_at = now()
   where id = auth.uid() and role is null and status = 'active'
  returning * into result;

  if result.id is null then
    raise exception 'Role already set or account not active' using errcode = 'P0001';
  end if;
  return result;
end;
$$;

revoke execute on function public.set_my_role(public.user_role) from public, anon;
grant execute on function public.set_my_role(public.user_role) to authenticated;
