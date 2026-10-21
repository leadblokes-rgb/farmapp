-- Local development seed data. NEVER run against production.
-- Demo accounts (password for all: croppr-demo). In the app you can also sign in
-- with the emailed 6-digit code; local emails appear at http://127.0.0.1:54324 (Mailpit).
--
-- Farms, workers and (from milestone 3) jobs are spread across QLD growing regions.

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
