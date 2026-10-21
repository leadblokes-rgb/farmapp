-- Milestone 5: chat, reports, push notifications.

-- ---------------------------------------------------------------------------
-- Conversations: one per application. Farms can open one before accepting;
-- accepting opens one automatically. Workers reply but cannot start one.
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications (id) on delete cascade,
  farm_id uuid not null references public.farms (id) on delete cascade,
  worker_id uuid not null references public.profiles (id) on delete cascade,
  started_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz
);
create index conversations_worker_idx on public.conversations (worker_id);
create index conversations_farm_idx on public.conversations (farm_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    join public.farms f on f.id = c.farm_id
    where c.id = p_conversation_id and (c.worker_id = auth.uid() or f.owner_id = auth.uid())
  ) and public.is_active();
$$;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "conversations: participants read" on public.conversations for select to authenticated
  using (public.is_conversation_participant(id));
create policy "conversations: admin read" on public.conversations for select to authenticated
  using (public.is_admin());

create policy "messages: participants read" on public.messages for select to authenticated
  using (public.is_conversation_participant(conversation_id));
create policy "messages: participants send" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and read_at is null and public.is_conversation_participant(conversation_id));
create policy "messages: admin read" on public.messages for select to authenticated
  using (public.is_admin());

create function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;
create trigger messages_touch_conversation after insert on public.messages
  for each row execute function public.touch_conversation();

-- Live updates in the chat screen (Realtime applies the RLS policies above).
alter publication supabase_realtime add table public.messages;

-- Farm opens a chat with an applicant (before or after accepting). Returns the conversation id.
create function public.start_conversation(p_application_id uuid)
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
  if app.status not in ('applied', 'accepted', 'completed') then
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

