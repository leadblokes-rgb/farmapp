import { describe, expect, it } from 'vitest';
import { visaRules } from './config/visaRules';
import { estimateDays, type ShiftLog } from './dayCounter';

const farm = { id: 'farm', name: 'Lockyer Fresh', countsAsSpecified: true };
const cafe = { id: 'cafe', name: 'Brisbane cafe', countsAsSpecified: false };
const other = { id: 'other', name: 'Bundy Sweet Potato', countsAsSpecified: true };

// 2027-03-01 is a Monday.
const week = (start: string, hours: number[], employerId = 'farm'): ShiftLog[] =>
  hours.map((h, i) => {
    const d = new Date(`${start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return { employerId, workDate: d.toISOString().slice(0, 10), hours: h };
  });

describe('estimateDays', () => {
  it('counts a full-time week (5 x 8h) as 7 days', () => {
    const r = estimateDays([farm], week('2027-03-01', [8, 8, 8, 8, 8]), []);
    expect(r.totalDays).toBe(7);
    expect(r.target).toBe(88);
    expect(r.remaining).toBe(81);
  });

  it('counts only full days in a part-time week', () => {
    const r = estimateDays([farm], week('2027-03-01', [8, 0, 8, 4]), []);
    expect(r.totalDays).toBe(2); // the 4h shift doesn't count by default
    expect(r.notes.join(' ')).toMatch(/Shifts under 7 hours/);
  });

  it('can count short shifts proportionally if the rules say so', () => {
    const rules = { ...visaRules, shortShifts: 'proportional' as const };
    const r = estimateDays([farm], week('2027-03-01', [3.5, 3.5]), [], 'second', rules);
    expect(r.totalDays).toBe(1);
  });

  it('counts a calendar day once across two employers', () => {
    const shifts = [
      { employerId: 'farm', workDate: '2027-03-02', hours: 8 },
      { employerId: 'other', workDate: '2027-03-02', hours: 8 },
    ];
    const r = estimateDays([farm, other], shifts, []);
    expect(r.totalDays).toBe(1);
  });

  it('ignores work not marked as specified work', () => {
    const r = estimateDays([farm, cafe], week('2027-03-01', [8, 8, 8, 8, 8], 'cafe'), []);
    expect(r.totalDays).toBe(0);
    expect(r.notes.join(' ')).toMatch(/not specified work/);
  });

  it('counts a full-time payslip period as every calendar day', () => {
    const r = estimateDays(
      [farm],
      [],
      [
        {
          employerId: 'farm',
          periodStart: '2027-03-01',
          periodEnd: '2027-03-14',
          daysWorked: 10,
          hoursTotal: 76,
        },
      ],
    );
    expect(r.totalDays).toBe(14);
  });

  it('uses days worked from a part-time payslip and does not double count shifts in that period', () => {
    const r = estimateDays([farm], week('2027-03-01', [8, 8, 8]), [
      {
        employerId: 'farm',
        periodStart: '2027-03-01',
        periodEnd: '2027-03-14',
        daysWorked: 6,
        hoursTotal: 48,
      },
    ]);
    expect(r.totalDays).toBe(6);
  });

  it('tracks the 3rd-visa target of 179 days', () => {
    const r = estimateDays([farm], week('2027-03-01', [8, 8, 8, 8, 8]), [], 'third');
    expect(r.target).toBe(179);
    expect(r.progress).toBeCloseTo(7 / 179);
  });

  it('breaks the total down by employer', () => {
    const shifts = [...week('2027-03-01', [8, 8, 8, 8, 8]), ...week('2027-03-08', [8, 8], 'other')];
    const r = estimateDays([farm, other], shifts, []);
    expect(r.byEmployer.find((e) => e.employerId === 'farm')!.days).toBe(7);
    expect(r.byEmployer.find((e) => e.employerId === 'other')!.days).toBe(2);
    expect(r.totalDays).toBe(9);
  });

  it('caps progress at 100%', () => {
    const shifts = Array.from({ length: 14 }, (_, w) =>
      week(`2027-${String(1 + Math.floor(w / 4)).padStart(2, '0')}-0${1 + (w % 4)}`, [8, 8, 8, 8, 8]),
    ).flat();
    const r = estimateDays([farm], shifts, []);
    expect(r.progress).toBeLessThanOrEqual(1);
    expect(r.remaining).toBeGreaterThanOrEqual(0);
  });
});
