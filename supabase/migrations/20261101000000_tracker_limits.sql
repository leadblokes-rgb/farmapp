-- Day tracker limits, matching packages/shared/src/trackerValidation.ts:
-- pay periods up to 31 days, at most 24 hours per day worked, shifts up to 24 hours.
-- NOT VALID: applies to new and edited rows without failing on any older data.

alter table public.payslips drop constraint payslips_period_length_check;
alter table public.payslips add constraint payslips_period_length_check
  check (period_end - period_start + 1 <= 31) not valid;

alter table public.payslips drop constraint payslips_hours_check;
alter table public.payslips add constraint payslips_hours_check
  check (hours_total > 0 and hours_total <= 24 * days_worked) not valid;

alter table public.payslips add constraint payslips_days_worked_min_check check (days_worked >= 1) not valid;

alter table public.shift_logs drop constraint shift_logs_hours_check;
alter table public.shift_logs add constraint shift_logs_hours_check check (hours > 0 and hours <= 24) not valid;
