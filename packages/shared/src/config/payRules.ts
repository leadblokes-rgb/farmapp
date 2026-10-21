// ⚠️ SINGLE SOURCE for minimum pay checks. Review every July after the Fair Work Annual Wage Review.
//
// Croppr only WARNS farms when a job looks underpaid; it is not legal or payroll advice.
// Source: Fair Work Ombudsman, Horticulture Award pay and piece rates
// https://horticulture.fairwork.gov.au/pay-and-piece-rates

export const payRules = {
  rulesVersion: '2026-07',
  lastReviewed: '2026-10-21',
  effectiveFrom: '2026-07-01',
  award: 'Horticulture Award 2020 [MA000028]',
  /** Level 1 adult casual hourly rate, including the 25% casual loading. */
  awardMinHourlyCents: 3218,
  /**
   * Since April 2022 the Horticulture Award requires piece-rate workers to earn at least the
   * minimum hourly rate for the hours they work. Jobs paid by piece rate must state the
   * hourly amount they guarantee.
   */
  pieceRateRequiresHourlyGuarantee: true,
  sourceUrl: 'https://horticulture.fairwork.gov.au/pay-and-piece-rates',
} as const;

export type PayType = 'hourly' | 'piece_rate';

/** The hourly figure workers can rely on: the hourly rate, or a piece-rate job's guaranteed minimum. */
export function effectiveHourlyCents(job: {
  payType: PayType;
  payRateCents: number;
  minHourlyGuaranteeCents: number | null;
}): number {
  return job.payType === 'hourly' ? job.payRateCents : (job.minHourlyGuaranteeCents ?? 0);
}

/** Warning text when a job's hourly figure is below the award minimum, else null. */
export function belowAwardWarning(job: {
  payType: PayType;
  payRateCents: number;
  minHourlyGuaranteeCents: number | null;
}): string | null {
  const hourly = effectiveHourlyCents(job);
  if (!hourly || hourly >= payRules.awardMinHourlyCents) return null;
  const min = (payRules.awardMinHourlyCents / 100).toFixed(2);
  const what = job.payType === 'hourly' ? 'This hourly rate' : 'This guaranteed hourly minimum';
  return `${what} is below the Horticulture Award casual minimum of $${min}/hr (from ${payRules.effectiveFrom}). Check your obligations with the Fair Work Ombudsman before posting.`;
}
