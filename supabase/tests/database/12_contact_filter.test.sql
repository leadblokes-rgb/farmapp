begin;
select plan(26);

create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_dashboard() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
select set_config('croppr.skip_notifications', 'on', true);

-- ---------- What gets masked ----------
select is(public.mask_contact_details('call me on 0412 345 678'), 'call me on #####', 'AU mobile with spaces');
select is(public.mask_contact_details('ring 0412345678 tmrw'), 'ring ##### tmrw', 'AU mobile, no spaces');
select is(public.mask_contact_details('my number +61 412-345-678'), 'my number #####', '+61 with dashes');
select is(public.mask_contact_details('(07) 4632 1234'), '(#####', 'landline in brackets');
select is(public.mask_contact_details('+44 7700 900123 is my uk number'), '##### is my uk number', 'overseas number');
select is(public.mask_contact_details('zero four one two three four five six seven'), '#####', 'number spelled out');
select is(public.mask_contact_details('zero 4 one 2 3 four 5 six'), '#####', 'number half spelled out');
select is(public.mask_contact_details('email zane.farm@gmail.com'), 'email #####', 'email address');
select is(public.mask_contact_details('zane at gmail dot com'), '#####', 'email spelled out');
select is(public.mask_contact_details('see https://lockyer.example/apply'), 'see #####', 'link');
select is(public.mask_contact_details('message me wa.me/61412345678'), 'message me #####', 'WhatsApp link');
select is(public.mask_contact_details('find us at lockyerfresh.com.au'), 'find us at #####', 'website');
select is(public.mask_contact_details('dm me @zane_farm'), 'dm me #####', '@handle');
select is(public.mask_contact_details('insta: zane_farm'), '#####', 'Instagram handle');
select is(public.mask_contact_details('whatsapp bob123'), '#####', 'WhatsApp id');

-- ---------- What is left alone ----------
select is(public.mask_contact_details('Pay is $32.50/hr, 38 hrs a week'), 'Pay is $32.50/hr, 38 hrs a week', 'pay and hours');
select is(public.mask_contact_details('Start 6:30am on 21/10/2026 or 21-10-2026'), 'Start 6:30am on 21/10/2026 or 21-10-2026', 'times and dates');
select is(public.mask_contact_details('Postcode 4343, need 12 pickers, 3 cars'), 'Postcode 4343, need 12 pickers, 3 cars', 'postcodes and counts');
select is(public.mask_contact_details('Do you use whatsapp? Packing line 3 at 7.30'), 'Do you use whatsapp? Packing line 3 at 7.30', 'mentioning an app or a shed line');
select is(public.mask_contact_details('meet me at the shed at 6'), 'meet me at the shed at 6', 'plain directions');

-- ---------- Only until hired ----------
insert into auth.users (id, email, raw_user_meta_data) values
  ('12121212-0000-0000-0000-000000000001', 'farm@filter.local', '{"role":"farm"}'),
  ('12121212-0000-0000-0000-000000000011', 'w@filter.local', '{"role":"worker"}');
insert into public.farms (id, owner_id, business_name, abn, contact_phone, postcode, verification_status) values
  ('f1212121-0000-0000-0000-000000000001', '12121212-0000-0000-0000-000000000001', 'Filter Farm', '51824753556', '0412345678', '4343', 'verified');
insert into public.worker_profiles (user_id, full_name, current_postcode) values ('12121212-0000-0000-0000-000000000011', 'Wil', '4343');
insert into public.jobs (id, farm_id, title, role_type, postcode, start_date, end_date, workers_needed, pay_type, pay_rate_cents, hours_per_week) values
  ('a1212121-0000-0000-0000-000000000001', 'f1212121-0000-0000-0000-000000000001', 'Job', 'picking', '4343', current_date + 3, current_date + 30, 5, 'hourly', 3300, 38);
insert into public.applications (id, job_id, worker_id) values
  ('a2121212-0000-0000-0000-000000000001', 'a1212121-0000-0000-0000-000000000001', '12121212-0000-0000-0000-000000000011');

select pg_temp.act_as('12121212-0000-0000-0000-000000000001');
select public.start_conversation('a2121212-0000-0000-0000-000000000001');
insert into public.messages (conversation_id, sender_id, body)
select id, '12121212-0000-0000-0000-000000000001', 'Text me on 0412 345 678'
from public.conversations where application_id = 'a2121212-0000-0000-0000-000000000001';
select is((select body || '|' || contact_masked from public.messages order by created_at desc limit 1),
  'Text me on #####|true', 'before acceptance the number is masked as it is saved');

select pg_temp.act_as('12121212-0000-0000-0000-000000000011');
select is((select body from public.messages order by created_at desc limit 1), 'Text me on #####',
  'the worker only ever sees the masked text');
select is((select count(*)::int from public.contact_share_attempts), 0, 'app users cannot read the attempt log');

select pg_temp.act_as('12121212-0000-0000-0000-000000000001');
select public.decide_applications(array['a2121212-0000-0000-0000-000000000001'::uuid], 'accepted');
insert into public.messages (conversation_id, sender_id, body)
select id, '12121212-0000-0000-0000-000000000001', 'Now you are hired: 0412 345 678'
from public.conversations where application_id = 'a2121212-0000-0000-0000-000000000001';
select is((select body || '|' || contact_masked from public.messages where body like 'Now you are hired%'),
  'Now you are hired: 0412 345 678|false', 'after acceptance contact details go through');

select pg_temp.as_dashboard();
select is((select original_body from public.contact_share_attempts), 'Text me on 0412 345 678',
  'admins can see the original attempt');
select is((select attempts_30_days::int from public.admin_contact_share_attempts where sender_email = 'farm@filter.local'), 1,
  'admin view counts attempts per sender');

select * from finish();
rollback;
