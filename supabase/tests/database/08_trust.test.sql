begin;
select plan(37);

create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_dashboard() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
select set_config('croppr.skip_notifications', 'on', true);

-- Farm A (owner ...01) and Farm B (...02); workers W1..W4.
insert into auth.users (id, email, raw_user_meta_data) values
  ('88888888-0000-0000-0000-000000000001', 'farmA@trust.local', '{"role":"farm"}'),
  ('88888888-0000-0000-0000-000000000002', 'farmB@trust.local', '{"role":"farm"}'),
  ('88888888-0000-0000-0000-000000000011', 'w1@trust.local', '{"role":"worker"}'),
  ('88888888-0000-0000-0000-000000000012', 'w2@trust.local', '{"role":"worker"}'),
  ('88888888-0000-0000-0000-000000000013', 'w3@trust.local', '{"role":"worker"}'),
  ('88888888-0000-0000-0000-000000000014', 'w4@trust.local', '{"role":"worker"}');
insert into public.farms (id, owner_id, business_name, abn, contact_phone, postcode, verification_status) values
  ('f8888888-0000-0000-0000-000000000001', '88888888-0000-0000-0000-000000000001', 'Farm A', '51824753556', '0412345678', '4343', 'verified'),
  ('f8888888-0000-0000-0000-000000000002', '88888888-0000-0000-0000-000000000002', 'Farm B', '53004085616', '0412345678', '4670', 'verified');
insert into public.worker_profiles (user_id, full_name, current_postcode) values
  ('88888888-0000-0000-0000-000000000011', 'Wendy One', '4343'),
  ('88888888-0000-0000-0000-000000000012', 'Will Two', '4343'),
  ('88888888-0000-0000-0000-000000000013', 'Wes Three', '4343'),
  ('88888888-0000-0000-0000-000000000014', 'Wren Four', '4343');
-- Ended job (A), running job (A), future job (A), job at farm B.
insert into public.jobs (id, farm_id, title, role_type, postcode, start_date, end_date, workers_needed, pay_type, pay_rate_cents, hours_per_week) values
  ('a8888888-0000-0000-0000-000000000001', 'f8888888-0000-0000-0000-000000000001', 'Ended job', 'picking', '4343', current_date - 20, current_date - 1, 5, 'hourly', 3300, 38),
  ('a8888888-0000-0000-0000-000000000002', 'f8888888-0000-0000-0000-000000000001', 'Running job', 'picking', '4343', current_date - 1, current_date + 30, 5, 'hourly', 3300, 38),
  ('a8888888-0000-0000-0000-000000000003', 'f8888888-0000-0000-0000-000000000001', 'Future job', 'picking', '4343', current_date + 5, current_date + 30, 5, 'hourly', 3300, 38);
insert into public.applications (id, job_id, worker_id, status) values
  ('a1888888-0000-0000-0000-000000000011', 'a8888888-0000-0000-0000-000000000001', '88888888-0000-0000-0000-000000000011', 'accepted'),
  ('a1888888-0000-0000-0000-000000000012', 'a8888888-0000-0000-0000-000000000001', '88888888-0000-0000-0000-000000000012', 'accepted'),
  ('a1888888-0000-0000-0000-000000000013', 'a8888888-0000-0000-0000-000000000001', '88888888-0000-0000-0000-000000000013', 'accepted'),
  ('a1888888-0000-0000-0000-000000000014', 'a8888888-0000-0000-0000-000000000001', '88888888-0000-0000-0000-000000000014', 'accepted'),
  ('a2888888-0000-0000-0000-000000000011', 'a8888888-0000-0000-0000-000000000002', '88888888-0000-0000-0000-000000000011', 'accepted'),
  ('a2888888-0000-0000-0000-000000000012', 'a8888888-0000-0000-0000-000000000002', '88888888-0000-0000-0000-000000000012', 'applied'),
  ('a3888888-0000-0000-0000-000000000011', 'a8888888-0000-0000-0000-000000000003', '88888888-0000-0000-0000-000000000011', 'accepted');

-- ---------- Check-in ----------
select pg_temp.act_as('88888888-0000-0000-0000-000000000002');
select throws_ok($$ select public.mark_attendance(array['a1888888-0000-0000-0000-000000000011'::uuid], 'showed') $$,
  '42501', null, 'another farm cannot check in my workers');

