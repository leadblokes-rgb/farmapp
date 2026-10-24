import { formatCents } from '@croppr/shared';
import { t } from '@/i18n';

/** "2027-01-05" -> "5 Jan" (adds the year if it differs from this year). */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const month = (t('format.months', { returnObjects: true }) as string[])[m - 1];
  return y === new Date().getFullYear()
    ? t('format.dayMonth', { day: d, month })
    : t('format.dayMonthYear', { day: d, month, year: y });
}

export function dateRangeLabel(start: string, end: string): string {
  return t('format.dateRange', { start: shortDate(start), end: shortDate(end) });
}

export function payLabel(job: {
  pay_type: 'hourly' | 'piece_rate';
  pay_rate_cents: number;
  piece_rate_unit: string | null;
  min_hourly_guarantee_cents: number | null;
}): { main: string; sub?: string } {
  if (job.pay_type === 'hourly')
    return { main: t('format.perHour', { amount: formatCents(job.pay_rate_cents) }) };
  return {
    main: t('format.perUnit', {
      amount: formatCents(job.pay_rate_cents),
      unit: job.piece_rate_unit ?? t('format.unit'),
    }),
    sub: t('format.minGuaranteed', { amount: formatCents(job.min_hourly_guarantee_cents ?? 0) }),
  };
}
