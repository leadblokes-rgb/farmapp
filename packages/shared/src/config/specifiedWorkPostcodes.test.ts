import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { estimateDays } from '../dayCounter';
import {
  isSpecifiedWorkPostcode,
  specifiedWorkForJob,
  specifiedWorkPostcodes,
} from './specifiedWorkPostcodes';

describe('specified-work postcodes', () => {
  it('knows regional farm towns and excludes capital cities', () => {
    for (const pc of ['4343', '4670', '4380', '4805', '2650', '3500', '6230', '0870', '5290', '7250'])
      expect(isSpecifiedWorkPostcode(pc, '417'), pc).toBe(true);
    for (const pc of ['4000', '2000', '3000', '6000', '2600', '4217'])
      expect(isSpecifiedWorkPostcode(pc, '417'), pc).toBe(false);
  });

  it('rejects malformed postcodes', () => {
    expect(isSpecifiedWorkPostcode('43', '417')).toBe(false);
    expect(isSpecifiedWorkPostcode(null, '462')).toBe(false);
  });

  it('labels a job for the viewing worker’s own subclass', () => {
    expect(specifiedWorkForJob({ postcode: '4343', roleType: 'picking' }, '462')).toEqual({
      eligible: true,
      label: 'Eligible postcode for 462 plant & animal cultivation',
    });
    expect(specifiedWorkForJob({ postcode: '4000', roleType: 'packing' }, '417').eligible).toBe(false);
    expect(specifiedWorkForJob({ postcode: '4343', roleType: 'picking' }, 'citizen_pr').eligible).toBeNull();
  });

  it('flags tracker employers outside eligible postcodes', () => {
    const r = estimateDays(
      [{ id: 'cafe', name: 'City packing', countsAsSpecified: true, postcode: '4000' }],
      [],
      [],
      { today: '2027-01-01', visaType: '417' },
    );
    expect(r.notes.join(' ')).toMatch(/City packing \(4000\) isn’t an eligible postcode for 417/);
  });

  it('matches the SQL copy in the migration', () => {
    const sql = readFileSync(
      join(__dirname, '../../../../supabase/migrations/20261030000000_saved_alerts_postcodes.sql'),
      'utf8',
    );
    const rows = [...sql.matchAll(/\('plant_animal_cultivation', '(417|462)', (\d+), (\d+)\)/g)].map(
      (m) => `${m[1]}:${m[2]}-${m[3]}`,
    );
    const expected = (['417', '462'] as const).flatMap((s) =>
      specifiedWorkPostcodes.categories.plant_animal_cultivation.ranges[s].map(([a, b]) => `${s}:${a}-${b}`),
    );
    expect(rows.sort()).toEqual(expected.sort());
  });
});
