// Australian Business Number checksum, per the ATO algorithm:
// subtract 1 from the first digit, weight each digit, and the sum must be divisible by 89.
// This only proves the number is well-formed; admins still check it on ABN Lookup.
// The same check runs in Postgres (public.is_valid_abn) so it can't be bypassed.
const WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

export function normaliseAbn(input: string): string {
  return input.replace(/\s+/g, '');
}

export function isValidAbn(input: string): boolean {
  const abn = normaliseAbn(input);
  if (!/^\d{11}$/.test(abn)) return false;
  const digits = abn.split('').map(Number);
  digits[0] -= 1;
  const sum = digits.reduce((acc, d, i) => acc + d * WEIGHTS[i], 0);
  return sum % 89 === 0;
}

/** "51824753556" -> "51 824 753 556" */
export function formatAbn(input: string): string {
  const abn = normaliseAbn(input);
  if (abn.length !== 11) return input;
  return `${abn.slice(0, 2)} ${abn.slice(2, 5)} ${abn.slice(5, 8)} ${abn.slice(8)}`;
}
