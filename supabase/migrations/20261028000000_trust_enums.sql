-- New enum values for check-in, no-show disputes and review reports. In their own migration
-- because Postgres can't use a new enum value in the same transaction that adds it.

create type public.attendance_status as enum ('showed', 'no_show', 'left_early');

alter type public.report_reason add value if not exists 'no_show_dispute';
alter type public.report_reason add value if not exists 'inappropriate_review';
