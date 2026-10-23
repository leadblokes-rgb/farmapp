-- Local development seed data. NEVER run against production.
-- Demo accounts (password for all: croppr-demo). In the app you can also sign in
-- with the emailed 6-digit code; local emails appear at http://127.0.0.1:54324 (Mailpit).
--
-- Farms, workers and (from milestone 3) jobs are spread across QLD growing regions.

-- Don't send push notifications for seeded applications/messages.
select set_config('croppr.skip_notifications', 'on', false);

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
    extensions.crypt('croppr-demo', extensions.gen_salt('bf')), now(),
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

select pg_temp.seed_user('11111111-1111-1111-1111-111111111111', 'worker@demo.croppr.test', 'worker');
select pg_temp.seed_user('22222222-2222-2222-2222-222222222222', 'farm@demo.croppr.test', 'farm');
-- Signs up with no role, so you can test the "choose your role" screen.
select pg_temp.seed_user('33333333-3333-3333-3333-333333333333', 'newuser@demo.croppr.test', '');
select pg_temp.seed_user('99999999-9999-9999-9999-999999999999', 'admin@demo.croppr.test', '');

-- Admin can't be requested via metadata (the trigger ignores it), so grant it directly.
update public.profiles set role = 'admin' where id = '99999999-9999-9999-9999-999999999999';

-- ---------------------------------------------------------------------------
-- Farms (milestone 2). All farm logins use the same demo password.
-- ---------------------------------------------------------------------------

-- Builds a checksum-valid (but fake) ABN from a 9-digit base.
create or replace function pg_temp.fake_abn(base text)
returns text
language plpgsql
as $$
begin
  for prefix in 10..99 loop
    if public.is_valid_abn(prefix::text || base) then
      return prefix::text || base;
    end if;
  end loop;
end;
$$;

select pg_temp.seed_user('22222222-0000-0000-0000-000000000002', 'bundaberg-farm@demo.croppr.test', 'farm');
select pg_temp.seed_user('22222222-0000-0000-0000-000000000003', 'stanthorpe-farm@demo.croppr.test', 'farm');
select pg_temp.seed_user('22222222-0000-0000-0000-000000000004', 'labourhire@demo.croppr.test', 'farm');
select pg_temp.seed_user('22222222-0000-0000-0000-000000000005', 'pending-farm@demo.croppr.test', 'farm');
select pg_temp.seed_user('22222222-0000-0000-0000-000000000006', 'rejected-farm@demo.croppr.test', 'farm');

insert into public.farms (id, owner_id, business_name, abn, contact_phone, postcode, description,
                          is_labour_hire, labour_hire_licence_number, verification_status, rejection_reason,
                          verified_at, verified_by) values
  ('f0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Lockyer Fresh Farms',
   pg_temp.fake_abn('100000001'), '0754620001', '4343',
   'Family-run vegetable farm near Gatton growing lettuce, broccoli and onions year round.',
   false, null, 'verified', null, now(), 'seed'),
  ('f0000000-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'Bundy Sweet Potato Co',
   pg_temp.fake_abn('100000002'), '0741520002', '4670',
   'Sweet potato and tomato grower in Bundaberg with on-farm accommodation.',
   false, null, 'verified', null, now(), 'seed'),
  ('f0000000-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000003', 'Granite Belt Orchards',
   pg_temp.fake_abn('100000003'), '0746810003', '4380',
   'Apple, pear and stone fruit orchard in Stanthorpe. Picking season December to April.',
   false, null, 'verified', null, now(), 'seed'),
  ('f0000000-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000004', 'North Queensland Harvest Crew',
   pg_temp.fake_abn('100000004'), '0747860004', '4805',
   'Licensed labour hire provider supplying picking and packing crews to growers around Bowen and the Burdekin.',
   true, 'LHL04521', 'verified', null, now(), 'seed'),
  ('f0000000-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000005', 'Tablelands Avocado Growers',
   pg_temp.fake_abn('100000005'), '0740920005', '4880',
   'Avocado and mango orchards near Mareeba.',
   false, null, 'pending', null, null, null),
  ('f0000000-0000-0000-0000-000000000006', '22222222-0000-0000-0000-000000000006', 'Childers Berry Farm',
   pg_temp.fake_abn('100000006'), '0741260006', '4660',
   'Strawberry and blueberry farm.',
   false, null, 'rejected', 'The business name doesn''t match the ABN on ABN Lookup. Please check and resubmit.',
   null, null);

