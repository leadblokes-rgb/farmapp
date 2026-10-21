// Dates are stored as ISO "YYYY-MM-DD" (Postgres `date`) and shown/entered as Australian DD/MM/YYYY.

export function isoToDisplay(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Parses DD/MM/YYYY (or D/M/YYYY) into ISO, returning null for anything that isn't a real date. */
export function displayToIso(input: string): string | null {
  const match = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(input);
  if (!match) return null;
  const [, d, m, y] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Today in the device's local time zone, as ISO. */
export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
