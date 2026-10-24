import type { FactorScore } from '@croppr/matching';
import { t } from '@/i18n';

/** A ranking factor's explanation in the user's language (English note for older saved scores). */
export function matchNote(f: Pick<FactorScore, 'note' | 'code' | 'params'> | undefined): string {
  if (!f) return '';
  if (!f.code) return f.note;
  // Codes come from packages/matching/src/factors.ts; each has a "match.<code>" entry in en.json.
  return t(`match.${f.code}` as 'match.nearby', { ...f.params, defaultValue: f.note });
}