-- ---------------------------------------------------------------------------
-- Workers (milestone 2). The demo worker plus 24 more with a mix of visas, cars and groups.
-- Availability is relative to today so the data never goes stale.
-- ---------------------------------------------------------------------------

do $$
declare
  w record;
  uid uuid;
begin
  for w in
    select * from (values
      -- n, name, nationality, visa, expiry offset (days), postcode, car, accom, travel, group size, years, skills, regions, avail start offset, avail length
      (0,  'Sam Taylor',        'GB', '417',        400, '4343', true,  false, 'solo',  1, 1, '{picking,packing}',            '{lockyer-valley,darling-downs}',          7,  120),
      (1,  'Lena Müller',       'DE', '417',        250, '4000', false, true,  'solo',  1, 0, '{}',                           '{lockyer-valley,bundaberg}',              3,   90),
      (2,  'Yuki Tanaka',       'JP', '417',        300, '4670', true,  false, 'solo',  1, 2, '{picking,quality_control}',    '{bundaberg}',                             0,  180),
      (3,  'Chloé Martin',      'FR', '417',        200, '4380', false, true,  'group', 3, 1, '{picking}',                    '{granite-belt}',                         10,   75),
      (4,  'Camille Dubois',    'FR', '417',        200, '4380', false, true,  'group', 3, 0, '{picking}',                    '{granite-belt}',                         10,   75),
      (5,  'Inès Bernard',      'FR', '417',        210, '4380', true,  true,  'group', 3, 1, '{picking,packing}',            '{granite-belt}',                         10,   75),
      (6,  'Liam O''Brien',     'IE', '417',        330, '4805', true,  false, 'solo',  1, 3, '{tractor,irrigation,picking}', '{bowen-burdekin}',                        0,  150),
      (7,  'Min-jun Kim',       'KR', '417',        150, '4870', false, true,  'solo',  1, 0, '{}',                           '{atherton-tablelands,cassowary-coast}',   14,   60),
      (8,  'Wei-Ting Chen',     'TW', '417',        365, '4000', false, true,  'solo',  1, 1, '{packing}',                    '{lockyer-valley,sunshine-coast-hinterland}', 5, 100),
      (9,  'Emma Jansen',       'NL', '417',        280, '4350', true,  false, 'solo',  1, 2, '{forklift,packing}',           '{darling-downs,lockyer-valley}',          0,  200),
      (10, 'Jack Wilson',       'CA', '417',        180, '4670', true,  true,  'solo',  1, 1, '{planting,picking}',           '{bundaberg}',                            20,   90),
      (11, 'Olivia Smith',      'GB', '417',         90, '4343', false, true,  'solo',  1, 0, '{}',                           '{lockyer-valley}',                        0,   45),
      (12, 'Mateo García',      'ES', '462',        320, '4807', true,  false, 'group', 2, 2, '{picking,chainsaw}',           '{bowen-burdekin}',                        7,  140),
      (13, 'Lucía Fernández',   'ES', '462',        320, '4807', false, false, 'group', 2, 1, '{picking}',                    '{bowen-burdekin}',                        7,  140),
      (14, 'Tyler Johnson',     'US', '462',        260, '4880', true,  false, 'solo',  1, 4, '{tractor,hr_licence,irrigation}', '{atherton-tablelands}',                0,  365),
      (15, 'Nattaya Srisuk',    'TH', '462',        220, '4860', false, true,  'solo',  1, 1, '{packing,quality_control}',    '{cassowary-coast}',                       2,   80),
      (16, 'Andi Pratama',      'ID', '462',        240, '4854', false, true,  'solo',  1, 0, '{}',                           '{cassowary-coast,atherton-tablelands}',  12,   90),
      (17, 'Sofía Rojas',       'CL', '462',        300, '4660', true,  true,  'solo',  1, 1, '{picking,first_aid}',          '{bundaberg}',                             0,  120),
      (18, 'Linh Nguyen',       'VN', '462',        190, '4670', false, true,  'solo',  1, 0, '{packing}',                    '{bundaberg}',                             4,   60),
      (19, 'Tom Brown',         'AU', 'citizen_pr', null, '4350', true, false, 'solo',  1, 6, '{tractor,forklift,livestock,first_aid}', '{darling-downs,lockyer-valley}', 0, 365),
      (20, 'Aroha Ngata',       'NZ', 'citizen_pr', null, '4370', true, false, 'solo',  1, 5, '{livestock,tractor}',          '{granite-belt,darling-downs}',            0,  365),
      (21, 'Priya Sharma',      'IN', 'other',      400, '4000', false, true,  'solo',  1, 0, '{}',                           '{lockyer-valley,sunshine-coast-hinterland}', 30, 60),
      (22, 'Giulia Rossi',      'IT', '417',        120, '4570', false, true,  'solo',  1, 1, '{pruning,picking}',            '{sunshine-coast-hinterland}',             0,   70),
      (23, 'Erik Lindqvist',    'SE', '417',        340, '4805', true,  false, 'solo',  1, 2, '{pruning,chainsaw,tractor}',   '{bowen-burdekin,atherton-tablelands}',    0,  160),
      (24, 'Hannah Becker',     'DE', '417',        160, '4341', false, true,  'solo',  1, 0, '{}',                           '{lockyer-valley}',                        1,   50)
    ) as t(n, full_name, nationality, visa, expiry_days, postcode, has_car, accom, travel, group_size, years, skills, regions, avail_start, avail_len)
  loop
    if w.n = 0 then
      uid := '11111111-1111-1111-1111-111111111111';
    else
      uid := ('11111111-0000-0000-0000-' || lpad(w.n::text, 12, '0'))::uuid;
      perform pg_temp.seed_user(uid, 'worker' || w.n || '@demo.croppr.test', 'worker');
    end if;

    insert into public.worker_profiles (user_id, full_name, current_postcode, travel_mode, group_size, has_car,
                                        needs_accommodation, skills, years_experience, experience_summary)
    values (uid, w.full_name, w.postcode, w.travel::public.travel_mode, w.group_size, w.has_car, w.accom,
            w.skills::text[], w.years,
            case when w.years > 0 then 'Worked ' || w.years || ' season(s) on farms.' else 'Keen to learn, first farm job.' end);

    insert into public.worker_private (user_id, nationality, visa_type, visa_expiry)
    values (uid, w.nationality, w.visa::public.visa_type,
            case when w.expiry_days is null then null else current_date + w.expiry_days end);

    insert into public.worker_regions (worker_id, region_id)
    select uid, unnest(w.regions::text[]);

    insert into public.worker_availability (worker_id, start_date, end_date)
    values (uid, current_date + w.avail_start, current_date + w.avail_start + w.avail_len);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Jobs (milestone 3). Dates are relative to today. Rates sit around the award minimum
