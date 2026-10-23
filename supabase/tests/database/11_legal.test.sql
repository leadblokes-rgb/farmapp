begin;
select plan(3);

create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

insert into auth.users (id, email) values
  ('11001100-0000-0000-0000-000000000001', 'a@legal.local'),
  ('11001100-0000-0000-0000-000000000002', 'b@legal.local');

select pg_temp.act_as('11001100-0000-0000-0000-000000000001');
select lives_ok($$ select public.accept_legal('t1', 'p1') $$, 'a user accepts the terms');
select is((select terms_version || '|' || privacy_version from public.profiles where id = '11001100-0000-0000-0000-000000000001'),
  't1|p1', 'their acceptance is recorded');
select pg_temp.act_as('11001100-0000-0000-0000-000000000002');
select is((select count(*)::int from public.profiles where terms_version is not null), 0,
  'accepting only ever changes your own profile (and others stay unreadable)');

select * from finish();
rollback;
