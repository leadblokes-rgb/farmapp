begin;
select plan(4);

create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
select set_config('croppr.skip_notifications', 'on', true);

insert into auth.users (id, email, raw_user_meta_data) values
  ('14141414-0000-0000-0000-000000000001', 'farmA@cv.local', '{"role":"farm"}'),
  ('14141414-0000-0000-0000-000000000002', 'farmB@cv.local', '{"role":"farm"}'),
  ('14141414-0000-0000-0000-000000000011', 'w@cv.local', '{"role":"worker"}');
insert into public.farms (id, owner_id, business_name, abn, contact_phone, postcode, verification_status) values
  ('f1414141-0000-0000-0000-000000000001', '14141414-0000-0000-0000-000000000001', 'Farm A', '51824753556', '0412345678', '4343', 'verified'),
  ('f1414141-0000-0000-0000-000000000002', '14141414-0000-0000-0000-000000000002', 'Farm B', '53004085616', '0412345678', '4343', 'verified');
insert into public.worker_profiles (user_id, full_name, current_postcode) values ('14141414-0000-0000-0000-000000000011', 'Wanda', '4343');
insert into public.jobs (id, farm_id, title, role_type, postcode, start_date, end_date, workers_needed, pay_type, pay_rate_cents, hours_per_week) values
  ('a1414141-0000-0000-0000-000000000001', 'f1414141-0000-0000-0000-000000000001', 'Job', 'picking', '4343', current_date + 3, current_date + 30, 5, 'hourly', 3300, 38);
insert into public.applications (job_id, worker_id) values ('a1414141-0000-0000-0000-000000000001', '14141414-0000-0000-0000-000000000011');

select pg_temp.act_as('14141414-0000-0000-0000-000000000011');
select lives_ok($$ insert into storage.objects (bucket_id, name, owner) values ('resumes', '14141414-0000-0000-0000-000000000011/cv.pdf', '14141414-0000-0000-0000-000000000011') $$,
  'worker uploads a resume to their own folder');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('resumes', '14141414-0000-0000-0000-000000000001/cv.pdf') $$,
  '42501', null, 'cannot upload into someone else''s folder');
select pg_temp.act_as('14141414-0000-0000-0000-000000000001');
select is((select count(*)::int from storage.objects where bucket_id = 'resumes'), 1, 'a farm the worker applied to can open it');
select pg_temp.act_as('14141414-0000-0000-0000-000000000002');
select is((select count(*)::int from storage.objects where bucket_id = 'resumes'), 0, 'other farms cannot');

select * from finish();
rollback;
