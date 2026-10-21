begin;
select plan(20);

create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_dashboard() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
select set_config('croppr.skip_notifications', 'on', true);

insert into auth.users (id, email, raw_user_meta_data) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'farmA@test.local', '{"role":"farm"}'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'farmB@test.local', '{"role":"farm"}'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'w1@test.local', '{"role":"worker"}'),
  ('eeeeeeee-0000-0000-0000-000000000004', 'w2@test.local', '{"role":"worker"}');
insert into public.farms (id, owner_id, business_name, abn, contact_phone, postcode, verification_status) values
  ('feeeeeee-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', 'Farm A', '51824753556', '0412345678', '4343', 'verified'),
  ('feeeeeee-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000002', 'Farm B', '53004085616', '0412345678', '4670', 'verified');
insert into public.jobs (id, farm_id, title, role_type, postcode, start_date, end_date, workers_needed, pay_type, pay_rate_cents, hours_per_week) values
  ('aeeeeeee-0000-0000-0000-000000000001', 'feeeeeee-0000-0000-0000-000000000001', 'Job A', 'picking', '4343', current_date + 1, current_date + 30, 5, 'hourly', 3300, 38);
insert into public.worker_profiles (user_id, full_name, current_postcode) values
  ('eeeeeeee-0000-0000-0000-000000000003', 'Wanda Worker', '4343'),
  ('eeeeeeee-0000-0000-0000-000000000004', 'Walt Other', '4343');
insert into public.applications (id, job_id, worker_id) values
  ('ae000000-0000-0000-0000-000000000001', 'aeeeeeee-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000003'),
  ('ae000000-0000-0000-0000-000000000002', 'aeeeeeee-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000004');

-- ---------- Starting conversations ----------
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000002');
select throws_ok($$ select public.start_conversation('ae000000-0000-0000-0000-000000000001') $$, '42501', null,
  'another farm cannot message my applicant');

select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000003');
select throws_ok($$ select public.start_conversation('ae000000-0000-0000-0000-000000000001') $$, '42501', null,
  'a worker cannot start a conversation');
select throws_ok($$ insert into public.conversations (application_id, farm_id, worker_id)
  values ('ae000000-0000-0000-0000-000000000001', 'feeeeeee-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000003') $$,
  '42501', null, 'conversations cannot be inserted directly');

select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000001');
select lives_ok($$ select set_config('test.conv', public.start_conversation('ae000000-0000-0000-0000-000000000001')::text, true) $$,
  'farm messages an applicant before accepting');
select is(public.start_conversation('ae000000-0000-0000-0000-000000000001')::text, current_setting('test.conv'),
  'starting again returns the same conversation');
select lives_ok($$ insert into public.messages (conversation_id, sender_id, body)
  values (current_setting('test.conv')::uuid, 'eeeeeeee-0000-0000-0000-000000000001', 'Hi! Can you start Monday?') $$,
  'farm sends a message');

-- ---------- Worker side ----------
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000003');
select is((select count(*)::int from public.messages), 1, 'worker reads the message');
select is((select unread from public.my_conversations()), 1, 'it shows as unread');
select lives_ok($$ insert into public.messages (conversation_id, sender_id, body)
  values (current_setting('test.conv')::uuid, 'eeeeeeee-0000-0000-0000-000000000003', 'Yes!') $$, 'worker replies');
select throws_ok($$ insert into public.messages (conversation_id, sender_id, body)
  values (current_setting('test.conv')::uuid, 'eeeeeeee-0000-0000-0000-000000000001', 'spoofed') $$,
  '42501', null, 'cannot send as someone else');
select public.mark_conversation_read(current_setting('test.conv')::uuid);
select is((select unread from public.my_conversations()), 0, 'marking read clears unread');

select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000004');
select is((select count(*)::int from public.messages), 0, 'other workers cannot read the chat');
select throws_ok($$ insert into public.messages (conversation_id, sender_id, body)
  values (current_setting('test.conv')::uuid, 'eeeeeeee-0000-0000-0000-000000000004', 'butting in') $$,
  '42501', null, 'non-participants cannot post');

-- ---------- Accepting opens a conversation ----------
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000001');
select public.decide_applications(array['ae000000-0000-0000-0000-000000000002'::uuid], 'accepted');
select is((select count(*)::int from public.conversations), 2, 'accepting opens a conversation automatically');

-- ---------- Reports ----------
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000003');
select lives_ok($$ insert into public.reports (reporter_id, target_user_id, reason, details)
  values ('eeeeeeee-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000001', 'harassment', 'Rude messages') $$,
  'worker reports a farm');
select throws_ok($$ insert into public.reports (reporter_id, target_user_id, reason, status)
  values ('eeeeeeee-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000001', 'other', 'dismissed') $$,
  '42501', null, 'reporter cannot pre-resolve a report');
select isnt(public.submit_report('harassment', 'from chat', current_setting('test.conv')::uuid), null,
  'report from a chat works out the target');
select is((select target_user_id::text from public.reports where details = 'from chat'), 'eeeeeeee-0000-0000-0000-000000000001',
  'target is the farm owner');
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000001');
select is((select count(*)::int from public.reports), 0, 'the reported user cannot see reports about them');

-- ---------- Push tokens ----------
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000003');
insert into public.push_tokens (expo_token, user_id, platform) values ('ExponentPushToken[x]', 'eeeeeeee-0000-0000-0000-000000000003', 'ios');
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000004');
select is((select count(*)::int from public.push_tokens), 0, 'push tokens are private');

select pg_temp.as_dashboard();
select * from finish();
rollback;
