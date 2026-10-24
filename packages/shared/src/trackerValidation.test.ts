import { describe, expect, it } from 'vitest';
import { validatePayslip, validateShift } from './trackerValidation';

const today = '2027-03-20';
const ok = { periodStart: '2027-03-01', periodEnd: '2027-03-14', daysWorked: 10, hoursTotal: 76 };

describe('validatePayslip', () => {
  it('accepts a normal fortnightly payslip', () => {
    expect(validatePayslip(ok, today)).toBeNull();
  });
  it('needs both dates', () => {
    expect(validatePayslip({ ...ok, periodStart: null }, today)).toMatch(/start and end dates/);
    expect(validatePayslip({ ...ok, periodEnd: null }, today)).toMatch(/start and end dates/);
  });
  it('rejects an end date before the start', () => {
    expect(validatePayslip({ ...ok, periodStart: '2027-03-10', periodEnd: '2027-03-01' }, today)).toMatch(
      /ends before/,
    );
  });
  it('rejects future dates', () => {
    expect(validatePayslip({ ...ok, periodEnd: '2027-03-21' }, today)).toMatch(/future/);
  });
  it('rejects periods longer than 31 days', () => {
    expect(validatePayslip({ ...ok, periodStart: '2027-02-01', periodEnd: '2027-03-04' }, today)).toMatch(
      /at most 31 days/,
    );
    expect(validatePayslip({ ...ok, periodStart: '2027-02-02', periodEnd: '2027-03-04' }, today)).toBeNull();
  });
  it('rejects more days worked than days in the period', () => {
    expect(validatePayslip({ ...ok, periodEnd: '2027-03-07', daysWorked: 8 }, today)).toMatch(
      /8 days in a 7-day period/,
    );
  });
  it('rejects more than 24 hours per day worked', () => {
    expect(validatePayslip({ ...ok, daysWorked: 2, hoursTotal: 49 }, today)).toMatch(
      /more than 24 hours a day/,
    );
    expect(validatePayslip({ ...ok, daysWorked: 2, hoursTotal: 48 }, today)).toBeNull();
  });
  it('needs hours and at least one day', () => {
    expect(validatePayslip({ ...ok, hoursTotal: null }, today)).toMatch(/total hours/);
    expect(validatePayslip({ ...ok, daysWorked: 0 }, today)).toMatch(/how many days/);
  });
});

describe('validateShift', () => {
  it('accepts today', () => expect(validateShift({ workDate: today, hours: 8 }, today)).toBeNull());
  it('needs a date', () => expect(validateShift({ workDate: null, hours: 8 }, today)).toMatch(/date/));
  it('rejects the future', () =>
    expect(validateShift({ workDate: '2027-03-21', hours: 8 }, today)).toMatch(/future/));
  it('rejects more than 24 hours', () =>
    expect(validateShift({ workDate: today, hours: 24.5 }, today)).toMatch(/at most 24/));
});
