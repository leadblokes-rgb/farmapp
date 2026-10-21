/** 3218 -> "$32.18" (whole dollars drop the cents: 3200 -> "$32"). */
export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

/** "32.18" / "$32" / "32,50" -> cents, or null if not a positive amount. */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$\s]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(parseFloat(cleaned) * 100);
  return cents > 0 ? cents : null;
}

export function centsToDollarsInput(cents: number | null | undefined): string {
  if (!cents) return '';
  return (cents / 100).toFixed(2).replace(/\.00$/, '');
}
