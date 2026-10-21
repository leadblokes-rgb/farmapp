-- Local development seed data. NEVER run against production.
-- Demo accounts (password for all: farmmatch-demo). In the app you can also sign in
-- with the emailed 6-digit code; local emails appear at http://127.0.0.1:54324 (Mailpit).
--
-- Later milestones extend this file with farms, jobs and more workers in QLD regions.

create or replace function pg_temp.seed_user(uid uuid, email text, role text)
returns void
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', email,
    extensions.crypt('farmmatch-demo', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('role', role), now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), uid, uid::text,
    jsonb_build_object('sub', uid::text, 'email', email, 'email_verified', true),
    'email', now(), now(), now()
  );
end;
$$;

select pg_temp.seed_user('11111111-1111-1111-1111-111111111111', 'worker@demo.farmmatch.test', 'worker');
select pg_temp.seed_user('22222222-2222-2222-2222-222222222222', 'farm@demo.farmmatch.test', 'farm');
-- Signs up with no role, so you can test the "choose your role" screen.
select pg_temp.seed_user('33333333-3333-3333-3333-333333333333', 'newuser@demo.farmmatch.test', '');
select pg_temp.seed_user('99999999-9999-9999-9999-999999999999', 'admin@demo.farmmatch.test', '');

-- Admin can't be requested via metadata (the trigger ignores it), so grant it directly.
update public.profiles set role = 'admin' where id = '99999999-9999-9999-9999-999999999999';
