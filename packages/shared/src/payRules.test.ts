import { describe, expect, it } from 'vitest';
import { belowAwardWarning, effectiveHourlyCents, payRules } from './config/payRules';
import { formatCents, parseDollarsToCents } from './money';
import { jobSchema } from './schemas';

describe('pay rules', () => {
  it('uses the guarantee as the effective hourly rate for piece work', () => {
    expect(
      effectiveHourlyCents({ payType: 'piece_rate', payRateCents: 4500, minHourlyGuaranteeCents: 3300 }),
    ).toBe(3300);
    expect(
      effectiveHourlyCents({ payType: 'hourly', payRateCents: 3300, minHourlyGuaranteeCents: null }),
    ).toBe(3300);
  });

  it('warns below the award minimum, and not at or above it', () => {
    const min = payRules.awardMinHourlyCents.casual;
    expect(
      belowAwardWarning({ payType: 'hourly', payRateCents: min - 1, minHourlyGuaranteeCents: null }),
    ).toMatch(/below/);
    expect(
      belowAwardWarning({ payType: 'hourly', payRateCents: min, minHourlyGuaranteeCents: null }),
    ).toBeNull();
    expect(
      belowAwardWarning({ payType: 'piece_rate', payRateCents: 5000, minHourlyGuaranteeCents: min - 50 }),
    ).toMatch(/guaranteed hourly minimum/);
  });
});

describe('money', () => {
  it('formats and parses dollars', () => {
    expect(formatCents(3218)).toBe('$32.18');
    expect(formatCents(3200)).toBe('$32');
    expect(parseDollarsToCents('$32.18')).toBe(3218);
    expect(parseDollarsToCents('32,5')).toBe(3250);
    expect(parseDollarsToCents('abc')).toBeNull();
    expect(parseDollarsToCents('0')).toBeNull();
  });
});

const job = {
  title: 'Strawberry pickers',
  roleType: 'picking' as const,
  description: '',
  postcode: '4670',
  startDate: '2027-01-01',
  endDate: '2027-03-01',
  workersNeeded: 20,
  payType: 'piece_rate' as const,
  payRateCents: 450,
  pieceRateUnit: 'tray',
  minHourlyGuaranteeCents: 3218,
  hoursPerWeek: 38,
  accommodationProvided: false,
  accommodationCostWeekCents: null,
  transportProvided: false,
  carRequired: false,
  likelySpecifiedWork: true,
  employmentType: 'casual' as const,
};

describe('jobSchema', () => {
  it('accepts a piece-rate job with a guarantee', () => {
    expect(jobSchema.safeParse(job).success).toBe(true);
  });
  it('requires a guarantee and unit for piece-rate jobs', () => {
    expect(jobSchema.safeParse({ ...job, minHourlyGuaranteeCents: null }).success).toBe(false);
    expect(jobSchema.safeParse({ ...job, pieceRateUnit: '' }).success).toBe(false);
  });
  it('does not require a guarantee for hourly jobs', () => {
    expect(
      jobSchema.safeParse({ ...job, payType: 'hourly', minHourlyGuaranteeCents: null, pieceRateUnit: '' })
        .success,
    ).toBe(true);
  });
  it('requires an employment type', () => {
    expect(jobSchema.safeParse({ ...job, employmentType: undefined }).success).toBe(false);
  });
  it('rejects end before start', () => {
    expect(jobSchema.safeParse({ ...job, endDate: '2026-12-01' }).success).toBe(false);
  });

  it('uses the permanent rate for part-time and full-time jobs, and the casual rate (with loading) for casual', () => {
    expect(payRules.awardMinHourlyCents.full_time).toBe(2574);
    expect(payRules.awardMinHourlyCents.casual).toBe(Math.round(2574 * (1 + payRules.casualLoading)));
    const job = { payType: 'hourly' as const, payRateCents: 2800, minHourlyGuaranteeCents: null };
    expect(belowAwardWarning({ ...job, employmentType: 'full_time' })).toBeNull();
    expect(belowAwardWarning({ ...job, employmentType: 'part_time' })).toBeNull();
    expect(belowAwardWarning({ ...job, employmentType: 'casual' })).toMatch(/casual minimum of \$32\.18/);
    expect(belowAwardWarning({ ...job, payRateCents: 2500, employmentType: 'full_time' })).toMatch(
      /full-time minimum of \$25\.74/,
    );
  });
});
