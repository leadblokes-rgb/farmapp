import { formatCents } from '@croppr/shared';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2027-01-05" -> "5 Jan" (adds the year if it differs from this year). */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const label = `${d} ${MONTHS[m - 1]}`;
  return y === new Date().getFullYear() ? label : `${label} ${y}`;
}

export function dateRangeLabel(start: string, end: string): string {
  return `${shortDate(start)} – ${shortDate(end)}`;
}

export function payLabel(job: {
  pay_type: 'hourly' | 'piece_rate';
  pay_rate_cents: number;
  piece_rate_unit: string | null;
  min_hourly_guarantee_cents: number | null;
}): { main: string; sub?: string } {
  if (job.pay_type === 'hourly') return { main: `${formatCents(job.pay_rate_cents)}/hr` };
  return {
    main: `${formatCents(job.pay_rate_cents)} per ${job.piece_rate_unit ?? 'unit'}`,
    sub: `min ${formatCents(job.min_hourly_guarantee_cents ?? 0)}/hr guaranteed`,
  };
}
