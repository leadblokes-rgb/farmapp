begin;
select plan(26);

create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_dashboard() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

-- Fixtures: a verified farm, a pending farm, two workers (one without a profile).
insert into auth.users (id, email, raw_user_meta_data) values
  ('cccccccc-0000-0000-0000-000000000001', 'vf@test.local', '{"role":"farm"}'),
  ('cccccccc-0000-0000-0000-000000000002', 'pf@test.local', '{"role":"farm"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'w1@test.local', '{"role":"worker"}'),
  ('cccccccc-0000-0000-0000-000000000004', 'w2@test.local', '{"role":"worker"}');
insert into public.farms (id, owner_id, business_name, abn, contact_phone, postcode, verification_status) values
  ('fccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'Verified Co', '51824753556', '0412345678', '4343', 'verified'),
  ('fccccccc-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000002', 'Pending Co', '53004085616', '0412345678', '4670', 'pending');
insert into public.worker_profiles (user_id, full_name, current_postcode) values ('cccccccc-0000-0000-0000-000000000003', 'Worker One', '4343');
-- A job on the pending farm, created directly (as if it existed before re-verification).
insert into public.jobs (id, farm_id, title, role_type, postcode, start_date, end_date, workers_needed, pay_type, pay_rate_cents, hours_per_week)
values ('acccccc0-0000-0000-0000-000000000009', 'fccccccc-0000-0000-0000-000000000002', 'Hidden job', 'picking', '4670',
        current_date + 1, current_date + 30, 5, 'hourly', 3300, 38);

-- ---------- Posting ----------
select pg_temp.act_as('cccccccc-0000-0000-0000-000000000001');
select lives_ok($$ insert into public.jobs (id, farm_id, title, role_type, postcode, start_date, end_date, workers_needed,
    pay_type, pay_rate_cents, hours_per_week, accommodation_provided)
  values ('acccccc0-0000-0000-0000-000000000001', 'fccccccc-0000-0000-0000-000000000001', 'Pickers', 'picking', '4343',
          current_date + 1, current_date + 30, 10, 'hourly', 3300, 38, true) $$, 'verified farm can post a job');
select is((select region_id from public.jobs where id = 'acccccc0-0000-0000-0000-000000000001'), 'lockyer-valley',
  'location and region are filled from the postcode');
select throws_ok($$ insert into public.jobs (farm_id, title, role_type, postcode, start_date, end_date, workers_needed,
    pay_type, pay_rate_cents, hours_per_week)
  values ('fccccccc-0000-0000-0000-000000000001', 'Piece work', 'picking', '4343', current_date, current_date + 5, 5,
          'piece_rate', 400, 38) $$, '23514', null, 'piece-rate job must state a guaranteed hourly minimum');
select lives_ok($$ insert into public.jobs (id, farm_id, title, role_type, postcode, start_date, end_date, workers_needed,
    pay_type, pay_rate_cents, piece_rate_unit, min_hourly_guarantee_cents, hours_per_week)
  values ('acccccc0-0000-0000-0000-000000000002', 'fccccccc-0000-0000-0000-000000000001', 'Piece work', 'picking', '9999',
          current_date, current_date + 5, 5, 'piece_rate', 400, 'bin', 3218, 38) $$,
  'piece-rate job with guarantee is accepted (unknown postcode allowed)');
select is((select count(*)::int from public.jobs where farm_id = 'fccccccc-0000-0000-0000-000000000002'), 0,
  'a farm cannot see another farm''s jobs');

select pg_temp.act_as('cccccccc-0000-0000-0000-000000000002');
select throws_ok($$ insert into public.jobs (farm_id, title, role_type, postcode, start_date, end_date, workers_needed,
    pay_type, pay_rate_cents, hours_per_week)
  values ('fccccccc-0000-0000-0000-000000000002', 'Nope', 'picking', '4670', current_date, current_date + 5, 5, 'hourly', 3300, 38) $$,
  '42501', null, 'pending farm cannot post jobs');
select throws_ok($$ insert into public.jobs (farm_id, title, role_type, postcode, start_date, end_date, workers_needed,
    pay_type, pay_rate_cents, hours_per_week)
  values ('fccccccc-0000-0000-0000-000000000001', 'Hijack', 'picking', '4670', current_date, current_date + 5, 5, 'hourly', 3300, 38) $$,
  '42501', null, 'cannot post a job for someone else''s farm');

-- ---------- Worker visibility & feed ----------
select pg_temp.act_as('cccccccc-0000-0000-0000-000000000003');
select ok((select count(*) from public.jobs where id = 'acccccc0-0000-0000-0000-000000000001') = 1, 'worker sees open job from verified farm');
select is((select count(*)::int from public.jobs where id = 'acccccc0-0000-0000-0000-000000000009'), 0, 'worker cannot see a pending farm''s job');
select ok((select count(*) from public.job_feed() where id = 'acccccc0-0000-0000-0000-000000000001') = 1, 'job is in the feed');
select is((select count(*)::int from public.job_feed(p_min_hourly_cents => 3400) where id in ('acccccc0-0000-0000-0000-000000000001', 'acccccc0-0000-0000-0000-000000000002')), 0,
  'min pay filter uses the hourly rate / guarantee');
select is((select count(*)::int from public.job_feed(p_accommodation_only => true) where id = 'acccccc0-0000-0000-0000-000000000002'), 0,
  'accommodation filter excludes jobs without accommodation');
select is((select count(*)::int from public.job_feed(p_region_ids => array['bundaberg']) where id = 'acccccc0-0000-0000-0000-000000000001'), 0,
  'region filter works');
select is((select count(*)::int from public.job_feed(p_from => current_date + 40) where id = 'acccccc0-0000-0000-0000-000000000001'), 0,
  'date filter excludes jobs that end before the chosen dates');

-- ---------- Swiping ----------
select isnt(public.swipe_job('acccccc0-0000-0000-0000-000000000001', 'like'), null, 'right swipe returns an application');
select is((select status::text from public.applications where job_id = 'acccccc0-0000-0000-0000-000000000001'), 'applied', 'application created');
select is((select count(*)::int from public.job_feed() where id = 'acccccc0-0000-0000-0000-000000000001'), 0, 'swiped job leaves the feed');
select is(public.swipe_job('acccccc0-0000-0000-0000-000000000002', 'pass'), null, 'left swipe creates no application');
select throws_ok($$ select public.swipe_job('acccccc0-0000-0000-0000-000000000009', 'like') $$, 'P0002', null,
  'cannot apply to a job you cannot see');
select throws_ok($$ insert into public.applications (job_id, worker_id) values ('acccccc0-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003') $$,
  '42501', null, 'applications cannot be inserted directly');
select lives_ok($$ select public.undo_swipe('acccccc0-0000-0000-0000-000000000002') $$, 'undo a pass');
select ok((select count(*) from public.job_feed() where id = 'acccccc0-0000-0000-0000-000000000002') = 1, 'undone job returns to the feed');

select pg_temp.act_as('cccccccc-0000-0000-0000-000000000004');
select throws_ok($$ select public.swipe_job('acccccc0-0000-0000-0000-000000000001', 'like') $$, 'P0001', null,
  'worker without a profile cannot apply');
select is((select count(*)::int from public.applications), 0, 'workers cannot see others'' applications');

-- Farm sees its applicants
select pg_temp.act_as('cccccccc-0000-0000-0000-000000000001');
select is((select count(*)::int from public.applications), 1, 'farm sees applications to its own jobs');

-- After the farm decides, the worker can no longer undo
select pg_temp.as_dashboard();
update public.applications set status = 'accepted' where job_id = 'acccccc0-0000-0000-0000-000000000001';
select pg_temp.act_as('cccccccc-0000-0000-0000-000000000003');
select throws_ok($$ select public.undo_swipe('acccccc0-0000-0000-0000-000000000001') $$, 'P0001', null,
  'cannot undo once the farm has responded');

select pg_temp.as_dashboard();
select * from finish();
rollback;