-- (see packages/shared/src/config/payRules.ts); one is deliberately below it.
-- ---------------------------------------------------------------------------

insert into public.jobs (id, farm_id, title, role_type, description, postcode, start_date, end_date, workers_needed,
                         pay_type, pay_rate_cents, piece_rate_unit, min_hourly_guarantee_cents, hours_per_week,
                         accommodation_provided, accommodation_cost_week_cents, transport_provided, car_required,
                         likely_specified_work) values
  -- Lockyer Fresh Farms (Gatton) - the demo farm
  ('a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'Lettuce harvest crew', 'picking',
   'Early starts (5:30am) cutting and packing iceberg and cos lettuce in the field. Gloves and knives supplied.',
   '4343', current_date + 7, current_date + 97, 30, 'hourly', 3250, null, null, 38, false, null, false, true, true),
  ('a0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 'Broccoli packing shed', 'packing',
   'Grading and packing broccoli in a cool shed. Standing work, rotating stations.',
   '4343', current_date + 3, current_date + 60, 12, 'hourly', 3300, null, null, 40, false, null, true, false, true),
  ('a0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', 'Tractor driver (onion season)', 'machinery',
   'Experienced tractor driver for bed forming and harvest. Must have driven tractors before.',
   '4342', current_date + 14, current_date + 120, 2, 'hourly', 3800, null, null, 45, false, null, false, true, true),
  -- Bundy Sweet Potato Co (Bundaberg)
  ('a0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000002', 'Sweet potato pickers', 'picking',
   'Picking sweet potatoes behind the digger. Paid per bin with a guaranteed hourly minimum.',
   '4670', current_date + 5, current_date + 75, 40, 'piece_rate', 4800, 'bin', 3218, 38, true, 16000, true, false, true),
  ('a0000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000002', 'Tomato packers', 'packing',
   'Packing truss tomatoes. Day shift, air-conditioned shed.',
   '4670', current_date + 1, current_date + 45, 15, 'hourly', 3218, null, null, 38, true, 16000, true, false, true),
  ('a0000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000002', 'Planting crew', 'planting',
   'Planting sweet potato slips. Hot, physical work; hats and water provided.',
   '4671', current_date + 30, current_date + 60, 10, 'hourly', 3218, null, null, 36, true, 16000, true, false, true),
  -- Granite Belt Orchards (Stanthorpe)
  ('a0000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000003', 'Apple pickers', 'picking',
   'Picking apples into bags and bins. Ladder work. Piece rate per bin, minimum hourly guaranteed.',
   '4380', current_date + 10, current_date + 130, 25, 'piece_rate', 5500, 'bin', 3218, 40, true, 14000, false, false, true),
  ('a0000000-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-000000000003', 'Winter pruning', 'pruning',
   'Pruning apple and pear trees. Training given; previous pruning experience a plus.',
   '4382', current_date + 60, current_date + 150, 8, 'hourly', 3400, null, null, 38, true, 14000, false, true, true),
  ('a0000000-0000-0000-0000-000000000009', 'f0000000-0000-0000-0000-000000000003', 'Stone fruit packing', 'packing',
   'Packing peaches and plums. Short season, long days.',
   '4380', current_date + 2, current_date + 40, 10, 'hourly', 3218, null, null, 45, true, 14000, false, false, true),
  -- North Queensland Harvest Crew (labour hire, Bowen)
  ('a0000000-0000-0000-0000-00000000000a', 'f0000000-0000-0000-0000-000000000004', 'Capsicum pickers (Bowen)', 'picking',
   'Supplying crews to growers around Bowen. Bus to farm daily from our Bowen accommodation.',
   '4805', current_date + 4, current_date + 110, 50, 'piece_rate', 280, 'bucket', 3218, 38, true, 18000, true, false, true),
  ('a0000000-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000004', 'Mango pickers (Ayr)', 'picking',
   'Mango season crew in the Burdekin. Sap protection supplied.',
   '4807', current_date + 20, current_date + 90, 30, 'hourly', 3300, null, null, 40, true, 18000, true, false, true),
  ('a0000000-0000-0000-0000-00000000000d', 'f0000000-0000-0000-0000-000000000004', 'Forklift driver - packing shed', 'machinery',
   'Licensed forklift driver for a busy packing shed. Forklift licence required.',
   '4805', current_date + 7, current_date + 180, 2, 'hourly', 3600, null, null, 45, false, null, false, true, true),
  -- Below-award example (shows how a job looks if a farm ignores the warning)
  ('a0000000-0000-0000-0000-00000000000e', 'f0000000-0000-0000-0000-000000000002', 'Weekend weeding', 'general',
   'Light weeding work on weekends.',
   '4670', current_date + 6, current_date + 50, 4, 'hourly', 2900, null, null, 16, false, null, false, true, false),
  -- Closed job (shouldn't appear in the feed)
  ('a0000000-0000-0000-0000-00000000000f', 'f0000000-0000-0000-0000-000000000001', 'Pumpkin harvest (filled)', 'picking',
   'Season filled, thanks!', '4341', current_date + 2, current_date + 30, 10, 'hourly', 3218, null, null, 38,
   false, null, false, true, true);

update public.jobs set status = 'filled' where id = 'a0000000-0000-0000-0000-00000000000f';

-- Applications (milestone 3) so farms have applicants to review in milestone 4.
-- Lettuce harvest: 12 applicants. Sweet potato: 6. Apple pickers: the French group of 3.
insert into public.swipes (worker_id, job_id, direction)
select w.id, j.job_id, 'like'
from (values
  ('a0000000-0000-0000-0000-000000000001'::uuid, array[1, 2, 6, 8, 9, 11, 12, 13, 19, 21, 22, 24]),
  ('a0000000-0000-0000-0000-000000000004'::uuid, array[2, 10, 15, 17, 18, 16]),
  ('a0000000-0000-0000-0000-000000000007'::uuid, array[3, 4, 5]),
  ('a0000000-0000-0000-0000-00000000000a'::uuid, array[6, 12, 13, 23])
) as j(job_id, workers)
cross join lateral unnest(j.workers) as n
cross join lateral (select ('11111111-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid as id) w;

insert into public.applications (job_id, worker_id, created_at)
select job_id, worker_id, now() - (random() * interval '3 days') from public.swipes where direction = 'like';

-- Travel groups (milestone 4): the French trio and the Spanish pair are linked.
insert into public.worker_groups (id, created_by, invite_code) values
  ('99990000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000003', 'FRANCE'),
  ('99990000-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000012', 'ESPANA');
update public.worker_profiles set group_id = '99990000-0000-0000-0000-000000000001'
 where user_id in ('11111111-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000005');
update public.worker_profiles set group_id = '99990000-0000-0000-0000-000000000002'
 where user_id in ('11111111-0000-0000-0000-000000000012', '11111111-0000-0000-0000-000000000013');

-- The French trio also applies to the Lockyer lettuce job, so the demo farm sees a group.
insert into public.swipes (worker_id, job_id, direction) values
  ('11111111-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'like'),
  ('11111111-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'like'),
  ('11111111-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'like')
on conflict do nothing;
insert into public.applications (job_id, worker_id) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000003'),
  ('a0000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000004'),
  ('a0000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000005')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Chat (milestone 5): the demo farm has accepted Sam (the demo worker) for the tractor job
-- and they've exchanged a couple of messages.
-- ---------------------------------------------------------------------------

insert into public.swipes (worker_id, job_id, direction)
values ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000003', 'like');
insert into public.applications (id, job_id, worker_id)
values ('ab000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111');
update public.applications set status = 'accepted', decided_at = now()
 where id = 'ab000000-0000-0000-0000-000000000001';  -- trigger opens the conversation
insert into public.messages (conversation_id, sender_id, body, created_at)
select c.id, m.sender, m.body, now() - m.ago
from public.conversations c,
  (values ('22222222-2222-2222-2222-222222222222'::uuid, 'Hi Sam, thanks for applying! Can you start on the 4th? We meet at the shed at 6am.', interval '2 hours'),
          ('11111111-1111-1111-1111-111111111111'::uuid, 'Yes, I can! Do I need steel-capped boots?', interval '90 minutes'),
          ('22222222-2222-2222-2222-222222222222'::uuid, 'Yes please. Hi-vis is supplied.', interval '80 minutes')) as m(sender, body, ago)
where c.application_id = 'ab000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- Trust loop: a finished Lockyer job (check-in done, some ratings), a finished Bundy job with
-- older one-sided ratings (revealed after 14 days), and a Lockyer job that started yesterday
-- so the farm sees "Who turned up?".
-- ---------------------------------------------------------------------------

insert into public.jobs (id, farm_id, title, role_type, description, postcode, start_date, end_date, workers_needed,
                         pay_type, pay_rate_cents, hours_per_week, likely_specified_work, status) values
  ('a0000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000001', 'Strawberry runners (last season)', 'planting',
   'Planting strawberry runners.', '4343', current_date - 60, current_date - 10, 6, 'hourly', 3250, 38, true, 'closed'),
  ('a0000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-000000000002', 'Sweet potato grading (last season)', 'packing',
   'Grading in the shed.', '4670', current_date - 90, current_date - 40, 4, 'hourly', 3218, 38, true, 'closed'),
  ('a0000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000001', 'Celery harvest', 'picking',
   'Cutting and packing celery in the field.', '4343', current_date - 1, current_date + 40, 3, 'hourly', 3300, 38, true, 'filled');

insert into public.applications (id, job_id, worker_id, status, decided_at) values
  ('ab000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'accepted', now() - interval '65 days'),
  ('ab000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000019', 'accepted', now() - interval '65 days'),
  ('ab000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000007', 'accepted', now() - interval '65 days'),
  ('ab000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000006', 'accepted', now() - interval '65 days'),
  ('ab000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000020', 'accepted', now() - interval '65 days'),
  ('ab000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000011', '11111111-0000-0000-0000-000000000015', 'accepted', now() - interval '95 days'),
  ('ab000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000011', '11111111-0000-0000-0000-000000000017', 'accepted', now() - interval '95 days'),
  ('ab000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000012', '11111111-0000-0000-0000-000000000009', 'accepted', now() - interval '5 days'),
  ('ab000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000012', '11111111-0000-0000-0000-000000000011', 'accepted', now() - interval '5 days'),
  ('ab000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000012', '11111111-0000-0000-0000-000000000016', 'accepted', now() - interval '5 days');

insert into public.attendance (application_id, status, marked_at) values
  ('ab000000-0000-0000-0000-000000000002', 'showed', now() - interval '60 days'),
  ('ab000000-0000-0000-0000-000000000003', 'showed', now() - interval '60 days'),
  ('ab000000-0000-0000-0000-000000000004', 'showed', now() - interval '60 days'),
  ('ab000000-0000-0000-0000-000000000005', 'no_show', now() - interval '60 days'),
  ('ab000000-0000-0000-0000-000000000006', 'left_early', now() - interval '60 days'),
  ('ab000000-0000-0000-0000-000000000007', 'showed', now() - interval '90 days'),
  ('ab000000-0000-0000-0000-000000000008', 'showed', now() - interval '90 days');
select public.complete_finished_jobs();
update public.applications set completed_at = now() - interval '39 days'
 where id in ('ab000000-0000-0000-0000-000000000007', 'ab000000-0000-0000-0000-000000000008');

-- Tom and Min-jun rated Lockyer and Lockyer rated them, so those ratings are revealed.
-- Sam hasn't rated yet (and Lockyer hasn't rated Sam or Aroha), so both see "Rate" prompts.
insert into public.farm_ratings (application_id, farm_id, worker_id, overall, accommodation, would_work_again, comment) values
  ('ab000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000019', 5, null, true,
   'Well organised, paid on time every week. Supervisor explains everything.'),
  ('ab000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000007', 4, null, true,
   'Hard work but fair. Early starts.'),
  ('ab000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000015', 4, 3, true,
   'Good shed, accommodation a bit crowded.'),
  ('ab000000-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000017', 5, 4, true,
   'Friendly team and the bus was always on time.');
insert into public.worker_ratings (application_id, worker_id, farm_id, reliability, quality, comment) values
  ('ab000000-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000019', 'f0000000-0000-0000-0000-000000000001', 5, 5,
   'Never missed a day.'),
  ('ab000000-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000001', 4, 4, '');

-- Farm pages (phase B).
update public.farms set website = 'https://lockyerfresh.example',
  accommodation_details = 'No on-farm accommodation. Gatton has hostels and share houses 10 minutes away; we can share contacts.'
 where id = 'f0000000-0000-0000-0000-000000000001';
update public.farms set website = 'https://bundysweetpotato.example',
  accommodation_details = 'Shared 4-bed cabins on the farm, $160/week including power and wifi. Kitchen, laundry and a weekly bus to town.'
 where id = 'f0000000-0000-0000-0000-000000000002';

-- A sample report for the admin queue.
insert into public.reports (reporter_id, target_job_id, target_user_id, reason, details)
values ('11111111-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000e',
        public.job_owner('a0000000-0000-0000-0000-00000000000e'), 'underpaid',
        'Weekend weeding pays $29/hr, below the award.');

-- Local push notification wiring: the database calls send-push through the API gateway.
-- Only on the local Docker stack (recognised by its fixed, public dev JWT secret). On a hosted
-- project, set these two Vault secrets yourself with your project's values (see README).
do $$
begin
  if current_setting('app.settings.jwt_secret', true) = 'super-secret-jwt-token-with-at-least-32-characters-long' then
    perform vault.create_secret('http://kong:8000/functions/v1', 'functions_url');
    perform vault.create_secret(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
      'service_role_key');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Day tracker (milestone 6): Sam has logged 3 full-time weeks at a previous farm plus a payslip.
-- ---------------------------------------------------------------------------

insert into public.employers_worked (id, worker_id, name, postcode, counts_as_specified) values
  ('e1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Sunny Strawberries (Caboolture)', '4510', true),
  ('e1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Brisbane CBD cafe', '4000', false);

-- Three Mon–Fri weeks of 8-hour shifts, ending last week.
insert into public.shift_logs (worker_id, employer_id, work_date, hours)
select '11111111-1111-1111-1111-111111111111', 'e1000000-0000-0000-0000-000000000001', d::date, 8
from generate_series(date_trunc('week', current_date) - interval '35 days', date_trunc('week', current_date) - interval '15 days', interval '1 day') as d
where extract(isodow from d) <= 5;

insert into public.shift_logs (worker_id, employer_id, work_date, hours)
values ('11111111-1111-1111-1111-111111111111', 'e1000000-0000-0000-0000-000000000002', current_date - 3, 6);

insert into public.payslips (worker_id, employer_id, period_start, period_end, days_worked, hours_total)
values ('11111111-1111-1111-1111-111111111111', 'e1000000-0000-0000-0000-000000000001',
        current_date - 70, current_date - 57, 10, 80);

-- Job alerts (phase C): Sam gets alerts for new jobs in the Lockyer Valley.
insert into public.job_alerts (worker_id, region_ids) values ('11111111-1111-1111-1111-111111111111', array['lockyer-valley']);