select pg_temp.act_as('88888888-0000-0000-0000-000000000011');
select throws_ok($$ select public.mark_attendance(array['a1888888-0000-0000-0000-000000000011'::uuid], 'showed') $$,
  '42501', null, 'a worker cannot mark their own attendance');

select pg_temp.act_as('88888888-0000-0000-0000-000000000001');
select throws_ok($$ select public.mark_attendance(array['a3888888-0000-0000-0000-000000000011'::uuid], 'showed') $$,
  '22023', null, 'cannot check in before the start date');
select throws_ok($$ select public.mark_attendance(array['a2888888-0000-0000-0000-000000000012'::uuid], 'showed') $$,
  '22023', null, 'only accepted workers can be checked in');
select is(public.mark_attendance(array['a2888888-0000-0000-0000-000000000011'::uuid], 'showed'), 1, 'farm checks in a worker on a running job');
select is(public.mark_attendance(array['a1888888-0000-0000-0000-000000000011'::uuid, 'a1888888-0000-0000-0000-000000000012'::uuid], 'showed'), 2,
  'bulk check-in');
select is(public.mark_attendance(array['a1888888-0000-0000-0000-000000000013'::uuid], 'left_early'), 1, 'mark left early');
select is(public.mark_attendance(array['a1888888-0000-0000-0000-000000000014'::uuid], 'no_show'), 1, 'mark no-show');

-- ---------- Completion ----------
select is(public.complete_finished_jobs(), 4, 'every accepted worker on an ended job becomes "ended"');
-- Both sides say W1 and W2 worked it (see 15_work_outcomes for every combination).
select pg_temp.act_as('88888888-0000-0000-0000-000000000011');
select public.answer_work_outcome('a1888888-0000-0000-0000-000000000011', 'worked');
select pg_temp.act_as('88888888-0000-0000-0000-000000000012');
select public.answer_work_outcome('a1888888-0000-0000-0000-000000000012', 'worked');
select pg_temp.act_as('88888888-0000-0000-0000-000000000001');
select public.answer_work_outcome('a1888888-0000-0000-0000-000000000011', 'worked');
select public.answer_work_outcome('a1888888-0000-0000-0000-000000000012', 'worked');
select pg_temp.as_dashboard();
select results_eq(
  $$ select worker_id::text, status::text from public.applications where job_id = 'a8888888-0000-0000-0000-000000000001' order by worker_id $$,
  $$ values ('88888888-0000-0000-0000-000000000011', 'completed'), ('88888888-0000-0000-0000-000000000012', 'completed'),
            ('88888888-0000-0000-0000-000000000013', 'ended'), ('88888888-0000-0000-0000-000000000014', 'ended') $$,
  'confirmed workers complete; the rest wait for answers');
select is((select status::text from public.applications where id = 'a2888888-0000-0000-0000-000000000011'), 'accepted',
  'a running job does not complete');

-- ---------- No-show dispute ----------
select pg_temp.as_dashboard();
select is((select no_show_count from public.worker_reputation(array['88888888-0000-0000-0000-000000000014'::uuid])), 1,
  'an undisputed no-show counts');
select pg_temp.act_as('88888888-0000-0000-0000-000000000013');
select throws_ok($$ select public.dispute_no_show('a1888888-0000-0000-0000-000000000014', 'not mine') $$,
  '42501', null, 'cannot dispute someone else''s no-show');
select throws_ok($$ select public.dispute_no_show('a1888888-0000-0000-0000-000000000013', 'I did not leave early') $$,
  '22023', null, 'only a no-show can be disputed');
select pg_temp.act_as('88888888-0000-0000-0000-000000000014');
select isnt(public.dispute_no_show('a1888888-0000-0000-0000-000000000014', 'I was there, ask the supervisor'), null,
  'worker disputes a no-show');
select throws_ok($$ select public.dispute_no_show('a1888888-0000-0000-0000-000000000014', 'again') $$,
  '23505', null, 'a no-show can only be disputed once');
select pg_temp.act_as('88888888-0000-0000-0000-000000000001');
select throws_ok($$ select public.mark_attendance(array['a1888888-0000-0000-0000-000000000014'::uuid], 'showed') $$,
  '22023', null, 'the farm cannot change a disputed no-show');
select pg_temp.as_dashboard();
select is((select reason::text from public.reports where id = (select dispute_report_id from public.attendance where application_id = 'a1888888-0000-0000-0000-000000000014')),
  'no_show_dispute', 'the dispute is in the reports queue');
