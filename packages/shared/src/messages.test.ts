import { describe, expect, it } from 'vitest';
import { EMPLOYMENT_TYPES } from './config/payRules';
import { JOB_ROLES } from './config/jobRoles';
import { SKILLS } from './config/skills';
import { visaRules } from './config/visaRules';
import { VISA_TYPE_LABELS } from './enums';
import en from './i18n/en.json';
import { jobSchema, workerProfileSchema } from './schemas';
import { messageText } from './messages';

describe('shared translations (i18n/en.json)', () => {
  it('match the English labels in the config', () => {
    for (const r of JOB_ROLES) expect(en.labels.roles[r.key]).toBe(r.label);
    for (const s of SKILLS) expect(en.labels.skills[s.key]).toBe(s.label);
    for (const [k, v] of Object.entries(VISA_TYPE_LABELS))
      expect(en.labels.visaTypes[k as keyof typeof en.labels.visaTypes]).toBe(v);
    for (const e of EMPLOYMENT_TYPES) {
      expect(en.labels.employmentTypes[e.key]).toBe(e.label);
      expect(en.labels.employmentDescriptions[e.key]).toBe(e.description);
    }
    expect(en.disclaimer).toBe(visaRules.disclaimer);
  });

  it('cover every validation message the schemas can produce', () => {
    const codes = [
      ...(workerProfileSchema.safeParse({}).error?.issues ?? []),
      ...(jobSchema.safeParse({ payType: 'piece_rate', pieceRateUnit: '', endDate: '1', startDate: '2' })
        .error?.issues ?? []),
    ]
      .map((i) => i.message)
      .filter((m) => m.startsWith('validation.'));
    expect(codes.length).toBeGreaterThan(3);
    for (const c of codes) expect(messageText({ code: c })).not.toBe(c);
  });

  it('fills placeholders and picks plurals', () => {
    expect(messageText({ code: 'tracker.shiftTooLong', params: { max: 24 } })).toBe(
      'A shift can be at most 24 hours.',
    );
    expect(
      messageText({ code: 'tracker.payslipTooManyHours', params: { hours: 30, max: 24, count: 1 } }),
    ).toMatch(/for 1 day\./);
  });
});
