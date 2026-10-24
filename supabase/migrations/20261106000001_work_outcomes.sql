-- "Did this work out?": when a job's end date passes, accepted applications become 'ended' and
-- both sides are asked how it went. Matching answers complete the job as a VERIFIED work record
-- (the basis for workers' evidence of specified work); disagreements go to the admin queue; after
-- 7 days a single answer (or the farm's day-one check-in) is used, unverified.

create table public.work_outcomes (
  application_id uuid primary key references public.applications (id) on delete cascade,
  worker_answer public.work_answer,
  worker_answered_at timestamptz,
  farm_answer public.work_answer,
  farm_answered_at timestamptz,
  -- Set once resolved.
  outcome public.work_answer,
  verified boolean not null default false,
  resolved_by text check (resolved_by in ('both', 'timeout', 'admin')),
  resolved_at timestamptz,
  dispute_report_id bigint references public.reports (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.work_outcomes enable row level security;
create policy "work_outcomes: worker reads own" on public.work_outcomes for select to authenticated
  using (exists (select 1 from public.applications a where a.id = application_id and a.worker_id = auth.uid()));
create policy "work_outcomes: farm reads own jobs" on public.work_outcomes for select to authenticated
  using (public.owns_application_job(application_id));
create policy "work_outcomes: admin read" on public.work_outcomes for select to authenticated
  using (public.is_admin());
-- Written only through the functions below.

-- Applying an outcome records it in attendance (so reliability and no-show counts stay in one place)
-- without sending the "marked as a no-show" push: the worker either said so themselves or has
-- already been through the dispute process.
create or replace function public.notify_attendance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('croppr.applying_outcome', true), '') = 'on' then
    return new;
  end if;
  if new.status = 'no_show' and (tg_op = 'INSERT' or old.status is distinct from 'no_show') then
    perform public.notify('no_show_marked', jsonb_build_object('application_id', new.application_id));
  end if;
  return new;
end;
$$;

create function public.apply_work_outcome(
  p_application_id uuid,
  p_answer public.work_answer,
  p_verified boolean,
  p_resolved_by text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  open_dispute boolean;
begin
  update public.work_outcomes
     set outcome = p_answer, verified = p_verified, resolved_by = p_resolved_by, resolved_at = now()
   where application_id = p_application_id;

  -- Leave a no-show that's under dispute alone; the admin decides that one.
  select t.disputed_at is not null and t.resolved_at is null into open_dispute
  from public.attendance t where t.application_id = p_application_id;
  if not coalesce(open_dispute, false) then
    perform set_config('croppr.applying_outcome', 'on', true);
    insert into public.attendance (application_id, status)
    values (p_application_id,
            case p_answer when 'worked' then 'showed' when 'left_early' then 'left_early' else 'no_show' end::public.attendance_status)
    on conflict (application_id) do update set status = excluded.status, marked_at = now()
      where public.attendance.status is distinct from excluded.status;
    perform set_config('croppr.applying_outcome', 'off', true);
  end if;

  if p_answer in ('worked', 'left_early') then
    update public.applications set status = 'completed', completed_at = now()
     where id = p_application_id and status = 'ended';
  end if;
end;
$$;
revoke execute on function public.apply_work_outcome(uuid, public.work_answer, boolean, text) from public, anon, authenticated;

-- Ends finished jobs and resolves outcomes nobody answered in time. Runs daily and whenever the
-- app loads ratings or outcome prompts. (Name kept for existing callers.)
drop function public.complete_finished_jobs();
create function public.complete_finished_jobs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ended integer;
  job_ids uuid[];
  jid uuid;
  r record;
begin
  -- 1. Accepted applications on jobs that have ended -> 'ended', with an outcome to answer.
  --    Workers are told by the status-change trigger; each farm gets one reminder per job.
  with e as (
    update public.applications a
       set status = 'ended'
      from public.jobs j
     where j.id = a.job_id and a.status = 'accepted' and j.end_date < current_date
    returning a.id, a.job_id
  ), o as (
    insert into public.work_outcomes (application_id) select id from e on conflict do nothing
  )
  select count(*), coalesce(array_agg(distinct e.job_id), '{}') into ended, job_ids from e;
  foreach jid in array job_ids loop
    perform public.notify('work_outcome_request_farm', jsonb_build_object('job_id', jid));
  end loop;

  -- 2. After 7 days, use what we have: one side's answer, else the farm's day-one check-in.
  for r in
    select w.application_id, w.worker_answer, w.farm_answer, t.status as attendance
    from public.work_outcomes w
    join public.applications a on a.id = w.application_id
    join public.jobs j on j.id = a.job_id
    left join public.attendance t on t.application_id = w.application_id
    where w.resolved_at is null and w.dispute_report_id is null
      and a.status = 'ended' and j.end_date + 7 < current_date
  loop
    if r.worker_answer is not null or r.farm_answer is not null then
      perform public.apply_work_outcome(r.application_id, coalesce(r.farm_answer, r.worker_answer), false, 'timeout');
    elsif r.attendance is not null then
      perform public.apply_work_outcome(r.application_id,
        case r.attendance when 'showed' then 'worked' when 'left_early' then 'left_early' else 'did_not_work' end::public.work_answer,
        false, 'timeout');
    end if;
  end loop;
  return ended;
end;
$$;
revoke execute on function public.complete_finished_jobs() from public, anon;
grant execute on function public.complete_finished_jobs() to authenticated;

-- One side answers. Returns 'waiting' (other side hasn't answered), 'completed', 'not_worked' or
-- 'disputed' (answers differ; the Croppr team decides).
create function public.answer_work_outcome(p_application_id uuid, p_answer public.work_answer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  app record;
  w public.work_outcomes;
  side text;
  rid bigint;
begin
  select a.id, a.worker_id, a.job_id, a.status into app from public.applications a where a.id = p_application_id;
  if app.id is null or not public.is_active() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if app.worker_id = auth.uid() then
    side := 'worker';
  elsif public.owns_application_job(p_application_id) then
    side := 'farm';
  else
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into w from public.work_outcomes where application_id = p_application_id;
  if w.application_id is null or app.status not in ('ended', 'completed') then
    raise exception 'You can answer once the job has ended' using errcode = '22023';
  end if;
  if w.resolved_at is not null then
    raise exception 'This job is already settled' using errcode = '22023';
  end if;
  if (side = 'worker' and w.worker_answer is not null) or (side = 'farm' and w.farm_answer is not null) then
    raise exception 'You''ve already answered' using errcode = '23505';
  end if;

  if side = 'worker' then
    update public.work_outcomes set worker_answer = p_answer, worker_answered_at = now()
     where application_id = p_application_id returning * into w;
  else
    update public.work_outcomes set farm_answer = p_answer, farm_answered_at = now()
     where application_id = p_application_id returning * into w;
  end if;

  if w.worker_answer is null or w.farm_answer is null then
    return 'waiting';
  end if;
  if w.worker_answer = w.farm_answer then
    perform public.apply_work_outcome(p_application_id, w.worker_answer, true, 'both');
    return case when w.worker_answer = 'did_not_work' then 'not_worked' else 'completed' end;
  end if;

  -- They disagree: nothing counts against either side until an admin decides.
  insert into public.reports (reporter_id, target_user_id, target_job_id, conversation_id, reason, details)
  values (auth.uid(),
          case when side = 'worker' then public.job_owner(app.job_id) else app.worker_id end,
          app.job_id,
          (select c.id from public.conversations c where c.application_id = p_application_id),
          'work_outcome_dispute',
          format('Worker says: %s. Farm says: %s.', w.worker_answer, w.farm_answer))
  returning id into rid;
  update public.work_outcomes set dispute_report_id = rid where application_id = p_application_id;
  return 'disputed';
end;
$$;
revoke execute on function public.answer_work_outcome(uuid, public.work_answer) from public, anon;
grant execute on function public.answer_work_outcome(uuid, public.work_answer) to authenticated;

-- Dashboard only: settle a disagreement.
create function public.admin_resolve_work_outcome(p_report_id bigint, p_outcome public.work_answer, p_note text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  app uuid;
begin
  select application_id into app from public.work_outcomes where dispute_report_id = p_report_id and resolved_at is null;
  if app is null then
    raise exception 'No open work-outcome dispute for report %', p_report_id;
  end if;
  perform public.apply_work_outcome(app, p_outcome, false, 'admin');
  perform public.admin_resolve_report(p_report_id, 'actioned', p_outcome || ': ' || coalesce(p_note, ''));
end;
$$;
revoke execute on function public.admin_resolve_work_outcome(bigint, public.work_answer, text) from public, anon, authenticated;

-- What the caller still needs to answer.
create function public.pending_outcomes()
returns table (
  application_id uuid,
  kind text,
  job_id uuid,
  job_title text,
  subject_name text,
  end_date date,
  suggested public.work_answer
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, 'worker', j.id, j.title, f.business_name, j.end_date, null::public.work_answer
  from public.work_outcomes w
  join public.applications a on a.id = w.application_id
  join public.jobs j on j.id = a.job_id
  join public.farms f on f.id = j.farm_id
  where a.worker_id = auth.uid() and w.worker_answer is null and w.resolved_at is null and public.is_active()
  union all
  select a.id, 'farm', j.id, j.title, wp.full_name, j.end_date,
         case t.status when 'showed' then 'worked' when 'left_early' then 'left_early' when 'no_show' then 'did_not_work' end::public.work_answer
  from public.work_outcomes w
  join public.applications a on a.id = w.application_id
  join public.jobs j on j.id = a.job_id
  join public.farms f on f.id = j.farm_id
  join public.worker_profiles wp on wp.user_id = a.worker_id
  left join public.attendance t on t.application_id = a.id
  where f.owner_id = auth.uid() and w.farm_answer is null and w.resolved_at is null and public.is_active()
  order by 6 desc, 4, 5;
$$;
revoke execute on function public.pending_outcomes() from public, anon;
grant execute on function public.pending_outcomes() to authenticated;

-- Workers hear about it as soon as their job ends.
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
  elsif tg_op = 'UPDATE' and new.status = 'ended' and old.status is distinct from 'ended' then
    perform public.notify('work_outcome_request', jsonb_build_object('application_id', new.id));
  elsif tg_op = 'UPDATE' and new.status = 'completed' and old.status is distinct from 'completed' then
    perform public.notify('application_completed', jsonb_build_object('application_id', new.id));
  end if;
  return new;
end;
$$;

-- Ratings open as soon as you've said the work happened (worked or left early).
create or replace function public.can_rate_farm(p_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.applications a
    left join public.work_outcomes w on w.application_id = a.id
    where a.id = p_application_id and a.worker_id = auth.uid()
      and (a.status = 'completed'
           or (a.status = 'ended' and w.worker_answer in ('worked', 'left_early')))
  ) and public.is_active();
$$;

create or replace function public.can_rate_worker(p_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.applications a
    left join public.attendance t on t.application_id = a.id
    left join public.work_outcomes w on w.application_id = a.id
    where a.id = p_application_id
      and a.status in ('accepted', 'ended', 'completed')
      and (t.status in ('showed', 'left_early') or w.farm_answer in ('worked', 'left_early'))
  ) and public.owns_application_job(p_application_id);
$$;

-- The worker's applications gain the outcome: their own answer, and whether the work is verified.
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
  dispute_outcome text,
  my_answer public.work_answer,
  outcome public.work_answer,
  work_verified boolean,
  outcome_disputed boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.id, a.status, a.created_at, j.id, j.title, f.business_name, pc.locality, j.start_date, j.end_date,
         j.status, j.farm_id, t.status, t.disputed_at is not null, t.dispute_outcome,
         w.worker_answer, w.outcome, coalesce(w.verified, false),
         w.dispute_report_id is not null and w.resolved_at is null
  from public.applications a
  join public.jobs j on j.id = a.job_id
  left join public.farms_public f on f.id = j.farm_id
  left join public.postcodes pc on pc.postcode = j.postcode
  left join public.attendance t on t.application_id = a.id
  left join public.work_outcomes w on w.application_id = a.id
  where a.worker_id = auth.uid()
  order by a.created_at desc;
$$;
revoke execute on function public.my_applications() from public, anon;
grant execute on function public.my_applications() to authenticated;

-- Shortlist rows gain the outcome too (farm side).
create function public.job_outcomes(p_job_id uuid)
returns table (application_id uuid, farm_answer public.work_answer, outcome public.work_answer, verified boolean, disputed boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select w.application_id, w.farm_answer, w.outcome, w.verified, w.dispute_report_id is not null and w.resolved_at is null
  from public.work_outcomes w join public.applications a on a.id = w.application_id
  where a.job_id = p_job_id and public.owns_job(p_job_id);
$$;
revoke execute on function public.job_outcomes(uuid) from public, anon;
grant execute on function public.job_outcomes(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 'ended' counts as hired everywhere hiring matters.
-- ---------------------------------------------------------------------------
create or replace function public.undo_swipe(p_job_id uuid)
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
    where job_id = p_job_id and worker_id = uid and status in ('accepted', 'declined', 'completed', 'ended')
  ) then
    raise exception 'The farm has already responded to this application' using errcode = 'P0001';
  end if;
  delete from public.applications where job_id = p_job_id and worker_id = uid and status = 'applied';
  delete from public.swipes where job_id = p_job_id and worker_id = uid;
end;
$$;

create or replace function public.start_conversation(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv_id uuid;
  app record;
begin
  select a.id, a.worker_id, a.status, j.farm_id into app
  from public.applications a join public.jobs j on j.id = a.job_id
  where a.id = p_application_id and public.owns_job(a.job_id);
  if app.id is null then
    raise exception 'You can only message your own applicants' using errcode = '42501';
  end if;
  if app.status not in ('applied', 'accepted', 'ended', 'completed') then
    raise exception 'This application is no longer active' using errcode = 'P0001';
  end if;
  insert into public.conversations (application_id, farm_id, worker_id, started_by)
  values (app.id, app.farm_id, app.worker_id, auth.uid())
  on conflict (application_id) do nothing
  returning id into conv_id;
  if conv_id is null then
    select id into conv_id from public.conversations where application_id = app.id;
  end if;
  return conv_id;
end;
$$;

create or replace function public.mask_contact_before_hire()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hired boolean;
  masked text;
begin
  select a.status in ('accepted', 'ended', 'completed') into hired
  from public.conversations c join public.applications a on a.id = c.application_id
  where c.id = new.conversation_id;
  if coalesce(hired, false) then
    return new;
  end if;
  masked := public.mask_contact_details(new.body);
  if masked is distinct from new.body then
    insert into public.contact_share_attempts (conversation_id, sender_id, original_body)
    values (new.conversation_id, new.sender_id, new.body);
    new.body := masked;
    new.contact_masked := true;
  end if;
  return new;
end;
$$;

create or replace function public.broadcast_to_crew(p_job_id uuid, p_body text, p_audience text default 'accepted')
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
      and (case when p_audience = 'accepted' then a.status in ('accepted', 'ended', 'completed') else a.status = 'applied' end)
  loop
    conv := public.start_conversation(app.id);
    insert into public.messages (conversation_id, sender_id, body, broadcast_id)
    values (conv, auth.uid(), trim(p_body), bid);
    sent := sent + 1;
  end loop;
  return sent;
end;
$$;

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
  where a.worker_id = auth.uid() and a.status in ('accepted', 'ended', 'completed')
    and not exists (
      select 1 from public.employers_worked e
      where e.worker_id = auth.uid() and (e.job_id = j.id or e.farm_id = f.id)
    )
  order by f.id, j.start_date desc;
$$;
