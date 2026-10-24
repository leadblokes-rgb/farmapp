import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { legal, needsLegalConsent } from './legal';

const root = join(__dirname, '../../../..');

describe('legal documents', () => {
  it('the app copy matches docs/legal (run npm run build:legal)', () => {
    const generated = readFileSync(
      join(root, 'apps/mobile/src/features/legal/documents.generated.ts'),
      'utf8',
    );
    for (const f of ['terms.md', 'privacy-policy.md']) {
      expect(generated).toContain(JSON.stringify(readFileSync(join(root, 'docs/legal', f), 'utf8')));
    }
  });

  it('documents state the current versions', () => {
    expect(readFileSync(join(root, 'docs/legal/terms.md'), 'utf8')).toContain(legal.termsVersion);
    expect(readFileSync(join(root, 'docs/legal/privacy-policy.md'), 'utf8')).toContain(legal.privacyVersion);
  });

  it('seeded demo accounts have accepted the current versions', () => {
    const seed = readFileSync(join(root, 'supabase/seed.sql'), 'utf8');
    expect(seed).toContain(`terms_version = '${legal.termsVersion}'`);
    expect(seed).toContain(`privacy_version = '${legal.privacyVersion}'`);
  });

  it('asks again when a version changes', () => {
    expect(
      needsLegalConsent({ terms_version: legal.termsVersion, privacy_version: legal.privacyVersion }),
    ).toBe(false);
    expect(needsLegalConsent({ terms_version: 'old', privacy_version: legal.privacyVersion })).toBe(true);
    expect(needsLegalConsent({ terms_version: null, privacy_version: null })).toBe(true);
  });
});
