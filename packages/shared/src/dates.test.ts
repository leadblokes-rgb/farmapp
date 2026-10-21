import { describe, expect, it } from 'vitest';
import { displayToIso, isoToDisplay } from './dates';

describe('dates', () => {
  it('round-trips DD/MM/YYYY', () => {
    expect(displayToIso('05/03/2027')).toBe('2027-03-05');
    expect(displayToIso('5/3/2027')).toBe('2027-03-05');
    expect(isoToDisplay('2027-03-05')).toBe('05/03/2027');
  });

  it('rejects impossible or malformed dates', () => {
    expect(displayToIso('31/02/2027')).toBeNull();
    expect(displayToIso('2027-03-05')).toBeNull();
    expect(displayToIso('13/13/2027')).toBeNull();
    expect(displayToIso('')).toBeNull();
  });

  it('accepts leap days only in leap years', () => {
    expect(displayToIso('29/02/2028')).toBe('2028-02-29');
    expect(displayToIso('29/02/2027')).toBeNull();
  });
});
