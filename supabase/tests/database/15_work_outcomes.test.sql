begin;
select plan(21);

create or replace function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.as_dashboard() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
select set_config('croppr.skip_notifications', 'on', true);

-- Farm F; workers W1..W6; an ended job (3 days ago) and a job that ended 10 days ago.
insert into auth.users (id, email, raw_user_meta_data)
select ('15151515-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'u' || n || '@wo.local',
       case when n = 1 then '{"role":"farm"}' else '{"role":"worker"}' end::jsonb
from generate_series(1, 8) n;
insert into auth.users (id, email, raw_user_meta_data) values ('15151515-0000-0000-0000-000000000099', 'other@wo.local', '{"role":"farm"}');
insert into public.farms (id, owner_id, business_name, abn, contact_phone, postcode, verification_status) values
  ('f1515151-0000-0000-0000-000000000001', '15151515-0000-0000-0000-000000000001', 'Outcome Farm', '51824753556', '0412345678', '4343', 'verified'),
  ('f1515151-0000-0000-0000-000000000099', '15151515-0000-0000-0000-000000000099', 'Other Farm', '53004085616', '0412345678', '4343', 'verified');
insert into public.worker_profiles (user_id, full_name, current_postcode)
select ('15151515-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'Worker ' || n, '4343' from generate_series(2, 8) n;
insert into public.jobs (id, farm_id, title, role_type, postcode, start_date, end_date, workers_needed, pay_type, pay_rate_cents, hours_per_week) values
  ('a1515151-0000-0000-0000-000000000001', 'f1515151-0000-0000-0000-000000000001', 'Recent', 'picking', '4343', current_date - 30, current_date - 3, 9, 'hourly', 3300, 38),
  ('a1515151-0000-0000-0000-000000000002', 'f1515151-0000-0000-0000-000000000001', 'Older', 'picking', '4343', current_date - 40, current_date - 10, 9, 'hourly', 3300, 38),
  ('a1515151-0000-0000-0000-000000000003', 'f1515151-0000-0000-0000-000000000001', 'Running', 'picking', '4343', current_date - 2, current_date + 10, 9, 'hourly', 3300, 38);
insert into public.applications (id, job_id, worker_id, status)
select ('a2515151-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       case when n <= 5 then 'a1515151-0000-0000-0000-000000000001' when n <= 7 then 'a1515151-0000-0000-0000-000000000002'
            else 'a1515151-0000-0000-0000-000000000003' end::uuid,
       ('15151515-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'accepted'
from generate_series(2, 8) n;
-- Day-one check-in for W7 (older job): turned up.
insert into public.attendance (application_id, status) values ('a2515151-0000-0000-0000-000000000007', 'showed');

-- Ending
select pg_temp.as_dashboard();
select is(public.complete_finished_jobs(), 6, 'accepted workers on ended jobs become "ended"; running jobs are untouched');

-- Before the job ends you can't answer
select pg_temp.act_as('15151515-0000-0000-0000-000000000008');
select throws_ok($$ select public.answer_work_outcome('a2515151-0000-0000-0000-000000000008', 'worked') $$,
  '22023', null, 'cannot answer before the job ends');
select pg_temp.act_as('15151515-0000-0000-0000-000000000099');
select throws_ok($$ select public.answer_work_outcome('a2515151-0000-0000-0000-000000000002', 'worked') $$,
  '42501', null, 'other farms cannot answer');

-- Both say worked -> completed, verified
select pg_temp.act_as('15151515-0000-0000-0000-000000000002');
select is(public.answer_work_outcome('a2515151-0000-0000-0000-000000000002', 'worked'), 'waiting', 'first answer waits for the other side');
select ok(public.can_rate_farm('a2515151-0000-0000-0000-000000000002'), 'the worker can rate straight after saying it worked');
select throws_ok($$ select public.answer_work_outcome('a2515151-0000-0000-0000-000000000002', 'left_early') $$,
  '23505', null, 'an answer cannot be changed');
select is((select count(*)::int from public.pending_outcomes()), 0, 'nothing left for that worker to answer');
select pg_temp.act_as('15151515-0000-0000-0000-000000000001');
select is((select count(*)::int from public.pending_outcomes()), 5, 'the farm has 5 workers to answer for');
select is(public.answer_work_outcome('a2515151-0000-0000-0000-000000000002', 'worked'), 'completed', 'matching answers complete the job');
select is((select status::text || '|' || verified::text from public.applications a join public.work_outcomes w on w.application_id = a.id
           where a.id = 'a2515151-0000-0000-0000-000000000002'), 'completed|true', 'and it is a verified work record');

-- Both say left early -> completed, attendance left early
select public.answer_work_outcome('a2515151-0000-0000-0000-000000000003', 'left_early');
select pg_temp.act_as('15151515-0000-0000-0000-000000000003');
select is(public.answer_work_outcome('a2515151-0000-0000-0000-000000000003', 'left_early'), 'completed', 'both say left early');
select is((select status::text from public.attendance where application_id = 'a2515151-0000-0000-0000-000000000003'), 'left_early',
  'recorded as left early');

-- Both say it didn't happen -> counts as a no-show, not completed
select pg_temp.act_as('15151515-0000-0000-0000-000000000001');
select public.answer_work_outcome('a2515151-0000-0000-0000-000000000004', 'did_not_work');
select pg_temp.act_as('15151515-0000-0000-0000-000000000004');
select is(public.answer_work_outcome('a2515151-0000-0000-0000-000000000004', 'did_not_work'), 'not_worked', 'both say it didn''t happen');
select pg_temp.as_dashboard();
select is((select no_show_count from public.worker_reputation(array['15151515-0000-0000-0000-000000000004'::uuid])), 1,
  'that counts as a no-show');

-- Disagreement -> admin queue, nothing counts until decided
select pg_temp.act_as('15151515-0000-0000-0000-000000000001');
select public.answer_work_outcome('a2515151-0000-0000-0000-000000000005', 'did_not_work');
select pg_temp.act_as('15151515-0000-0000-0000-000000000005');
select is(public.answer_work_outcome('a2515151-0000-0000-0000-000000000005', 'worked'), 'disputed', 'different answers are disputed');
select pg_temp.as_dashboard();
select is((select reason::text from public.reports where id = (select dispute_report_id from public.work_outcomes where application_id = 'a2515151-0000-0000-0000-000000000005')),
  'work_outcome_dispute', 'the disagreement is in the reports queue');
select is((select no_show_count from public.worker_reputation(array['15151515-0000-0000-0000-000000000005'::uuid])), 0,
  'nothing counts against the worker while it''s open');
select public.admin_resolve_work_outcome((select dispute_report_id from public.work_outcomes where application_id = 'a2515151-0000-0000-0000-000000000005'),
  'worked', 'Payslip shows 5 shifts');
select is((select status::text || '|' || verified::text || '|' || resolved_by from public.applications a join public.work_outcomes w on w.application_id = a.id
           where a.id = 'a2515151-0000-0000-0000-000000000005'), 'completed|false|admin', 'the admin decides (not verified by both)');

-- After 7 days: one answer is used; else the day-one check-in
select pg_temp.act_as('15151515-0000-0000-0000-000000000006');
select public.answer_work_outcome('a2515151-0000-0000-0000-000000000006', 'worked');
select pg_temp.as_dashboard();
select public.complete_finished_jobs();
select is((select status::text || '|' || verified::text || '|' || resolved_by from public.applications a join public.work_outcomes w on w.application_id = a.id
           where a.id = 'a2515151-0000-0000-0000-000000000006'), 'completed|false|timeout', 'a single answer is used after 7 days, unverified');
select is((select status::text || '|' || resolved_by from public.applications a join public.work_outcomes w on w.application_id = a.id
           where a.id = 'a2515151-0000-0000-0000-000000000007'), 'completed|timeout', 'with no answers, the farm''s check-in is used');
select is((select status::text from public.applications where id = 'a2515151-0000-0000-0000-000000000002'), 'completed',
  'settled jobs are left alone');

select * from finish();
rollback;
