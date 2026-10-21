begin;
select plan(11);

-- Helpers to act as a given user under RLS.
create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'w@test.local', '{"role":"worker"}'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'f@test.local', '{"role":"farm"}'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'sneaky@test.local', '{"role":"admin"}'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'norole@test.local', '{}');

-- Trigger behaviour
select is((select role::text from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'worker', 'worker role taken from signup metadata');
select is((select role::text from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000002'), 'farm', 'farm role taken from signup metadata');
select is((select role from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000003'), null, 'admin role in metadata is ignored');

-- RLS: a worker sees only their own profile
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
select is((select count(*)::int from public.profiles), 1, 'user sees only own profile');

-- No direct updates
update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
reset role;
select is((select role::text from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'worker', 'direct update to admin has no effect');

-- set_my_role: cannot self-assign admin
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000004');
select throws_ok($$ select public.set_my_role('admin') $$, '42501', null, 'cannot self-assign admin');
select lives_ok($$ select public.set_my_role('farm') $$, 'can pick a role once');
select throws_ok($$ select public.set_my_role('worker') $$, 'P0001', null, 'cannot change role after it is set');
reset role;
select is((select role::text from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000004'), 'farm', 'role stored');

-- Admin sees everyone; suspended admin does not count as admin
update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-0000-0000-000000000003';
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000003');
select ok((select count(*) from public.profiles) >= 4, 'admin sees all profiles');
reset role;
update public.profiles set status = 'suspended' where id = 'aaaaaaaa-0000-0000-0000-000000000003';
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000003');
select is(public.is_admin(), false, 'suspended admin loses admin rights');
reset role;

select * from finish();
rollback;
