begin;
select plan(12);

create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_dashboard() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
select set_config('croppr.skip_notifications', 'on', true);

insert into auth.users (id, email, raw_user_meta_data) values
  ('10101010-0000-0000-0000-000000000001', 'farm@alerts.local', '{"role":"farm"}'),
  ('10101010-0000-0000-0000-000000000011', 'w1@alerts.local', '{"role":"worker"}'),
  ('10101010-0000-0000-0000-000000000012', 'w2@alerts.local', '{"role":"worker"}'),
  ('10101010-0000-0000-0000-000000000013', 'w3@alerts.local', '{"role":"worker"}');
insert into public.farms (id, owner_id, business_name, abn, contact_phone, postcode, verification_status) values
  ('f1010101-0000-0000-0000-000000000001', '10101010-0000-0000-0000-000000000001', 'Alert Farm', '51824753556', '0412345678', '4343', 'verified');
insert into public.worker_profiles (user_id, full_name, current_postcode) values
  ('10101010-0000-0000-0000-000000000011', 'One', '4343'),
  ('10101010-0000-0000-0000-000000000012', 'Two', '4343'),
  ('10101010-0000-0000-0000-000000000013', 'Three', '4343');
insert into public.jobs (id, farm_id, title, role_type, postcode, start_date, end_date, workers_needed, pay_type, pay_rate_cents, hours_per_week) values
  ('a1010101-0000-0000-0000-000000000001', 'f1010101-0000-0000-0000-000000000001', 'Saved job', 'picking', '4343', current_date + 3, current_date + 30, 5, 'hourly', 3300, 38);

-- ---------- Postcodes ----------
select ok(public.is_specified_work_postcode('4343', '417'), 'Gatton is eligible for 417');
select ok(not public.is_specified_work_postcode('4000', '462'), 'Brisbane CBD is not eligible');

-- ---------- Saved jobs ----------
select pg_temp.act_as('10101010-0000-0000-0000-000000000011');
select lives_ok($$ insert into public.saved_jobs (worker_id, job_id) values ('10101010-0000-0000-0000-000000000011', 'a1010101-0000-0000-0000-000000000001') $$,
  'worker saves a job');
select is((select count(*)::int from public.job_feed() where id = 'a1010101-0000-0000-0000-000000000001'), 0, 'a saved job leaves the feed');
select is((select count(*)::int from public.job_feed(p_saved_only => true)), 1, 'it shows in the saved list');
select pg_temp.act_as('10101010-0000-0000-0000-000000000012');
select is((select count(*)::int from public.saved_jobs), 0, 'other workers cannot see my saved jobs');
select throws_ok($$ insert into public.saved_jobs (worker_id, job_id) values ('10101010-0000-0000-0000-000000000011', 'a1010101-0000-0000-0000-000000000001') $$,
  '42501', null, 'cannot save for someone else');
select pg_temp.act_as('10101010-0000-0000-0000-000000000011');
select public.swipe_job('a1010101-0000-0000-0000-000000000001', 'like');
select is((select count(*)::int from public.saved_jobs), 0, 'applying removes it from saved');

-- ---------- Alerts ----------
select pg_temp.act_as('10101010-0000-0000-0000-000000000012');
select lives_ok($$ insert into public.job_alerts (worker_id, region_ids) values ('10101010-0000-0000-0000-000000000012', '{}') $$,
  'worker turns on alerts');
select pg_temp.act_as('10101010-0000-0000-0000-000000000013');
insert into public.job_alerts (worker_id, region_ids, min_hourly_cents) values ('10101010-0000-0000-0000-000000000013', '{}', 4000);
select pg_temp.as_dashboard();
insert into public.job_alerts (worker_id, region_ids) values ('10101010-0000-0000-0000-000000000011', '{}');
select results_eq($$ select worker_id::text from public.job_alert_recipients('a1010101-0000-0000-0000-000000000001') where worker_id::text like '10101010%' $$,
  $$ values ('10101010-0000-0000-0000-000000000012') $$,
  'alerts skip workers who already applied and jobs below their minimum pay');
insert into public.notification_log (event, recipient_id, outcome)
select 'job_alert_instant', '10101010-0000-0000-0000-000000000012', 'sent' from generate_series(1, 3);
select is((select count(*)::int from public.job_alert_recipients('a1010101-0000-0000-0000-000000000001') where worker_id::text like '10101010%'), 1,
  'no daily cap on recipients: jobs past the instant cap go to the digest');
select pg_temp.act_as('10101010-0000-0000-0000-000000000012');
select throws_ok($$ select * from public.job_alert_recipients('a1010101-0000-0000-0000-000000000001') $$,
  '42501', null, 'the app cannot list alert recipients');

select * from finish();
rollback;
