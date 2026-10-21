export const OTP_LENGTH = 6;

export function normaliseEmail(input: string): string {
  return input.trim().toLowerCase();
}

// Deliberately loose: the real check is Supabase sending the code.
export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normaliseEmail(input));
}

export function isValidOtp(input: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(input.trim());
}
