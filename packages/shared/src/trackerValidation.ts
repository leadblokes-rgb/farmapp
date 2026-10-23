// Validation for day-tracker entries, shared by the app forms. The database enforces the same
// limits (supabase/migrations/*_tracker_limits.sql), so bad data can't get in either way.

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

/** First problem with a payslip, as a message for the user, or null if it can be saved. */
export function validatePayslip(p: PayslipDraft, today: string): string | null {
  if (!p.periodStart || !p.periodEnd) return 'Enter the pay period start and end dates.';
  if (p.periodEnd < p.periodStart) return 'The pay period ends before it starts.';
  if (p.periodStart > today || p.periodEnd > today) return 'The pay period can’t be in the future.';
  const periodDays = daysBetween(p.periodStart, p.periodEnd) + 1;
  if (periodDays > trackerLimits.maxPayslipPeriodDays)
    return `A pay period can be at most ${trackerLimits.maxPayslipPeriodDays} days. Add longer periods as separate payslips.`;
  if (!Number.isInteger(p.daysWorked) || p.daysWorked < 1) return 'Enter how many days you worked.';
  if (p.daysWorked > periodDays)
    return `You can’t have worked ${p.daysWorked} days in a ${periodDays}-day period.`;
  if (p.hoursTotal == null || !Number.isFinite(p.hoursTotal) || p.hoursTotal <= 0)
    return 'Enter the total hours on the payslip.';
  if (p.hoursTotal > trackerLimits.maxHoursPerDay * p.daysWorked)
    return `${p.hoursTotal} hours is more than ${trackerLimits.maxHoursPerDay} hours a day for ${p.daysWorked} day${p.daysWorked === 1 ? '' : 's'}. Check the hours and days worked.`;
  return null;
}

export interface ShiftDraft {
  workDate: string | null;
  hours: number;
}

export function validateShift(s: ShiftDraft, today: string): string | null {
  if (!s.workDate) return 'Choose the date you worked.';
  if (s.workDate > today) return 'You can’t log a shift in the future.';
  if (!Number.isFinite(s.hours) || s.hours <= 0) return 'Enter the hours you worked.';
  if (s.hours > trackerLimits.maxHoursPerDay) return `A shift can be at most ${trackerLimits.maxHoursPerDay} hours.`;
  return null;
}
