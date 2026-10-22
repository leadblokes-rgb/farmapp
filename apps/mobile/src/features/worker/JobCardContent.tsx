import { formatCents, jobRoleLabel } from '@croppr/shared';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { dateRangeLabel, payLabel } from '@/features/jobs/format';
import type { RankedFeedJob } from './feedApi';

function Fact({ icon, children, compact }: { icon: string; children: string; compact?: boolean }) {
  return (
    <View style={styles.fact}>
      <Icon source={icon} size={22} color="#17482F" />
      <Text variant="bodyLarge" style={styles.factText} numberOfLines={compact ? 1 : undefined}>
        {children}
      </Text>
    </View>
  );
}

/**
 * The job summary shown on a swipe card (`compact`: one line per fact so it always fits)
 * and at the top of the detail sheet.
 */
export function JobCardContent({ item, compact }: { item: RankedFeedJob; compact?: boolean }) {
  const j = item.job;
  const pay = payLabel(j);
  const distanceNote = item.breakdown.distance?.note;

  return (
    <View style={styles.wrap}>
      <View style={styles.farmRow}>
        <Text variant="titleMedium" style={styles.farm} numberOfLines={1}>
          {j.farm_name}
        </Text>
        <VerifiedBadge />
      </View>
      <Text variant="headlineSmall" style={styles.title} numberOfLines={2} testID="job-title">
        {j.title}
      </Text>
      <Text variant="bodyLarge" style={styles.muted}>
        {jobRoleLabel(j.role_type)}
        {j.farm_is_labour_hire ? ' · via labour hire' : ''}
      </Text>

      <View style={styles.payBox}>
        <Text variant="headlineMedium" style={styles.pay}>
          {pay.main}
        </Text>
        {pay.sub ? <Text variant="bodyLarge">{pay.sub}</Text> : null}
      </View>

      <Fact icon="map-marker" compact={compact}>
        {`${j.locality ?? j.postcode}${j.region_name ? `, ${j.region_name}` : ''}${distanceNote && distanceNote !== 'Distance unknown' ? ` · ${distanceNote}` : ''}`}
      </Fact>
      <Fact
        icon="calendar"
        compact={compact}
      >{`${dateRangeLabel(j.start_date, j.end_date)} · ~${j.hours_per_week} hrs/week`}</Fact>
      <Fact icon="home" compact={compact}>
        {j.accommodation_provided
          ? `Accommodation${j.accommodation_cost_week_cents ? ` ${formatCents(j.accommodation_cost_week_cents)}/wk` : ' (free)'}`
          : 'No accommodation'}
      </Fact>
      <Fact icon={j.car_required ? 'car' : j.transport_provided ? 'bus' : 'walk'} compact={compact}>
        {j.car_required
          ? 'Own car needed'
          : j.transport_provided
            ? 'Transport provided'
            : 'No transport provided'}
      </Fact>
      <Fact icon="account-group" compact={compact}>{`${j.workers_needed} workers needed`}</Fact>

      {j.likely_specified_work ? (
        <View style={styles.specified}>
          <Icon source="passport" size={20} color="#5C3B00" />
          <Text variant="bodyMedium" style={styles.specifiedText}>
            Likely counts as specified work (farm&apos;s estimate)
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  farmRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  farm: { flexShrink: 1, fontWeight: '600' },
  title: { fontWeight: '800' },
  muted: { opacity: 0.75 },
  payBox: { backgroundColor: '#E8F5E9', borderRadius: 12, padding: 12, marginVertical: 4 },
  pay: { fontWeight: '800', color: '#17482F' },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  factText: { flex: 1 },
  specified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#FFE0A8',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  specifiedText: { flexShrink: 1, color: '#3B2600', fontWeight: '600' },
});
