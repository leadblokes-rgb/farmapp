begin;
select plan(13);

create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_dashboard() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create or replace function pg_temp.as_service() returns void language sql as $$
  select set_config('role', 'service_role', true), set_config('request.jwt.claims', '', true);
$$;
select set_config('croppr.skip_notifications', 'on', true);

insert into auth.users (id, email, raw_user_meta_data) values
  ('16161616-0000-0000-0000-000000000001', 'farm@digest.local', '{"role":"farm"}'),
  ('16161616-0000-0000-0000-000000000011', 'w1@digest.local', '{"role":"worker"}'),
  ('16161616-0000-0000-0000-000000000012', 'w2@digest.local', '{"role":"worker"}');
insert into public.farms (id, owner_id, business_name, abn, contact_phone, postcode, verification_status) values
  ('f1616161-0000-0000-0000-000000000001', '16161616-0000-0000-0000-000000000001', 'Digest Farm', '51824753556', '0412345678', '4343', 'verified');
insert into public.worker_profiles (user_id, full_name, current_postcode) values
  ('16161616-0000-0000-0000-000000000011', 'Worker One', '4343'),
  ('16161616-0000-0000-0000-000000000012', 'Worker Two', '4343');
insert into public.jobs (id, farm_id, title, role_type, postcode, start_date, end_date, workers_needed, pay_type, pay_rate_cents, hours_per_week) values
  ('a1616161-0000-0000-0000-000000000001', 'f1616161-0000-0000-0000-000000000001', 'Soon job', 'picking', '4343', current_date + 3, current_date + 20, 5, 'hourly', 3300, 38),
  ('a1616161-0000-0000-0000-000000000002', 'f1616161-0000-0000-0000-000000000001', 'Later job', 'packing', '4343', current_date + 60, current_date + 90, 5, 'hourly', 3400, 38);
insert into public.job_alerts (worker_id, region_ids) values
  ('16161616-0000-0000-0000-000000000011', '{}'),
  ('16161616-0000-0000-0000-000000000012', '{}');

-- ---------- Alert settings ----------
select is((select instant_top_matches from public.job_alerts where worker_id = '16161616-0000-0000-0000-000000000011'), true,
  'instant alerts for great matches are on by default');

-- ---------- Availability ----------
select is((select count(*)::int from public.job_alert_recipients('a1616161-0000-0000-0000-000000000002') where worker_id::text like '16161616%'), 2,
  'workers with no availability dates hear about any job');
insert into public.worker_availability (worker_id, start_date, end_date) values
  ('16161616-0000-0000-0000-000000000011', current_date, current_date + 30);
select results_eq($$ select worker_id::text from public.job_alert_recipients('a1616161-0000-0000-0000-000000000002') where worker_id::text like '16161616%' $$,
  $$ values ('16161616-0000-0000-0000-000000000012') $$,
  'a job outside a worker''s available dates is skipped');
select is((select count(*)::int from public.job_alert_recipients('a1616161-0000-0000-0000-000000000001') where worker_id::text like '16161616%'), 2,
  'a job overlapping their dates still alerts them');

-- ---------- Queue and digest ----------
insert into public.job_alert_queue (worker_id, job_id, score) values
  ('16161616-0000-0000-0000-000000000011', 'a1616161-0000-0000-0000-000000000001', 70),
  ('16161616-0000-0000-0000-000000000012', 'a1616161-0000-0000-0000-000000000001', 50),
  ('16161616-0000-0000-0000-000000000012', 'a1616161-0000-0000-0000-000000000002', 75);
select pg_temp.act_as('16161616-0000-0000-0000-000000000011');
select throws_ok($$ select * from public.job_alert_queue $$, '42501', null, 'the app cannot read the alert queue');
select throws_ok($$ select * from public.take_job_alert_digests() $$, '42501', null, 'the app cannot take digests');
-- Worker One applies to the job before the digest: nothing left for them.
select public.swipe_job('a1616161-0000-0000-0000-000000000001', 'like');
select pg_temp.as_service();
create temp table digest as select * from public.take_job_alert_digests() where worker_id::text like '16161616%';
select results_eq($$ select worker_id::text, job_count, top_job_title, top_farm_name from digest $$,
  $$ values ('16161616-0000-0000-0000-000000000012', 2, 'Later job', 'Digest Farm') $$,
  'one digest per worker, counting live jobs and naming the best match; swiped jobs dropped');
select is((select count(*)::int from public.job_alert_queue where worker_id::text like '16161616%'), 0, 'the digest empties the queue');
select is((select count(*)::int from public.take_job_alert_digests() where worker_id::text like '16161616%'), 0,
  'a second digest has nothing to send');
select pg_temp.as_dashboard();
select lives_ok($$ select public.send_job_alert_digest() $$, 'the daily digest job runs');

-- ---------- Notification settings ----------
select pg_temp.act_as('16161616-0000-0000-0000-000000000011');
select lives_ok($$ insert into public.notification_prefs (user_id, messages) values ('16161616-0000-0000-0000-000000000011', false) $$,
  'user turns off message notifications');
select pg_temp.act_as('16161616-0000-0000-0000-000000000012');
select is((select count(*)::int from public.notification_prefs), 0, 'others cannot see my notification settings');
select throws_ok($$ insert into public.notification_prefs (user_id) values ('16161616-0000-0000-0000-000000000011') $$,
  '42501', null, 'cannot change someone else''s settings');

select * from finish();
rollback;
