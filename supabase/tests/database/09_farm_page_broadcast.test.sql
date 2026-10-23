begin;
select plan(13);

create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
select set_config('croppr.skip_notifications', 'on', true);

insert into auth.users (id, email, raw_user_meta_data) values
  ('99999999-0000-0000-0000-000000000001', 'farmA@page.local', '{"role":"farm"}'),
  ('99999999-0000-0000-0000-000000000002', 'farmB@page.local', '{"role":"farm"}'),
  ('99999999-0000-0000-0000-000000000011', 'w1@page.local', '{"role":"worker"}'),
  ('99999999-0000-0000-0000-000000000012', 'w2@page.local', '{"role":"worker"}'),
  ('99999999-0000-0000-0000-000000000013', 'w3@page.local', '{"role":"worker"}');
insert into public.farms (id, owner_id, business_name, abn, contact_phone, postcode, verification_status) values
  ('f9999999-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'Farm A', '51824753556', '0412345678', '4343', 'verified'),
  ('f9999999-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000002', 'Farm B', '53004085616', '0412345678', '4670', 'verified');
insert into public.worker_profiles (user_id, full_name, current_postcode) values
  ('99999999-0000-0000-0000-000000000011', 'Wanda', '4343'),
  ('99999999-0000-0000-0000-000000000012', 'Wally', '4343'),
  ('99999999-0000-0000-0000-000000000013', 'Wilma', '4343');
insert into public.jobs (id, farm_id, title, role_type, postcode, start_date, end_date, workers_needed, pay_type, pay_rate_cents, hours_per_week) values
  ('a9999999-0000-0000-0000-000000000001', 'f9999999-0000-0000-0000-000000000001', 'Open job', 'picking', '4343', current_date + 3, current_date + 30, 5, 'hourly', 3300, 38),
  ('a9999999-0000-0000-0000-000000000002', 'f9999999-0000-0000-0000-000000000001', 'Second job', 'packing', '4343', current_date + 9, current_date + 40, 5, 'hourly', 3300, 38);
insert into public.applications (id, job_id, worker_id, status) values
  ('a1999999-0000-0000-0000-000000000011', 'a9999999-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000011', 'accepted'),
  ('a1999999-0000-0000-0000-000000000012', 'a9999999-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000012', 'accepted'),
  ('a1999999-0000-0000-0000-000000000013', 'a9999999-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000013', 'applied');

-- ---------- Farm page ----------
select pg_temp.act_as('99999999-0000-0000-0000-000000000001');
select lives_ok($$ update public.farms set website = 'https://farm-a.example', accommodation_details = 'Shared cabins, $160/wk',
  photos = array['99999999-0000-0000-0000-000000000001/p1.jpg'] where id = 'f9999999-0000-0000-0000-000000000001' $$,
  'farm adds its website, accommodation details and a photo');
select is((select verification_status::text from public.farms where id = 'f9999999-0000-0000-0000-000000000001'), 'verified',
  'farm page edits do not send the farm back for review');
select throws_ok($$ update public.farms set website = 'not a url' where id = 'f9999999-0000-0000-0000-000000000001' $$,
  '23514', null, 'website must be a web address');
select throws_ok($$ update public.farms set photos = array['a','b','c','d','e','f','g'] where id = 'f9999999-0000-0000-0000-000000000001' $$,
  '23514', null, 'at most 6 photos');

select pg_temp.act_as('99999999-0000-0000-0000-000000000013');
select is((select website from public.farms_public where id = 'f9999999-0000-0000-0000-000000000001'), 'https://farm-a.example',
  'workers see the farm page details');
select results_eq($$ select title, applied from public.farm_open_jobs('f9999999-0000-0000-0000-000000000001') $$,
  $$ values ('Open job', true), ('Second job', false) $$, 'farm page lists open jobs and whether I applied');

-- ---------- Broadcast ----------
select pg_temp.act_as('99999999-0000-0000-0000-000000000002');
select throws_ok($$ select public.broadcast_to_crew('a9999999-0000-0000-0000-000000000001', 'hi') $$,
  '42501', null, 'another farm cannot message my crew');

select pg_temp.act_as('99999999-0000-0000-0000-000000000011');
select throws_ok($$ select public.broadcast_to_crew('a9999999-0000-0000-0000-000000000001', 'hi') $$,
  '42501', null, 'workers cannot broadcast');

select pg_temp.act_as('99999999-0000-0000-0000-000000000001');
select is(public.broadcast_to_crew('a9999999-0000-0000-0000-000000000001', 'Start 6am at the shed'), 2,
  'broadcast reaches both accepted workers');
select is(public.broadcast_to_crew('a9999999-0000-0000-0000-000000000001', 'Still reviewing, thanks', 'applied'), 1,
  'broadcast to applicants still under review');

select pg_temp.act_as('99999999-0000-0000-0000-000000000012');
select is((select body from public.messages where broadcast_id is not null), 'Start 6am at the shed',
  'each worker gets it in their own chat (and only sees their own)');

select pg_temp.act_as('99999999-0000-0000-0000-000000000001');
select lives_ok($$ select public.broadcast_to_crew('a9999999-0000-0000-0000-000000000001', 'msg ' || n) from generate_series(1, 8) n $$,
  'up to 10 broadcasts a day');
select throws_ok($$ select public.broadcast_to_crew('a9999999-0000-0000-0000-000000000001', 'one too many') $$,
  '54000', null, 'the 11th broadcast in a day is refused');

select * from finish();
rollback;
