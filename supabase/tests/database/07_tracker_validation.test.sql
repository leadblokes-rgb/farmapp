begin;
select plan(8);

create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
select set_config('croppr.skip_notifications', 'on', true);

insert into auth.users (id, email, raw_user_meta_data) values
  ('ffffffff-0000-0000-0000-000000000071', 'tv@test.local', '{"role":"worker"}');
insert into public.worker_profiles (user_id, full_name, current_postcode) values
  ('ffffffff-0000-0000-0000-000000000071', 'Val', '4343');

select pg_temp.act_as('ffffffff-0000-0000-0000-000000000071');
insert into public.employers_worked (id, worker_id, name, postcode)
  values ('ef000000-0000-0000-0000-000000000071', 'ffffffff-0000-0000-0000-000000000071', 'Some Farm', '4343');

select throws_ok($$ insert into public.shift_logs (worker_id, employer_id, work_date, hours)
  values ('ffffffff-0000-0000-0000-000000000071', 'ef000000-0000-0000-0000-000000000071', current_date + 2, 8) $$,
  '23514', null, 'shifts cannot be in the future');
select lives_ok($$ insert into public.shift_logs (worker_id, employer_id, work_date, hours)
  values ('ffffffff-0000-0000-0000-000000000071', 'ef000000-0000-0000-0000-000000000071', current_date + 1, 8) $$,
  'one day of slack allows for timezones');
select throws_ok($$ insert into public.shift_logs (worker_id, employer_id, work_date, hours)
  values ('ffffffff-0000-0000-0000-000000000071', 'ef000000-0000-0000-0000-000000000071', current_date - 3, 24.5) $$,
  '23514', null, 'a shift is at most 24 hours');
select throws_ok($$ insert into public.payslips (worker_id, employer_id, period_start, period_end, days_worked, hours_total)
  values ('ffffffff-0000-0000-0000-000000000071', 'ef000000-0000-0000-0000-000000000071', current_date - 6, current_date + 7, 5, 40) $$,
  '23514', null, 'pay periods cannot end in the future');
select throws_ok($$ insert into public.payslips (worker_id, employer_id, period_start, period_end, days_worked, hours_total)
  values ('ffffffff-0000-0000-0000-000000000071', 'ef000000-0000-0000-0000-000000000071', current_date - 31, current_date, 20, 150) $$,
  '23514', null, 'pay periods are at most 31 days');
select throws_ok($$ insert into public.payslips (worker_id, employer_id, period_start, period_end, days_worked, hours_total)
  values ('ffffffff-0000-0000-0000-000000000071', 'ef000000-0000-0000-0000-000000000071', current_date - 13, current_date, 2, 49) $$,
  '23514', null, 'hours cannot exceed 24 per day worked');
select lives_ok($$ insert into public.payslips (worker_id, employer_id, period_start, period_end, days_worked, hours_total)
  values ('ffffffff-0000-0000-0000-000000000071', 'ef000000-0000-0000-0000-000000000071', current_date - 13, current_date, 10, 76) $$,
  'a normal fortnightly payslip is accepted');

select throws_ok($$ insert into public.payslips (worker_id, employer_id, period_start, period_end, days_worked, hours_total)
  values ('ffffffff-0000-0000-0000-000000000071', 'ef000000-0000-0000-0000-000000000071', current_date - 20, current_date - 14, 0, 0) $$,
  '23514', null, 'a payslip needs at least one day and some hours');

select * from finish();
rollback;
