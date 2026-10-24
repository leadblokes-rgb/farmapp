import { t } from '@/i18n';
// Database CHECK constraints the user can trip from a form, in plain words (errors.constraints.* in en.json).
const CONSTRAINTS = [
  'shift_logs_hours_check',
  'payslips_period_length_check',
  'payslips_hours_check',
  'payslips_days_worked_min_check',
  'payslips_check',
  'payslips_check1',
] as const;

/**
 * Turns low-level errors into something a person can act on. "Failed to fetch" (web) and
 * "Network request failed" (iOS/Android) both mean the app couldn't reach the Croppr server.
 */
export function friendlyError(e: unknown): string {
  const message =
    e instanceof Error
      ? e.message
      : typeof e === 'object' && e && 'message' in e
        ? String(e.message)
        : String(e);
  if (/failed to fetch|network request failed|load failed|networkerror/i.test(message)) {
    const base = t('errors.offline');
    // In development the "server" is Supabase on your computer, so say exactly what we tried.
    return __DEV__
      ? `${base}\n\nDev: couldn't reach ${process.env.EXPO_PUBLIC_SUPABASE_URL}. Is Supabase running (npm run db:start)? On a phone, use your computer's LAN IP in apps/mobile/.env.local and restart Expo.`
      : base;
  }
  const constraint = /violates check constraint "([^"]+)"/.exec(message)?.[1];
  const known = CONSTRAINTS.find((c) => c === constraint);
  if (known) return t(`errors.constraints.${known}`);
  return message;
}
