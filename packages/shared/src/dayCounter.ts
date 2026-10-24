import { isoToDisplay } from './dates';
import { message, messageText, type Message } from './messages';
import { visaRules as defaultRules, type TrackerGoal, type VisaRules } from './config/visaRules';

// Pure, unit-tested estimate of specified-work days. All rules come from config/visaRules.ts.

export interface TrackerEmployer {
  id: string;
  name: string;
  /** The worker says this employer's work is specified work in an eligible postcode. */
  countsAsSpecified: boolean;
  postcode?: string | null;
  /**
   * Whether the postcode is on the eligible list for the worker's visa (tagged by the database:
   * plant & animal cultivation). Null/undefined when it doesn't apply.
   */
  postcodeEligible?: boolean | null;
}

export interface ShiftLog {
  employerId: string;
  workDate: string; // ISO date
  hours: number;
}

export interface Payslip {
  employerId: string;
  periodStart: string;
  periodEnd: string;
  daysWorked: number;
  hoursTotal: number;
}

export interface DayEstimate {
  goal: TrackerGoal;
  target: number;
  totalDays: number;
  remaining: number;
  /** 0–1 */
  progress: number;
  byEmployer: { employerId: string; name: string; days: number; countsAsSpecified: boolean }[];
  /** Notes in English (see noteMessages for the translatable form). */
  notes: string[];
  noteMessages: Message[];
}

const DAY_MS = 86_400_000;
const toDay = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY_MS;
/** Monday-based week key. 1970-01-01 was a Thursday, so shift by 3 days. */
const weekOf = (day: number) => Math.floor((day + 3) / 7);

export interface EstimateOptions {
  goal?: TrackerGoal;
  rules?: VisaRules;
  /** ISO date of "today" (device local). Nothing after it is ever counted. */
  today: string;
  /** The worker's visa, named in notes about employers outside eligible postcodes. */
  visaType?: string | null;
}

