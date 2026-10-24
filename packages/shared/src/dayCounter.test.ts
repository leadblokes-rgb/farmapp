import { describe, expect, it } from 'vitest';
import { visaRules } from './config/visaRules';
import { estimateDays, type ShiftLog } from './dayCounter';

const farm = { id: 'farm', name: 'Lockyer Fresh', countsAsSpecified: true };
const cafe = { id: 'cafe', name: 'Brisbane cafe', countsAsSpecified: false };
const other = { id: 'other', name: 'Bundy Sweet Potato', countsAsSpecified: true };
const today = '2027-12-31';
const opts = { today };

// 2027-03-01 is a Monday.
const week = (start: string, hours: number[], employerId = 'farm'): ShiftLog[] =>
  hours.map((h, i) => {
    const d = new Date(`${start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return { employerId, workDate: d.toISOString().slice(0, 10), hours: h };
  });

describe('estimateDays', () => {
  it('counts a full-time week (5 x 8h) as 7 days', () => {
    const r = estimateDays([farm], week('2027-03-01', [8, 8, 8, 8, 8]), [], opts);
    expect(r.totalDays).toBe(7);
    expect(r.target).toBe(88);
    expect(r.remaining).toBe(81);
  });

  it('counts only full days in a part-time week', () => {
    const r = estimateDays([farm], week('2027-03-01', [8, 0, 8, 4]), [], opts);
    expect(r.totalDays).toBe(2); // the 4h shift doesn't count by default
    expect(r.notes.join(' ')).toMatch(/Shifts under 7 hours/);
  });

  it('can count short shifts proportionally if the rules say so', () => {
    const rules = { ...visaRules, shortShifts: 'proportional' as const };
    const r = estimateDays([farm], week('2027-03-01', [3.5, 3.5]), [], { rules, today });
    expect(r.totalDays).toBe(1);
  });

  it('counts a calendar day once across two employers', () => {
    const shifts = [
      { employerId: 'farm', workDate: '2027-03-02', hours: 8 },
      { employerId: 'other', workDate: '2027-03-02', hours: 8 },
    ];
    const r = estimateDays([farm, other], shifts, [], opts);
    expect(r.totalDays).toBe(1);
  });

  it('ignores work not marked as specified work', () => {
    const r = estimateDays([farm, cafe], week('2027-03-01', [8, 8, 8, 8, 8], 'cafe'), [], opts);
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
      opts,
    );
    expect(r.totalDays).toBe(14);
  });

  it('uses days worked from a part-time payslip and does not double count shifts in that period', () => {
    const r = estimateDays(
      [farm],
      week('2027-03-01', [8, 8, 8]),
      [
        {
          employerId: 'farm',
          periodStart: '2027-03-01',
          periodEnd: '2027-03-14',
          daysWorked: 6,
          hoursTotal: 48,
        },
      ],
      opts,
    );
    expect(r.totalDays).toBe(6);
  });

  it('tracks the 3rd-visa target of 179 days', () => {
    const r = estimateDays([farm], week('2027-03-01', [8, 8, 8, 8, 8]), [], { goal: 'third', today });
    expect(r.target).toBe(179);
    expect(r.progress).toBeCloseTo(7 / 179);
  });

  it('breaks the total down by employer', () => {
    const shifts = [...week('2027-03-01', [8, 8, 8, 8, 8]), ...week('2027-03-08', [8, 8], 'other')];
    const r = estimateDays([farm, other], shifts, [], opts);
    expect(r.byEmployer.find((e) => e.employerId === 'farm')!.days).toBe(7);
    expect(r.byEmployer.find((e) => e.employerId === 'other')!.days).toBe(2);
    expect(r.totalDays).toBe(9);
  });

  it('caps progress at 100%', () => {
    const shifts = Array.from({ length: 14 }, (_, w) =>
      week(`2027-${String(1 + Math.floor(w / 4)).padStart(2, '0')}-0${1 + (w % 4)}`, [8, 8, 8, 8, 8]),
    ).flat();
    const r = estimateDays([farm], shifts, [], opts);
    expect(r.progress).toBeLessThanOrEqual(1);
    expect(r.remaining).toBeGreaterThanOrEqual(0);
  });

  it('does not count 35 hours over 2 days as a full-time week', () => {
    const r = estimateDays([farm], week('2027-03-01', [17.5, 17.5]), [], opts);
    expect(r.totalDays).toBe(2);
  });

  it('does not count 35 hours over 4 days as a full-time week', () => {
    const r = estimateDays([farm], week('2027-03-01', [9, 9, 9, 8]), [], opts);
    expect(r.totalDays).toBe(4);
  });

  it('never counts shifts after today', () => {
    const r = estimateDays([farm], week('2027-03-01', [8, 8, 8, 8, 8]), [], { today: '2027-03-02' });
    // Mon + Tue worked so far; the rest of the week is in the future.
    expect(r.totalDays).toBe(2);
    expect(r.notes.join(' ')).toMatch(/after today/);
  });

  it('stops a full-time week at today', () => {
    const r = estimateDays([farm], week('2027-03-01', [8, 8, 8, 8, 8]), [], { today: '2027-03-05' });
    expect(r.totalDays).toBe(5);
  });

  it('never counts payslip days after today', () => {
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
      { today: '2027-03-07' },
    );
    expect(r.totalDays).toBe(7);
    expect(r.notes.join(' ')).toMatch(/after today/);
  });

  it('does not treat a high-hours payslip with few days worked as full-time', () => {
    const r = estimateDays(
      [farm],
      [],
      [
        {
          employerId: 'farm',
          periodStart: '2027-03-01',
          periodEnd: '2027-03-14',
          daysWorked: 4,
          hoursTotal: 80,
        },
      ],
      opts,
    );
    expect(r.totalDays).toBe(4);
  });

  it('counts only the days a payslip’s hours support (5 days but 12 hours = 1 day)', () => {
    const r = estimateDays(
      [farm],
      [],
      [{ employerId: 'farm', periodStart: '2027-03-01', periodEnd: '2027-03-07', daysWorked: 5, hoursTotal: 12 }],
      opts,
    );
    expect(r.totalDays).toBe(1);
    expect(r.notes.join(' ')).toMatch(/12 hours only covers 1 full day of 7\+ hours, so 1 of the 5 days worked is counted/);
  });

  it('counts nothing from a payslip with less than one full day of hours', () => {
    const r = estimateDays(
      [farm],
      [],
      [{ employerId: 'farm', periodStart: '2027-03-01', periodEnd: '2027-03-07', daysWorked: 3, hoursTotal: 6 }],
      opts,
    );
    expect(r.totalDays).toBe(0);
  });

  it('still counts a full-time payslip week (35+ hours over 5 days) as 7 days', () => {
    const r = estimateDays(
      [farm],
      [],
      [{ employerId: 'farm', periodStart: '2027-03-01', periodEnd: '2027-03-07', daysWorked: 5, hoursTotal: 38 }],
      opts,
    );
    expect(r.totalDays).toBe(7);
    expect(r.notes.join(' ')).not.toMatch(/only covers/);
  });

  it('counts payslip hours proportionally if the rules say so', () => {
    const rules = { ...visaRules, shortShifts: 'proportional' as const };
    const r = estimateDays(
      [farm],
      [],
      [{ employerId: 'farm', periodStart: '2027-03-01', periodEnd: '2027-03-14', daysWorked: 5, hoursTotal: 21 }],
      { rules, today },
    );
    expect(r.totalDays).toBe(3);
  });

  it('flags employers the database tagged as outside eligible postcodes', () => {
    const r = estimateDays(
      [{ id: 'city', name: 'City packing', countsAsSpecified: true, postcode: '4000', postcodeEligible: false }],
      [],
      [],
      { today, visaType: '417' },
    );
    expect(r.notes.join(' ')).toMatch(/City packing \(4000\) isn’t an eligible postcode for 417 plant & animal cultivation/);
  });
});
