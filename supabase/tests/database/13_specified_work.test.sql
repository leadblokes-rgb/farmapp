begin;
select plan(14);

create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_dashboard() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
select set_config('croppr.skip_notifications', 'on', true);

-- ---------- Lookups ----------
select is(public.specified_work_label('4343', 'picking', '417'), 'plant & animal cultivation', 'Gatton picking is on the 417 list');
select is(public.specified_work_label('4000', 'picking', '462'), null, 'Brisbane CBD is not on the list');

insert into auth.users (id, email, raw_user_meta_data) values
  ('13131313-0000-0000-0000-000000000001', 'farm@sw.local', '{"role":"farm"}'),
  ('13131313-0000-0000-0000-000000000011', 'whm@sw.local', '{"role":"worker"}'),
  ('13131313-0000-0000-0000-000000000012', 'local@sw.local', '{"role":"worker"}');
insert into public.farms (id, owner_id, business_name, abn, contact_phone, postcode, verification_status) values
  ('f1313131-0000-0000-0000-000000000001', '13131313-0000-0000-0000-000000000001', 'SW Farm', '51824753556', '0412345678', '4343', 'verified');
insert into public.worker_profiles (user_id, full_name, current_postcode) values
  ('13131313-0000-0000-0000-000000000011', 'Whm', '4343'), ('13131313-0000-0000-0000-000000000012', 'Local', '4000');
insert into public.worker_private (user_id, nationality, visa_type, visa_expiry) values
  ('13131313-0000-0000-0000-000000000011', 'GB', '417', current_date + 300),
  ('13131313-0000-0000-0000-000000000012', 'AU', 'citizen_pr', null);

-- ---------- Jobs are tagged automatically ----------
insert into public.jobs (id, farm_id, title, role_type, postcode, start_date, end_date, workers_needed, pay_type, pay_rate_cents, hours_per_week, likely_specified_work) values
  ('a1313131-0000-0000-0000-000000000001', 'f1313131-0000-0000-0000-000000000001', 'City packing', 'packing', '4000', current_date + 3, current_date + 30, 5, 'hourly', 3300, 38, true);
select is((select eligible_417::text || eligible_462::text from public.jobs where id = 'a1313131-0000-0000-0000-000000000001'),
  'falsefalse', 'a job outside the list is not eligible');
update public.jobs set postcode = '4343' where id = 'a1313131-0000-0000-0000-000000000001';
select is((select eligible_417::text || eligible_462::text from public.jobs where id = 'a1313131-0000-0000-0000-000000000001'),
  'truetrue', 'moving the job into an eligible postcode re-tags it');

-- ---------- Feed shows eligibility for the viewer's own visa ----------
select pg_temp.act_as('13131313-0000-0000-0000-000000000011');
select is((select viewer_visa_subclass || '|' || specified_work_eligible || '|' || specified_work_label
           from public.job_feed() where id = 'a1313131-0000-0000-0000-000000000001'),
  '417|true|plant & animal cultivation', 'a 417 worker sees the job is eligible for their visa');
select is((select my_visa_subclass || '|' || eligible_417 from public.specified_work_check('4343')), '417|true',
  'the form check knows the worker''s visa');
select throws_ok($$ insert into public.specified_work_lists (category, visa_subclass, label, version, last_checked, source_url)
  values ('x', '417', 'x', 'x', current_date, 'x') $$, '42501', null, 'app users cannot change the lists');

select pg_temp.act_as('13131313-0000-0000-0000-000000000012');
select is((select coalesce(specified_work_eligible::text, 'n/a') from public.job_feed() where id = 'a1313131-0000-0000-0000-000000000001'),
  'n/a', 'no eligibility shown to workers who aren''t on a 417/462');

-- ---------- Tracker employers are tagged for the worker's visa ----------
select pg_temp.act_as('13131313-0000-0000-0000-000000000011');
insert into public.employers_worked (id, worker_id, name, postcode) values
  ('e1313131-0000-0000-0000-000000000001', '13131313-0000-0000-0000-000000000011', 'Farm', '4510'),
  ('e1313131-0000-0000-0000-000000000002', '13131313-0000-0000-0000-000000000011', 'Cafe', '4000');
select results_eq($$ select name, postcode_eligible from public.employers_worked order by name $$,
  $$ values ('Cafe', false), ('Farm', true) $$, 'employers are tagged from postcode and visa');
select pg_temp.as_dashboard();
update public.worker_private set visa_type = 'citizen_pr' where user_id = '13131313-0000-0000-0000-000000000011';
select is((select count(*)::int from public.employers_worked where worker_id = '13131313-0000-0000-0000-000000000011' and postcode_eligible is null),
  2, 'changing visa re-checks the worker''s employers');
update public.worker_private set visa_type = '417' where user_id = '13131313-0000-0000-0000-000000000011';

-- ---------- A new list version re-tags everything ----------
insert into public.specified_work_lists (category, visa_subclass, label, version, last_checked, source_url)
values ('plant_animal_cultivation', '417', 'plant & animal cultivation', '2027-test', current_date, 'https://example.test');
insert into public.specified_work_postcodes (list_id, postcode_from, postcode_to)
select id, 4500, 4599 from public.specified_work_lists where version = '2027-test';
select public.admin_activate_specified_work_list((select id from public.specified_work_lists where version = '2027-test'), 'test');
select is((select count(*)::int from public.specified_work_lists where is_current and visa_subclass = '417'), 1,
  'only one current list per visa');
select is((select eligible_417::text || eligible_462::text from public.jobs where id = 'a1313131-0000-0000-0000-000000000001'),
  'falsetrue', 'jobs are re-tagged when the 417 list changes (462 unchanged)');
select is((select postcode_eligible from public.employers_worked where id = 'e1313131-0000-0000-0000-000000000001'), true,
  'employers are re-tagged too (4510 is on the new list)');
select is(public.specified_work_label('4343', 'picking', '417'), null, '4343 is no longer on the new 417 list');

select * from finish();
rollback;
