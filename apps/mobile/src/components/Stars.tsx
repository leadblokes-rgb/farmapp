import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { t } from '@/i18n';

const GOLD = '#B7791F';

/** "★ 4.5 (12 reviews)", or "No reviews yet". `noun` picks the wording: reviews or ratings. */
export function RatingSummary({
  avg,
  count,
  noun = 'review',
  size = 18,
}: {
  avg: number | null | undefined;
  count: number | null | undefined;
  noun?: 'review' | 'rating';
  size?: number;
}) {
  if (!count || avg == null) {
    return <Text style={styles.muted}>{t(`stars.none.${noun}`)}</Text>;
  }
  const counted = t(`stars.count.${noun}`, { count });
  const label = t('stars.summaryLabel', { avg: Number(avg).toFixed(1), counted });
  return (
    <View style={styles.row} accessible accessibilityLabel={label}>
      <Icon source="star" size={size} color={GOLD} />
      <Text style={[styles.value, { fontSize: size - 2 }]}>{Number(avg).toFixed(1)}</Text>
      <Text style={[styles.muted, { fontSize: size - 4 }]}>({counted})</Text>
    </View>
  );
}

/** Small read-only star row for a single review. */
export function StarRow({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={t('stars.rowLabel', { value })}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} source={n <= value ? 'star' : 'star-outline'} size={size} color={GOLD} />
      ))}
    </View>
  );
}

/** Five big tappable stars (gloves-friendly). */
export function StarInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.input}>
      <Text variant="titleMedium">{label}</Text>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            style={styles.tap}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === n }}
            accessibilityLabel={t('stars.inputLabel', { label, count: n })}
          >
            <Icon source={value != null && n <= value ? 'star' : 'star-outline'} size={40} color={GOLD} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  value: { fontWeight: '700' },
  muted: { opacity: 0.7 },
  input: { gap: 4 },
  tap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
});
