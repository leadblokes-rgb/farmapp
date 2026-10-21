import { visaRules as defaultRules, type TrackerGoal, type VisaRules } from './config/visaRules';

// Pure, unit-tested estimate of specified-work days. All rules come from config/visaRules.ts.

export interface TrackerEmployer {
  id: string;
  name: string;
  /** The worker says this employer's work is specified work in an eligible postcode. */
  countsAsSpecified: boolean;
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
  notes: string[];
}

const DAY_MS = 86_400_000;
const toDay = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY_MS;
/** Monday-based week key. 1970-01-01 was a Thursday, so shift by 3 days. */
const weekOf = (day: number) => Math.floor((day + 3) / 7);

export function estimateDays(
  employers: TrackerEmployer[],
  shifts: ShiftLog[],
  payslips: Payslip[],
  goal: TrackerGoal = 'second',
  rules: VisaRules = defaultRules,
): DayEstimate {
  const eligible = new Map(employers.filter((e) => e.countsAsSpecified).map((e) => [e.id, e]));
  const notes: string[] = [];

  // Each counted calendar day -> the employer credited with it (first come), so a day counts once.
  const counted = new Map<number, string>();
  // Part-days from short shifts when rules.shortShifts === 'proportional'.
  const fractional = new Map<string, number>();
  const credit = (day: number, employerId: string) => {
    if (!counted.has(day)) counted.set(day, employerId);
  };

  // 1) Payslips are the strongest evidence. A full-time pay period counts every calendar day in it;
  //    otherwise the stated days worked are spread from the start of the period.
  const payslipCover: { employerId: string; start: number; end: number }[] = [];
  for (const p of payslips) {
    if (!eligible.has(p.employerId)) continue;
    const start = toDay(p.periodStart);
    const end = toDay(p.periodEnd);
    const length = end - start + 1;
    payslipCover.push({ employerId: p.employerId, start, end });
    const weeklyHours = (p.hoursTotal / length) * 7;
    if (weeklyHours >= rules.fullTimeWeekHours) {
      for (let d = start; d <= end; d++) credit(d, p.employerId);
    } else {
      for (let d = start; d < start + Math.min(p.daysWorked, length); d++) credit(d, p.employerId);
    }
  }

  // 2) Shift logs, ignoring days already covered by a payslip from the same employer.
  const shiftsByWeek = new Map<number, { day: number; employerId: string; hours: number }[]>();
  for (const s of shifts) {
    if (!eligible.has(s.employerId) || s.hours <= 0) continue;
    const day = toDay(s.workDate);
    if (payslipCover.some((c) => c.employerId === s.employerId && day >= c.start && day <= c.end)) continue;
    const week = weekOf(day);
    shiftsByWeek.set(week, [
      ...(shiftsByWeek.get(week) ?? []),
      { day, employerId: s.employerId, hours: s.hours },
    ]);
  }

  for (const [week, list] of shiftsByWeek) {
    const hours = list.reduce((sum, s) => sum + s.hours, 0);
    if (hours >= rules.fullTimeWeekHours) {
      // Full-time week: all 7 days, credited to whoever worked the most hours that week.
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
    notes.push(
      `Shifts under ${rules.fullDayHours} hours in a part-time week aren't counted. Check with Home Affairs if most of your shifts are short.`,
    );
  }
  if (employers.some((e) => !e.countsAsSpecified)) {
    notes.push('Work you marked as not specified work is not counted.');
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
    notes,
  };
}