-- Accepting an application always opens a conversation.
create function public.open_conversation_on_accept()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.conversations (application_id, farm_id, worker_id, started_by)
    select new.id, j.farm_id, new.worker_id, f.owner_id
    from public.jobs j join public.farms f on f.id = j.farm_id where j.id = new.job_id
    on conflict (application_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger applications_open_conversation after update of status on public.applications
  for each row execute function public.open_conversation_on_accept();

-- Mark the other person's messages as read.
create function public.mark_conversation_read(p_conversation_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.messages set read_at = now()
   where conversation_id = p_conversation_id and sender_id <> auth.uid() and read_at is null
     and public.is_conversation_participant(p_conversation_id);
$$;

-- Conversation list for either side, newest activity first.
create function public.my_conversations()
returns table (
  conversation_id uuid,
  application_id uuid,
  application_status public.application_status,
  job_title text,
  other_name text,
  last_message text,
  last_message_at timestamptz,
  unread integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.application_id, a.status, j.title,
         case when c.worker_id = auth.uid() then f.business_name else wp.full_name end,
         (select m.body from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1),
         coalesce(c.last_message_at, c.created_at),
         (select count(*)::int from public.messages m
           where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.read_at is null)
  from public.conversations c
  join public.applications a on a.id = c.application_id
  join public.jobs j on j.id = a.job_id
  join public.farms f on f.id = c.farm_id
  join public.worker_profiles wp on wp.user_id = c.worker_id
  where (c.worker_id = auth.uid() or f.owner_id = auth.uid()) and public.is_active()
  order by coalesce(c.last_message_at, c.created_at) desc;
$$;

revoke execute on function public.start_conversation(uuid) from public, anon;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
revoke execute on function public.my_conversations() from public, anon;
grant execute on function public.start_conversation(uuid) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.my_conversations() to authenticated;

-- ---------------------------------------------------------------------------
-- Reports (handled by admins in the dashboard; see docs/admin-runbook.md)
-- ---------------------------------------------------------------------------

create type public.report_reason as enum
  ('unsafe', 'harassment', 'scam', 'underpaid', 'no_show', 'fake_profile', 'other');
create type public.report_status as enum ('open', 'actioned', 'dismissed');

create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_user_id uuid references public.profiles (id) on delete set null,
  target_job_id uuid references public.jobs (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  reason public.report_reason not null,
  details text not null default '' check (char_length(details) <= 2000),
  status public.report_status not null default 'open',
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (target_user_id is not null or target_job_id is not null)
);

alter table public.reports enable row level security;
create policy "reports: reporter inserts own" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open' and resolution_note is null and public.is_active());
create policy "reports: reporter reads own" on public.reports for select to authenticated
  using (reporter_id = auth.uid());

-- The farm owner behind a job, so reporting a job also flags the business account.
create function public.job_owner(p_job_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select f.owner_id from public.jobs j join public.farms f on f.id = j.farm_id where j.id = p_job_id;
$$;

create view public.admin_open_reports as
  select r.id as report_id, r.created_at, r.reason, r.details,
         ru.email as reporter_email, rp.role as reporter_role,
         r.target_user_id, tu.email as target_email, tp.role as target_role, tp.status as target_status,
         r.target_job_id, j.title as job_title, f.business_name as farm_name,
         r.conversation_id,
         (select count(*) from public.reports r2 where r2.target_user_id = r.target_user_id) as reports_against_target
  from public.reports r
  join auth.users ru on ru.id = r.reporter_id
  join public.profiles rp on rp.id = r.reporter_id
  left join auth.users tu on tu.id = r.target_user_id
  left join public.profiles tp on tp.id = r.target_user_id
  left join public.jobs j on j.id = r.target_job_id
  left join public.farms f on f.id = j.farm_id
  where r.status = 'open'
  order by r.created_at;

revoke all on public.admin_open_reports from public, anon, authenticated;

create function public.admin_resolve_report(p_report_id bigint, p_status public.report_status, p_note text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  target uuid;
begin
  if p_status = 'open' then
    raise exception 'Resolve as actioned or dismissed';
  end if;
  update public.reports set status = p_status, resolution_note = p_note, resolved_at = now()
   where id = p_report_id returning target_user_id into target;
  if not found then
    raise exception 'Report % not found', p_report_id;
  end if;
  insert into public.admin_actions (action, target_user_id, note)
  values ('resolve_report:' || p_report_id || ':' || p_status, target, p_note);
end;
$$;
revoke execute on function public.admin_resolve_report(bigint, public.report_status, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Push notifications
-- ---------------------------------------------------------------------------

create table public.push_tokens (
  expo_token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
create policy "push_tokens: owner" on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- What send-push did, for debugging and tests (service role only).
create table public.notification_log (
  id bigint generated always as identity primary key,
  event text not null,
  recipient_id uuid,
  title text,
  body text,
  url text,
  tokens integer not null default 0,
  outcome text not null,
  created_at timestamptz not null default now()
);
alter table public.notification_log enable row level security;

create extension if not exists pg_net with schema extensions;

-- Calls the send-push Edge Function asynchronously (pg_net), so a slow push never blocks a write.
-- The function URL and the service role key come from Vault:
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1', 'functions_url');
--   select vault.create_secret('<service role key>', 'service_role_key');
-- (seed.sql sets the local values). Seeds can set croppr.skip_notifications = 'on' to stay quiet.
create function public.notify(p_event text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
  key text;
begin
  if coalesce(current_setting('croppr.skip_notifications', true), '') = 'on' then
    return;
  end if;
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'functions_url';
  select decrypted_secret into key from vault.decrypted_secrets where name = 'service_role_key';
  if base_url is null or key is null then
    return; -- push not configured in this environment
  end if;
  perform net.http_post(
    url := base_url || '/send-push',
    body := jsonb_build_object('event', p_event) || p_payload,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || key)
  );
end;
$$;
revoke execute on function public.notify(text, jsonb) from public, anon, authenticated;

create function public.notify_application_change()
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
  end if;
  return new;
end;
$$;
create trigger applications_notify after insert or update of status on public.applications
  for each row execute function public.notify_application_change();

create function public.notify_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify('message', jsonb_build_object('message_id', new.id));
  return new;
end;
$$;
create trigger messages_notify after insert on public.messages
  for each row execute function public.notify_message();

-- Report from the app: the target is worked out server-side from the conversation (the other
-- participant) or the job (its farm's owner), so the app never needs other users' ids.
create function public.submit_report(
  p_reason public.report_reason,
  p_details text default '',
  p_conversation_id uuid default null,
  p_job_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
  job uuid := p_job_id;
  rid bigint;
begin
  if not public.is_active() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_conversation_id is not null then
    if not public.is_conversation_participant(p_conversation_id) then
      raise exception 'Not your conversation' using errcode = '42501';
    end if;
    select case when c.worker_id = auth.uid() then f.owner_id else c.worker_id end, a.job_id
      into target, job
    from public.conversations c
    join public.farms f on f.id = c.farm_id
    join public.applications a on a.id = c.application_id
    where c.id = p_conversation_id;
  elsif p_job_id is not null then
    target := public.job_owner(p_job_id);
  else
    raise exception 'Say what you are reporting' using errcode = '22023';
  end if;

  insert into public.reports (reporter_id, target_user_id, target_job_id, conversation_id, reason, details)
  values (auth.uid(), target, job, p_conversation_id, p_reason, coalesce(p_details, ''))
  returning id into rid;
  return rid;
end;
$$;
revoke execute on function public.submit_report(public.report_reason, text, uuid, uuid) from public, anon;
grant execute on function public.submit_report(public.report_reason, text, uuid, uuid) to authenticated;
revoke execute on function public.job_owner(uuid) from public, anon, authenticated;
