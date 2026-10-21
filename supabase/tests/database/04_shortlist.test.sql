begin;
select plan(17);

create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_dashboard() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('dddddddd-0000-0000-0000-000000000001', 'farmA@test.local', '{"role":"farm"}'),
  ('dddddddd-0000-0000-0000-000000000002', 'farmB@test.local', '{"role":"farm"}'),
  ('dddddddd-0000-0000-0000-000000000003', 'w1@test.local', '{"role":"worker"}'),
  ('dddddddd-0000-0000-0000-000000000004', 'w2@test.local', '{"role":"worker"}'),
  ('dddddddd-0000-0000-0000-000000000005', 'w3@test.local', '{"role":"worker"}');
insert into public.farms (id, owner_id, business_name, abn, contact_phone, postcode, verification_status) values
  ('fddddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 'Farm A', '51824753556', '0412345678', '4343', 'verified'),
  ('fddddddd-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000002', 'Farm B', '53004085616', '0412345678', '4670', 'verified');
insert into public.jobs (id, farm_id, title, role_type, postcode, start_date, end_date, workers_needed, pay_type, pay_rate_cents, hours_per_week) values
  ('addddddd-0000-0000-0000-000000000001', 'fddddddd-0000-0000-0000-000000000001', 'Job A', 'picking', '4343', current_date + 1, current_date + 100, 2, 'hourly', 3300, 38),
  ('addddddd-0000-0000-0000-000000000002', 'fddddddd-0000-0000-0000-000000000002', 'Job B', 'picking', '4670', current_date + 1, current_date + 30, 2, 'hourly', 3300, 38);
insert into public.worker_profiles (user_id, full_name, current_postcode) values
  ('dddddddd-0000-0000-0000-000000000003', 'Ana Applicant', '4343'),
  ('dddddddd-0000-0000-0000-000000000004', 'Ben Applicant', '4343'),
  ('dddddddd-0000-0000-0000-000000000005', 'Cara Elsewhere', '4670');
insert into public.worker_private (user_id, nationality, visa_type, visa_expiry) values
  ('dddddddd-0000-0000-0000-000000000003', 'GB', '417', current_date + 365),
  ('dddddddd-0000-0000-0000-000000000004', 'FR', '417', current_date + 50),
  ('dddddddd-0000-0000-0000-000000000005', 'DE', '417', current_date + 365);
insert into public.applications (id, job_id, worker_id) values
  ('aaaa0000-0000-0000-0000-000000000001', 'addddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000003'),
  ('aaaa0000-0000-0000-0000-000000000002', 'addddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000004'),
  ('aaaa0000-0000-0000-0000-000000000003', 'addddddd-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000005');

-- ---------- Farm access to applicants ----------
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000001');
select is((select count(*)::int from public.worker_profiles), 2, 'farm sees profiles of its own applicants only');
select is((select count(*)::int from public.worker_private), 0, 'farm still cannot read private visa details');
select is((select count(*)::int from public.job_shortlist('addddddd-0000-0000-0000-000000000001')), 2, 'shortlist lists the job''s applicants');
select is((select count(*)::int from public.job_shortlist('addddddd-0000-0000-0000-000000000002')), 0, 'shortlist of another farm''s job is empty');
select is((select visa_valid_through_job_end from public.applicant_visa_summary('aaaa0000-0000-0000-0000-000000000001')), true,
  'visa that outlasts the job -> yes');
select is((select visa_valid_through_job_end from public.applicant_visa_summary('aaaa0000-0000-0000-0000-000000000002')), false,
  'visa that ends before the job ends -> no');
select is((select count(*)::int from public.applicant_visa_summary('aaaa0000-0000-0000-0000-000000000003')), 0,
  'no visa answer for other farms'' applicants');

-- ---------- Decisions ----------
select throws_ok($$ select public.decide_applications(array['aaaa0000-0000-0000-0000-000000000003'::uuid], 'accepted') $$,
  '42501', null, 'cannot decide on another farm''s applications');
select is(public.decide_applications(array['aaaa0000-0000-0000-0000-000000000001'::uuid, 'aaaa0000-0000-0000-0000-000000000002'::uuid], 'accepted'),
  2, 'bulk accept updates both');
select is(public.decide_applications(array['aaaa0000-0000-0000-0000-000000000001'::uuid], 'accepted'), 0, 'accepting twice is a no-op');
select is(public.decide_applications(array['aaaa0000-0000-0000-0000-000000000002'::uuid], 'declined'), 1, 'an accepted worker can be declined');
select is(public.decide_applications(array['aaaa0000-0000-0000-0000-000000000002'::uuid], 'accepted'), 0, 'a declined worker is not silently re-accepted');
select throws_ok($$ select public.decide_applications(array['aaaa0000-0000-0000-0000-000000000001'::uuid], 'withdrawn') $$,
  '22023', null, 'only accept/decline are allowed');

-- Worker sees the decision
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000003');
select is((select status::text from public.applications where id = 'aaaa0000-0000-0000-0000-000000000001'), 'accepted', 'worker sees acceptance');
select is((select count(*)::int from public.worker_profiles), 1, 'workers still only see their own profile');

-- ---------- Groups ----------
select lives_ok($$ select set_config('test.code', public.create_group(), true) $$, 'worker creates a group');
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000004');
select public.join_group(current_setting('test.code'));
select is((select count(*)::int from public.my_group()), 2, 'joined group lists both members');

select pg_temp.as_dashboard();
select * from finish();
rollback;
