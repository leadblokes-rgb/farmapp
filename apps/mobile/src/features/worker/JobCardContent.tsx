import { formatCents, jobRoleLabel } from '@croppr/shared';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { dateRangeLabel, payLabel } from '@/features/jobs/format';
import type { RankedFeedJob } from './feedApi';

function Fact({ icon, children, compact }: { icon: string; children: string; compact?: boolean }) {
  return (
    <View style={styles.fact}>
      <Icon source={icon} size={22} color="#17482F" />
      <Text variant="bodyLarge" style={styles.factText} numberOfLines={compact ? 2 : undefined}>
        {children}
      </Text>
    </View>
  );
}

/**
 * The job summary shown on a swipe card (`compact`: at most two lines per fact so it fits)
 * and at the top of the detail sheet.
 */
export function JobCardContent({ item, compact }: { item: RankedFeedJob; compact?: boolean }) {
  const j = item.job;
  const pay = payLabel(j);
  const distanceNote = item.breakdown.distance?.note;
  // Small phones (e.g. iPhone SE): a tighter swipe card so the pay always shows.
  const { height } = useWindowDimensions();
  const tight = !!compact && height < 700;
  const roleLine = (
    <Text variant="bodyLarge" style={styles.muted}>
      {jobRoleLabel(j.role_type)}
      {j.farm_is_labour_hire ? ' · via labour hire' : ''}
    </Text>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.farmRow}>
        <Text variant="titleMedium" style={styles.farm} numberOfLines={2}>
          {j.farm_name}
        </Text>
        <VerifiedBadge />
      </View>
      <Text
        variant={tight ? 'titleLarge' : 'headlineSmall'}
        style={styles.title}
        numberOfLines={2}
        testID="job-title"
      >
        {j.title}
      </Text>
      {/* Pay first on the swipe card: on small phones the card may only fit the top few lines. */}
      {compact ? null : roleLine}
      <View style={[styles.payBox, tight && styles.payBoxTight]}>
        <Text variant={tight ? 'headlineSmall' : 'headlineMedium'} style={styles.pay}>
          {pay.main}
        </Text>
        {pay.sub ? <Text variant="bodyLarge">{pay.sub}</Text> : null}
      </View>
      {compact ? roleLine : null}

      <Fact icon="map-marker" compact={compact}>
        {`${j.locality ?? j.postcode}${j.region_name ? `, ${j.region_name}` : ''}${distanceNote && distanceNote !== 'Distance unknown' ? ` · ${distanceNote}` : ''}`}
      </Fact>
      <Fact
        icon="calendar"
        compact={compact}
      >{`${dateRangeLabel(j.start_date, j.end_date)} · ~${j.hours_per_week} h/wk`}</Fact>
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
            {compact ? 'Likely specified work' : 'Likely counts as specified work (farm’s estimate)'}
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
  payBoxTight: { padding: 8, marginVertical: 0 },
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
