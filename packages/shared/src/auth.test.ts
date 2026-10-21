import { describe, expect, it } from 'vitest';
import { isValidEmail, isValidOtp, normaliseEmail } from './auth';
import { isSelfServeRole } from './enums';

describe('auth helpers', () => {
  it('normalises email', () => {
    expect(normaliseEmail('  Sam@Example.COM ')).toBe('sam@example.com');
  });

  it('validates email shape', () => {
    expect(isValidEmail('sam@example.com')).toBe(true);
    expect(isValidEmail('sam@example')).toBe(false);
    expect(isValidEmail('not an email')).toBe(false);
  });

  it('accepts only 6-digit codes', () => {
    expect(isValidOtp('123456')).toBe(true);
    expect(isValidOtp(' 123456 ')).toBe(true);
    expect(isValidOtp('12345')).toBe(false);
    expect(isValidOtp('12a456')).toBe(false);
  });

  it('never lets admin be self-selected', () => {
    expect(isSelfServeRole('worker')).toBe(true);
    expect(isSelfServeRole('farm')).toBe(true);
    expect(isSelfServeRole('admin')).toBe(false);
  });
});
