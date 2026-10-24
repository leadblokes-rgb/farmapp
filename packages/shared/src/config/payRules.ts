import { message, messageText, type Message } from '../messages';
// ⚠️ SINGLE SOURCE for minimum pay checks. Review every July after the Fair Work Annual Wage Review.
//
// Croppr only WARNS farms when a job looks underpaid; it is not legal or payroll advice.
// Source: Fair Work Ombudsman, Horticulture Award pay and piece rates (Level 1 adult, from the first full
// pay period on or after 1 July 2026): full-time and part-time $25.74/hr; casual $32.18/hr, which is
// $25.74 plus the 25% casual loading.
// https://horticulture.fairwork.gov.au/pay-and-piece-rates

export const payRules = {
  rulesVersion: '2026-07',
  lastReviewed: '2026-10-21',
  effectiveFrom: '2026-07-01',
  award: 'Horticulture Award 2020 [MA000028]',
  /**
   * Level 1 adult minimum hourly rate by employment type. Casual includes the 25% casual loading
   * (paid instead of leave); part-time and full-time employees get the base rate plus paid leave.
   */
  awardMinHourlyCents: { casual: 3218, part_time: 2574, full_time: 2574 } as Record<EmploymentType, number>,
  casualLoading: 0.25,
  /**
   * Since April 2022 the Horticulture Award requires piece-rate workers to earn at least the
   * minimum hourly rate for the hours they work. Jobs paid by piece rate must state the
   * hourly amount they guarantee.
   */
  pieceRateRequiresHourlyGuarantee: true,
  sourceUrl: 'https://horticulture.fairwork.gov.au/pay-and-piece-rates',
} as const;

export type PayType = 'hourly' | 'piece_rate';
export type EmploymentType = 'casual' | 'part_time' | 'full_time';

export const EMPLOYMENT_TYPES = [
  { key: 'casual', label: 'Casual', description: 'Paid the 25% casual loading instead of paid leave' },
  { key: 'part_time', label: 'Part-time', description: 'Regular hours, with paid leave' },
  { key: 'full_time', label: 'Full-time', description: '38 hours a week, with paid leave' },
] as const satisfies readonly { key: EmploymentType; label: string; description: string }[];

export function employmentTypeLabel(t: EmploymentType): string {
  return EMPLOYMENT_TYPES.find((e) => e.key === t)?.label ?? t;
}

/** Award minimum hourly rate (Level 1 adult) for an employment type. */
export function awardMinHourlyCents(employmentType: EmploymentType = 'casual'): number {
  return payRules.awardMinHourlyCents[employmentType];
}

/** The hourly figure workers can rely on: the hourly rate, or a piece-rate job's guaranteed minimum. */
export function effectiveHourlyCents(job: {
  payType: PayType;
  payRateCents: number;
  minHourlyGuaranteeCents: number | null;
}): number {
  return job.payType === 'hourly' ? job.payRateCents : (job.minHourlyGuaranteeCents ?? 0);
}

/** Warning when a job's hourly figure is below the award minimum, else null. */
export function belowAwardIssue(job: {
  payType: PayType;
  payRateCents: number;
  minHourlyGuaranteeCents: number | null;
  employmentType?: EmploymentType;
}): Message | null {
  const type = job.employmentType ?? 'casual';
  const hourly = effectiveHourlyCents(job);
  const minCents = awardMinHourlyCents(type);
  if (!hourly || hourly >= minCents) return null;
  const kind = job.payType === 'hourly' ? 'hourly' : 'guarantee';
  return message(`pay.belowAward.${kind}.${type}`, {
    min: (minCents / 100).toFixed(2),
    from: payRules.effectiveFrom,
  });
}

/** The same warning as English text. */
export function belowAwardWarning(job: Parameters<typeof belowAwardIssue>[0]): string | null {
  const issue = belowAwardIssue(job);
  return issue && messageText(issue);
}
