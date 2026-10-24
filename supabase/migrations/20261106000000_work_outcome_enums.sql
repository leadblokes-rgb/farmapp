-- New enum values for "Did this work out?" (separate migration: a new enum value can't be used in
-- the transaction that adds it).

alter type public.application_status add value if not exists 'ended';
alter type public.report_reason add value if not exists 'work_outcome_dispute';
create type public.work_answer as enum ('worked', 'left_early', 'did_not_work');
