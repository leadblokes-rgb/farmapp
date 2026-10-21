import { describe, expect, it } from 'vitest';
import { formatAbn, isValidAbn } from './abn';

describe('ABN', () => {
  it('accepts the ATO example ABN with or without spaces', () => {
    expect(isValidAbn('51 824 753 556')).toBe(true);
    expect(isValidAbn('51824753556')).toBe(true);
  });

  it('rejects a single-digit typo', () => {
    expect(isValidAbn('51 824 753 557')).toBe(false);
    expect(isValidAbn('61 824 753 556')).toBe(false);
  });

  it('rejects wrong length and non-digits', () => {
    expect(isValidAbn('5182475355')).toBe(false);
    expect(isValidAbn('518247535561')).toBe(false);
    expect(isValidAbn('51 824 753 55a')).toBe(false);
  });

  it('formats as 2-3-3-3', () => {
    expect(formatAbn('51824753556')).toBe('51 824 753 556');
  });
});
