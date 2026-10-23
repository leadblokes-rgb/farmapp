// Database CHECK constraints the user can trip from a form, in plain words.
const CONSTRAINT_MESSAGES: Record<string, string> = {
  shift_logs_hours_check: 'A shift can be at most 16 hours.',
  payslips_period_length_check:
    'A pay period can be at most 62 days. Add longer periods as separate payslips.',
  payslips_hours_check: 'That’s more than 16 hours per day worked. Check the total hours and days worked.',
  payslips_check: 'The pay period ends before it starts.',
  payslips_check1: 'Days worked can’t be more than the days in the pay period.',
};

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
    const base = 'Can’t reach the Croppr server. Check your internet connection and try again.';
    // In development the "server" is Supabase on your computer, so say exactly what we tried.
    return __DEV__
      ? `${base}\n\nDev: couldn't reach ${process.env.EXPO_PUBLIC_SUPABASE_URL}. Is Supabase running (npm run db:start)? On a phone, use your computer's LAN IP in apps/mobile/.env.local and restart Expo.`
      : base;
  }
  const constraint = /violates check constraint "([^"]+)"/.exec(message)?.[1];
  if (constraint && CONSTRAINT_MESSAGES[constraint]) return CONSTRAINT_MESSAGES[constraint];
  return message;
}
