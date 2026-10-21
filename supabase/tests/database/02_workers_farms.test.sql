begin;
select plan(28);

create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- Back to the dashboard/postgres context (no JWT), as admin tools run.
create or replace function pg_temp.as_dashboard() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'w1@test.local', '{"role":"worker"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'w2@test.local', '{"role":"worker"}'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'f1@test.local', '{"role":"farm"}'),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'f2@test.local', '{"role":"farm"}');

-- ---------- Workers ----------
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');
select lives_ok($$ select public.save_worker_profile('{
  "fullName":"Test Worker","currentPostcode":"4343","nationality":"GB","visaType":"417","visaExpiry":"2030-01-01",
  "travelMode":"solo","groupSize":1,"hasCar":true,"needsAccommodation":false,"skills":["picking"],
  "yearsExperience":1,"experienceSummary":"","regionIds":["lockyer-valley"],
  "availability":[{"startDate":"2030-01-01","endDate":"2030-02-01"}]}'::jsonb) $$, 'worker saves profile via RPC');
select is((select count(*)::int from public.worker_private), 1, 'worker reads own private row');
select is((select count(*)::int from public.worker_availability), 1, 'availability saved');
select lives_ok($$ select public.save_worker_profile('{
  "fullName":"Test Worker","currentPostcode":"4343","nationality":"GB","visaType":"417","visaExpiry":"2030-01-01",
  "travelMode":"solo","groupSize":1,"hasCar":true,"needsAccommodation":false,"skills":[],
  "yearsExperience":1,"experienceSummary":"","regionIds":["lockyer-valley","bundaberg"],
  "availability":[{"startDate":"2030-01-01","endDate":"2030-02-01"},{"startDate":"2030-05-01","endDate":"2030-06-01"}]}'::jsonb) $$,
  'saving again updates in place');
select is((select count(*)::int from public.worker_regions), 2, 'regions replaced, not duplicated');
select throws_ok($$ select public.save_worker_profile('{
  "fullName":"Test Worker","currentPostcode":"4343","nationality":"GB","visaType":"417","visaExpiry":null,
  "travelMode":"solo","groupSize":1,"hasCar":true,"needsAccommodation":false,"skills":[],
  "yearsExperience":1,"experienceSummary":"","regionIds":["lockyer-valley"],"availability":[]}'::jsonb) $$,
  '23514', null, 'working holiday visa needs an expiry date');

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.worker_profiles where user_id = 'bbbbbbbb-0000-0000-0000-000000000001'), 0,
  'another worker cannot see my profile');
select is((select count(*)::int from public.worker_private), 0, 'another worker cannot see my visa details');

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000003');
select is((select count(*)::int from public.worker_private), 0, 'a farm cannot see worker visa details');
select throws_ok($$ insert into public.worker_profiles (user_id, full_name, current_postcode)
  values ('bbbbbbbb-0000-0000-0000-000000000003', 'Farm Person', '4343') $$, '42501', null,
  'a farm account cannot create a worker profile');

-- ---------- Farms ----------
select throws_ok($$ insert into public.farms (owner_id, business_name, abn, contact_phone, postcode)
  values ('bbbbbbbb-0000-0000-0000-000000000003', 'Bad ABN Farm', '51824753557', '0412345678', '4343') $$,
  '23514', null, 'invalid ABN rejected by the database');
select throws_ok($$ insert into public.farms (owner_id, business_name, abn, contact_phone, postcode, is_labour_hire)
  values ('bbbbbbbb-0000-0000-0000-000000000003', 'LH Farm', '51824753556', '0412345678', '4343', true) $$,
  '23514', null, 'labour hire provider must give a licence number');
select lives_ok($$ insert into public.farms (id, owner_id, business_name, abn, contact_phone, postcode, verification_status, verified_by)
  values ('fbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000003', 'Test Farm', '51824753556',
          '0412345678', '4343', 'verified', 'me') $$, 'farm can create its business');
select is((select verification_status::text from public.farms), 'pending', 'self-declared "verified" is ignored on insert');
update public.farms set verification_status = 'verified', description = 'hello';
select is((select verification_status::text || '/' || description from public.farms), 'pending/hello',
  'owner can edit details but not verification status');

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');
select throws_ok($$ insert into public.farms (owner_id, business_name, abn, contact_phone, postcode)
  values ('bbbbbbbb-0000-0000-0000-000000000001', 'Worker Farm', '53004085616', '0412345678', '4343') $$,
  '42501', null, 'a worker cannot create a farm');
select is((select count(*)::int from public.farms where id = 'fbbbbbbb-0000-0000-0000-000000000001'), 0,
  'others cannot read a farm row directly');
select is((select count(*)::int from public.farms_public where id = 'fbbbbbbb-0000-0000-0000-000000000001'), 0,
  'pending farms are not public');

-- Admin functions are not callable from the app
select throws_ok($$ select public.admin_approve_farm('fbbbbbbb-0000-0000-0000-000000000001') $$, '42501', null,
  'app users cannot call admin functions');

-- ...but work from the dashboard
select pg_temp.as_dashboard();
select lives_ok($$ select public.admin_approve_farm('fbbbbbbb-0000-0000-0000-000000000001', 'ABN checked') $$,
  'dashboard admin approves farm');
select is((select count(*)::int from public.admin_actions where target_farm_id = 'fbbbbbbb-0000-0000-0000-000000000001'), 1,
  'approval is audit-logged');

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');
select is((select business_name from public.farms_public where id = 'fbbbbbbb-0000-0000-0000-000000000001'), 'Test Farm',
  'verified farm is public');

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000003');
update public.farms set description = 'new description';
select is((select verification_status::text from public.farms), 'verified', 'cosmetic edits keep verification');
update public.farms set business_name = 'Renamed Farm';
select is((select verification_status::text from public.farms), 'pending', 'changing the legal name triggers re-review');

-- Rejected farm resubmits by editing
select pg_temp.as_dashboard();
select public.admin_reject_farm('fbbbbbbb-0000-0000-0000-000000000001', 'Name mismatch');
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000003');
update public.farms set business_name = 'Test Farm';
select is((select verification_status::text || coalesce(rejection_reason, '') from public.farms), 'pending',
  'editing a rejected farm resubmits it');

-- ---------- Suspension ----------
select pg_temp.as_dashboard();
select public.admin_suspend_user('bbbbbbbb-0000-0000-0000-000000000001', 'test');
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000001');
select is((select count(*)::int from public.worker_profiles), 0, 'suspended worker loses data access');

-- ---------- Storage ----------
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('avatars', 'bbbbbbbb-0000-0000-0000-000000000001/x.jpg') $$,
  '42501', null, 'cannot upload into another user''s avatar folder');

-- ---------- Account deletion ----------
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000003');
select public.delete_my_account();
select pg_temp.as_dashboard();
select is((select count(*)::int from public.farms where owner_id = 'bbbbbbbb-0000-0000-0000-000000000003'), 0,
  'deleting an account removes the user and their farm');

select * from finish();
rollback;