export function estimateDays(
  employers: TrackerEmployer[],
  shifts: ShiftLog[],
  payslips: Payslip[],
  { goal = 'second', rules = defaultRules, today, visaType }: EstimateOptions,
): DayEstimate {
  const eligible = new Map(employers.filter((e) => e.countsAsSpecified).map((e) => [e.id, e]));
  const notes: Message[] = [];
  const todayN = toDay(today);
  let futureIgnored = false;

  // Each counted calendar day -> the employer credited with it (first come), so a day counts once.
  const counted = new Map<number, string>();
  // Part-days from short shifts when rules.shortShifts === 'proportional'.
  const fractional = new Map<string, number>();
  const credit = (day: number, employerId: string) => {
    if (day > todayN) {
      futureIgnored = true;
      return;
    }
    if (!counted.has(day)) counted.set(day, employerId);
  };

  // 1) Payslips are the strongest evidence. A pay period counts every calendar day only if it was
  //    full-time in both hours and days worked. Otherwise each day worked must meet the full-day
  //    hours, like a shift: the days counted are capped at what the total hours support
  //    (placed from the start of the period).
  const payslipCover: { employerId: string; start: number; end: number }[] = [];
  for (const p of payslips) {
    if (!eligible.has(p.employerId)) continue;
    const start = toDay(p.periodStart);
    const end = toDay(p.periodEnd);
    const length = end - start + 1;
    payslipCover.push({ employerId: p.employerId, start, end });
    const weeklyHours = (p.hoursTotal / length) * 7;
    const weeklyDays = (p.daysWorked / length) * 7;
    if (weeklyHours >= rules.fullTimeWeekHours && weeklyDays >= rules.fullTimeWeekMinDays) {
      for (let d = start; d <= end; d++) credit(d, p.employerId);
    } else {
      const days = Math.min(p.daysWorked, length);
      const fullDays = Math.min(days, Math.floor(p.hoursTotal / rules.fullDayHours));
      for (let d = start; d < start + fullDays; d++) credit(d, p.employerId);
      if (rules.shortShifts === 'proportional') {
        const extra = Math.min(days, p.hoursTotal / rules.fullDayHours) - fullDays;
        if (extra > 0) fractional.set(p.employerId, (fractional.get(p.employerId) ?? 0) + extra);
      }
      if (fullDays < days) {
        const name = eligible.get(p.employerId)!.name;
        notes.push(
          message('notes.payslipPartTime', {
            name,
            start: isoToDisplay(p.periodStart),
            end: isoToDisplay(p.periodEnd),
            hours: p.hoursTotal,
            count: fullDays,
            dayHours: rules.fullDayHours,
            days,
          }),
        );
      }
    }
  }

  // 2) Shift logs, ignoring days already covered by a payslip from the same employer.
  const shiftsByWeek = new Map<number, { day: number; employerId: string; hours: number }[]>();
  for (const s of shifts) {
    if (!eligible.has(s.employerId) || s.hours <= 0) continue;
    const day = toDay(s.workDate);
    if (day > todayN) {
      futureIgnored = true;
      continue;
    }
    if (payslipCover.some((c) => c.employerId === s.employerId && day >= c.start && day <= c.end)) continue;
    const week = weekOf(day);
    shiftsByWeek.set(week, [
      ...(shiftsByWeek.get(week) ?? []),
      { day, employerId: s.employerId, hours: s.hours },
    ]);
  }

  for (const [week, list] of shiftsByWeek) {
    const hours = list.reduce((sum, s) => sum + s.hours, 0);
    const workDays = new Set(list.map((s) => s.day)).size;
    if (hours >= rules.fullTimeWeekHours && workDays >= rules.fullTimeWeekMinDays) {
      // Full-time week: all 7 days (never past today), credited to whoever worked the most hours.
      const top = [...list].sort((a, b) => b.hours - a.hours)[0]!.employerId;
      const monday = week * 7 - 3;
      for (let d = monday; d < monday + 7; d++) credit(d, top);
      continue;
    }
    for (const s of list) {
      if (s.hours >= rules.fullDayHours) credit(s.day, s.employerId);
      else if (rules.shortShifts === 'proportional' && !counted.has(s.day)) {
        fractional.set(s.employerId, (fractional.get(s.employerId) ?? 0) + s.hours / rules.fullDayHours);
      }
    }
  }

  const ignoredShort = shifts.some(
    (s) => eligible.has(s.employerId) && s.hours > 0 && s.hours < rules.fullDayHours,
  );
  if (ignoredShort && rules.shortShifts === 'ignore') {
    notes.push(message('notes.shortShifts', { dayHours: rules.fullDayHours }));
  }
  if (futureIgnored) {
    notes.push(message('notes.future'));
  }
  for (const e of employers) {
    if (e.countsAsSpecified && e.postcodeEligible === false) {
      notes.push(
        visaType
          ? message('notes.notEligiblePostcode', { name: e.name, postcode: e.postcode ?? '', visa: visaType })
          : message('notes.notEligiblePostcodeNoVisa', { name: e.name, postcode: e.postcode ?? '' }),
      );
    }
  }
  if (employers.some((e) => !e.countsAsSpecified)) {
    notes.push(message('notes.notSpecified'));
  }

  const byEmployer = employers.map((e) => {
    let days = 0;
    for (const id of counted.values()) if (id === e.id) days++;
    days += Math.floor(fractional.get(e.id) ?? 0);
    return { employerId: e.id, name: e.name, days, countsAsSpecified: e.countsAsSpecified };
  });

  const target = rules.targets[goal];
  const totalDays = byEmployer.reduce((sum, e) => sum + e.days, 0);
  return {
    goal,
    target,
    totalDays,
    remaining: Math.max(0, target - totalDays),
    progress: Math.min(1, totalDays / target),
    byEmployer,
    notes: notes.map(messageText),
    noteMessages: notes,
  };
}
