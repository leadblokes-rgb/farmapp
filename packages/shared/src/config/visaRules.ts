// ⚠️ SINGLE SOURCE for the specified-work day tracker. Government rules change: review this file
// whenever Home Affairs updates its guidance, and bump rulesVersion/lastReviewed.
//
// The tracker gives an ESTIMATE ONLY. It is not immigration advice. Official guidance:
// https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/work-holiday-417/specified-work
//
// Home Affairs' principle: you must complete the same number of normal work days (or shifts) that a
// full-time employee in that role and industry would work in an 88 (or 179) calendar-day period.
// Public guides agree that a full-time week counts as 7 days (weekends included) but disagree on
// part-time hours, so the thresholds below are deliberately conservative and easy to change.

export const visaRules = {
  rulesVersion: '2026-10',
  lastReviewed: '2026-10-21',
  sourceUrl:
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/work-holiday-417/specified-work',

  /** Days needed: 2nd visa (during the 1st) and 3rd visa (during the 2nd). */
  targets: { second: 88, third: 179 },

  /** Visa types the tracker is relevant for. */
  appliesToVisaTypes: ['417', '462'] as const,

  /**
   * A Monday–Sunday week where you worked at least this many hours (in specified work) counts as
   * 7 days, weekends included. Horticulture full-time ordinary hours are 38/week; some employers use 35.
   */
  fullTimeWeekHours: 35,

  /** In a week that isn't full-time, a shift of at least this many hours counts as one day. */
  fullDayHours: 7,

  /**
   * Shorter shifts in part-time weeks: 'ignore' (conservative: two half days ≠ one day) or
   * 'proportional' (hours / fullDayHours).
   */
  shortShifts: 'ignore' as 'ignore' | 'proportional',

  /** A calendar day is counted once, even if you worked for two employers that day. */
  countEachCalendarDayOnce: true,

  disclaimer:
    'Estimate only, not immigration advice. Home Affairs decides what counts. Keep your payslips and check the official guidance or ask a registered migration agent.',
} as const;

export type VisaRules = typeof visaRules;
export type TrackerGoal = keyof VisaRules['targets'];
