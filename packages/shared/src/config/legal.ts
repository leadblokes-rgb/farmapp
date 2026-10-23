// Versions of the terms of use and privacy policy users have to accept. Bump a version when the
// document changes materially: everyone is asked to accept again on their next visit.
// The documents themselves are docs/legal/*.md (run `npm run build:legal` after editing).

export const legal = {
  termsVersion: '2026-10-draft-1',
  privacyVersion: '2026-10-draft-1',
  /** CHANGE BEFORE LAUNCH: a monitored inbox for support and privacy requests. */
  supportEmail: 'support@croppr.com.au',
  /** The documents are drafts until reviewed by an Australian lawyer. */
  draft: true,
} as const;

export function needsLegalConsent(profile: { terms_version: string | null; privacy_version: string | null }) {
  return profile.terms_version !== legal.termsVersion || profile.privacy_version !== legal.privacyVersion;
}
