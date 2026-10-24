// Validation for day-tracker entries, shared by the app forms. The database enforces the same
// limits (supabase/migrations/*_tracker_limits.sql), so bad data can't get in either way.

import { message, messageText, type Message } from './messages';

export const trackerLimits = {
  /** Longest pay period one payslip may cover. */
  maxPayslipPeriodDays: 31,
  /** No one works more than this in a calendar day. */
  maxHoursPerDay: 24,
} as const;

const DAY_MS = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);

export interface PayslipDraft {
  periodStart: string | null;
  periodEnd: string | null;
  daysWorked: number;
  hoursTotal: number | null;
}

/** First problem with a payslip, or null if it can be saved. */
export function payslipIssue(p: PayslipDraft, today: string): Message | null {
  if (!p.periodStart || !p.periodEnd) return message('tracker.payslipDates');
  if (p.periodEnd < p.periodStart) return message('tracker.payslipBackwards');
  if (p.periodStart > today || p.periodEnd > today) return message('tracker.payslipFuture');
  const periodDays = daysBetween(p.periodStart, p.periodEnd) + 1;
  if (periodDays > trackerLimits.maxPayslipPeriodDays)
    return message('tracker.payslipTooLong', { max: trackerLimits.maxPayslipPeriodDays });
  if (!Number.isInteger(p.daysWorked) || p.daysWorked < 1) return message('tracker.payslipDays');
  if (p.daysWorked > periodDays)
    return message('tracker.payslipTooManyDays', { days: p.daysWorked, periodDays });
  if (p.hoursTotal == null || !Number.isFinite(p.hoursTotal) || p.hoursTotal <= 0)
    return message('tracker.payslipHours');
  if (p.hoursTotal > trackerLimits.maxHoursPerDay * p.daysWorked)
    return message('tracker.payslipTooManyHours', {
      hours: p.hoursTotal,
      max: trackerLimits.maxHoursPerDay,
      count: p.daysWorked,
    });
  return null;
}

/** First problem with a payslip, as English text, or null if it can be saved. */
export function validatePayslip(p: PayslipDraft, today: string): string | null {
  const issue = payslipIssue(p, today);
  return issue && messageText(issue);
}

export interface ShiftDraft {
  workDate: string | null;
  hours: number;
}

export function shiftIssue(s: ShiftDraft, today: string): Message | null {
  if (!s.workDate) return message('tracker.shiftDate');
  if (s.workDate > today) return message('tracker.shiftFuture');
  if (!Number.isFinite(s.hours) || s.hours <= 0) return message('tracker.shiftHours');
  if (s.hours > trackerLimits.maxHoursPerDay)
    return message('tracker.shiftTooLong', { max: trackerLimits.maxHoursPerDay });
  return null;
}

export function validateShift(s: ShiftDraft, today: string): string | null {
  const issue = shiftIssue(s, today);
  return issue && messageText(issue);
}