select is((select no_show_count from public.worker_reputation(array['88888888-0000-0000-0000-000000000014'::uuid])), 0,
  'a disputed no-show does not count until resolved');
select public.admin_resolve_no_show_dispute(
  (select dispute_report_id from public.attendance where application_id = 'a1888888-0000-0000-0000-000000000014'), 'upheld', 'farm had sign-in sheet');
select is((select no_show_count from public.worker_reputation(array['88888888-0000-0000-0000-000000000014'::uuid])), 1,
  'an upheld no-show counts');

-- ---------- Ratings: who can rate ----------
select pg_temp.act_as('88888888-0000-0000-0000-000000000014');
select throws_ok($$ select public.rate_farm('a1888888-0000-0000-0000-000000000014', 1, false) $$,
  '42501', null, 'a no-show cannot rate the farm');
select pg_temp.act_as('88888888-0000-0000-0000-000000000011');
select throws_ok($$ select public.rate_farm('a2888888-0000-0000-0000-000000000011', 5, true) $$,
  '42501', null, 'cannot rate a farm before finishing');
select lives_ok($$ select public.rate_farm('a1888888-0000-0000-0000-000000000011', 4, true, null, 'Good crew boss') $$,
  'worker rates the farm after completing');
select throws_ok($$ select public.rate_farm('a1888888-0000-0000-0000-000000000011', 1, false) $$,
  '23505', null, 'ratings cannot be changed');
select is((select count(*)::int from public.pending_reviews()), 0, 'nothing left for the worker to rate');

-- ---------- Ratings: blind until both sides rate ----------
select pg_temp.act_as('88888888-0000-0000-0000-000000000001');
select is((select count(*)::int from public.farm_ratings), 0, 'the farm cannot read the worker''s rating directly');
select is((select count(*)::int from public.farm_reviews('f8888888-0000-0000-0000-000000000001')), 0,
  'the farm review stays hidden until the farm rates too');
select is((select count(*)::int from public.pending_reviews()), 3, 'farm has 3 workers to rate (2 completed + 1 left early)');
select throws_ok($$ select public.rate_worker('a1888888-0000-0000-0000-000000000014', 1, 1) $$,
  '42501', null, 'a no-show worker is not rated (the no-show already counts)');
select lives_ok($$ select public.rate_worker('a1888888-0000-0000-0000-000000000011', 5, 4, 'Reliable') $$, 'farm rates the worker');
select is((select count(*)::int from public.farm_reviews('f8888888-0000-0000-0000-000000000001')), 1,
  'both sides rated: the farm review is revealed');
select is((select rating_avg from public.farms_public where id = 'f8888888-0000-0000-0000-000000000001'), 4.0,
  'farm average includes revealed ratings');

-- Worker reviews: visible to farms the worker applied to, not to other farms.
select pg_temp.act_as('88888888-0000-0000-0000-000000000002');
select is((select count(*)::int from public.worker_reviews('88888888-0000-0000-0000-000000000011')), 0,
  'other farms cannot see a worker''s reviews');

-- One-sided rating revealed after 14 days.
select pg_temp.act_as('88888888-0000-0000-0000-000000000012');
select public.rate_farm('a1888888-0000-0000-0000-000000000012', 2, false, null, 'Late pay');
select pg_temp.as_dashboard();
update public.applications set completed_at = now() - interval '15 days' where id = 'a1888888-0000-0000-0000-000000000012';
select pg_temp.act_as('88888888-0000-0000-0000-000000000013');
select is((select count(*)::int from public.farm_reviews('f8888888-0000-0000-0000-000000000001')), 2,
  'a one-sided rating is revealed 14 days after the job');

-- ---------- Report a review ----------
select isnt(public.report_review('farm', 'a1888888-0000-0000-0000-000000000012', 'This is not true'), null, 'anyone can report a visible farm review');
select pg_temp.as_dashboard();
select is((select target_user_id::text || '|' || reason::text from public.reports where review_application_id = 'a1888888-0000-0000-0000-000000000012'),
  '88888888-0000-0000-0000-000000000012|inappropriate_review', 'the report targets the review''s author');
select public.admin_hide_review('farm', 'a1888888-0000-0000-0000-000000000012', 'Reported, unverifiable');
select is((select rating_count from public.farms_public where id = 'f8888888-0000-0000-0000-000000000001'), 1,
  'a hidden review leaves the average');

select * from finish();
rollback;
