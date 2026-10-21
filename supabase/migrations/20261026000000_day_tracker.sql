-- Milestone 6: specified-work day tracker. Everything here is private to the worker:
-- farms never see a worker's tracker, shifts or payslips.

alter table public.worker_private
  add column tracker_goal text not null default 'second' check (tracker_goal in ('second', 'third'));

create table public.employers_worked (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  abn text check (abn is null or public.is_valid_abn(abn)),
  postcode text check (postcode is null or postcode ~ '^\d{4}$'),
  -- The worker's own judgement (prefilled from the job's "likely specified work").
  counts_as_specified boolean not null default true,
  farm_id uuid references public.farms (id) on delete set null,
  job_id uuid references public.jobs (id) on delete set null,
  created_at timestamptz not null default now()
);
create index employers_worked_worker_idx on public.employers_worked (worker_id);

create table public.shift_logs (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles (id) on delete cascade,
  employer_id uuid not null references public.employers_worked (id) on delete cascade,
  work_date date not null,
  hours numeric(4, 2) not null check (hours > 0 and hours <= 24),
  notes text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  unique (employer_id, work_date)
);
create index shift_logs_worker_idx on public.shift_logs (worker_id, work_date);

create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles (id) on delete cascade,
  employer_id uuid not null references public.employers_worked (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  days_worked smallint not null check (days_worked >= 0),
  hours_total numeric(6, 2) not null check (hours_total >= 0),
  file_path text,
  created_at timestamptz not null default now(),
  check (period_end >= period_start),
  check (days_worked <= period_end - period_start + 1)
);
create index payslips_worker_idx on public.payslips (worker_id);

alter table public.employers_worked enable row level security;
alter table public.shift_logs enable row level security;
alter table public.payslips enable row level security;

create policy "employers_worked: owner" on public.employers_worked for all to authenticated
  using (worker_id = auth.uid() and public.is_active())
  with check (worker_id = auth.uid() and public.my_role() = 'worker');

-- Shifts and payslips must point at one of the worker's own employers.
create function public.owns_employer(p_employer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.employers_worked where id = p_employer_id and worker_id = auth.uid());
$$;

create policy "shift_logs: owner" on public.shift_logs for all to authenticated
  using (worker_id = auth.uid() and public.is_active())
  with check (worker_id = auth.uid() and public.owns_employer(employer_id));
create policy "payslips: owner" on public.payslips for all to authenticated
  using (worker_id = auth.uid() and public.is_active())
  with check (worker_id = auth.uid() and public.owns_employer(employer_id));

-- Private payslip files: payslips/<user id>/<file>. Owner only (not farms, not admins via the app).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('payslips', 'payslips', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']);

create policy "payslips files: owner read" on storage.objects for select to authenticated
  using (bucket_id = 'payslips' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "payslips files: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'payslips' and (storage.foldername(name))[1] = auth.uid()::text and public.is_active());
create policy "payslips files: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'payslips' and (storage.foldername(name))[1] = auth.uid()::text);

-- Jobs the worker was accepted for that aren't in their tracker yet (one tap to add).
create function public.employer_suggestions()
returns table (farm_id uuid, job_id uuid, business_name text, postcode text, likely_specified_work boolean, job_title text)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, j.id, f.business_name, j.postcode, j.likely_specified_work, j.title
  from public.applications a
  join public.jobs j on j.id = a.job_id
  join public.farms f on f.id = j.farm_id
  where a.worker_id = auth.uid() and a.status in ('accepted', 'completed')
    and not exists (select 1 from public.employers_worked e where e.worker_id = auth.uid() and e.job_id = j.id)
  order by j.start_date;
$$;
revoke execute on function public.employer_suggestions() from public, anon;
grant execute on function public.employer_suggestions() to authenticated;
