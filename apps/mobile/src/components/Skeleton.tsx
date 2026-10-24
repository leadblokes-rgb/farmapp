import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';
import { Screen } from './Screen';
import { t } from '@/i18n';

/** A grey placeholder block that gently pulses while content loads. */
export function Bone({
  width = '100%',
  height = 16,
  radius = 8,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
}) {
  const [opacity] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);
  return <Animated.View style={[styles.bone, { width, height, borderRadius: radius, opacity }]} />;
}

/** Days tab: the big number, meter, buttons and employer cards. */
export function DaysSkeleton() {
  return (
    <Screen edges={[]}>
      <View accessibilityLabel={t('common.loadingDays')} accessible style={styles.stack}>
        <Bone height={44} radius={12} />
        <Bone width="70%" height={36} radius={18} />
        <View style={styles.centre}>
          <Bone width={140} height={64} radius={12} />
          <Bone width={180} height={18} />
        </View>
        <Bone height={20} radius={10} />
        <Bone height={56} radius={28} />
        <Bone height={56} radius={28} />
        <CardBones count={2} />
      </View>
    </Screen>
  );
}

/** A list of card-shaped placeholders (shortlist, Matches). */
export function ListSkeleton({ count = 4, label }: { count?: number; label?: string }) {
  return (
    <Screen edges={[]}>
      <View accessibilityLabel={label ?? t('common.loading')} accessible style={styles.stack}>
        <CardBones count={count} />
      </View>
    </Screen>
  );
}

/** Discover: one swipe card. */
export function CardSkeleton() {
  return (
    <View accessibilityLabel={t('common.loadingJobs')} accessible style={[styles.card, styles.flex]}>
      <Bone width="50%" height={20} />
      <Bone width="85%" height={30} />
      <Bone width="40%" height={18} />
      <Bone height={64} radius={12} />
      {[0, 1, 2, 3].map((i) => (
        <Bone key={i} width={`${90 - i * 10}%`} height={20} />
      ))}
    </View>
  );
}

function CardBones({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.card, styles.row]}>
          <Bone width={52} height={52} radius={26} />
          <View style={[styles.flex, styles.stackSmall]}>
            <Bone width="60%" height={18} />
            <Bone width="85%" height={14} />
            <Bone width="40%" height={14} />
          </View>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  bone: { backgroundColor: '#E3E7E4' },
  stack: { gap: 14 },
  stackSmall: { gap: 8 },
  centre: { alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  card: { borderWidth: 1, borderColor: '#E3E7E4', borderRadius: 14, padding: 16, gap: 12 },
});
