begin;
select plan(8);

create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_dashboard() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
select set_config('croppr.skip_notifications', 'on', true);

insert into auth.users (id, email, raw_user_meta_data) values
  ('ffffffff-0000-0000-0000-000000000001', 'w1@test.local', '{"role":"worker"}'),
  ('ffffffff-0000-0000-0000-000000000002', 'w2@test.local', '{"role":"worker"}'),
  ('ffffffff-0000-0000-0000-000000000003', 'farm@test.local', '{"role":"farm"}');
insert into public.worker_profiles (user_id, full_name, current_postcode) values
  ('ffffffff-0000-0000-0000-000000000001', 'One', '4343'), ('ffffffff-0000-0000-0000-000000000002', 'Two', '4343');

select pg_temp.act_as('ffffffff-0000-0000-0000-000000000001');
select lives_ok($$ insert into public.employers_worked (id, worker_id, name, postcode)
  values ('ef000000-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001', 'Some Farm', '4343') $$, 'worker adds an employer');
select lives_ok($$ insert into public.shift_logs (worker_id, employer_id, work_date, hours)
  values ('ffffffff-0000-0000-0000-000000000001', 'ef000000-0000-0000-0000-000000000001', current_date, 8) $$, 'worker logs a shift');
select throws_ok($$ insert into public.shift_logs (worker_id, employer_id, work_date, hours)
  values ('ffffffff-0000-0000-0000-000000000001', 'ef000000-0000-0000-0000-000000000001', current_date, 4) $$,
  '23505', null, 'one shift per employer per day');
select throws_ok($$ insert into public.payslips (worker_id, employer_id, period_start, period_end, days_worked, hours_total)
  values ('ffffffff-0000-0000-0000-000000000001', 'ef000000-0000-0000-0000-000000000001', current_date - 6, current_date, 9, 60) $$,
  '23514', null, 'days worked cannot exceed the pay period');

select pg_temp.act_as('ffffffff-0000-0000-0000-000000000002');
select is((select count(*)::int from public.shift_logs), 0, 'another worker cannot see my shifts');
select throws_ok($$ insert into public.shift_logs (worker_id, employer_id, work_date, hours)
  values ('ffffffff-0000-0000-0000-000000000002', 'ef000000-0000-0000-0000-000000000001', current_date - 1, 8) $$,
  '42501', null, 'cannot log shifts against someone else''s employer');

select pg_temp.act_as('ffffffff-0000-0000-0000-000000000003');
select is((select count(*)::int from public.employers_worked), 0, 'farms never see a worker''s day tracker');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('payslips', 'ffffffff-0000-0000-0000-000000000001/x.pdf') $$,
  '42501', null, 'cannot upload into another user''s payslip folder');

select pg_temp.as_dashboard();
select * from finish();
rollback;
