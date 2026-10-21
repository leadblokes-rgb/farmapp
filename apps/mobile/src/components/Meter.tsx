import { StyleSheet, View } from 'react-native';

/** Simple fixed-height progress bar (0–1). Paper's ProgressBar mis-measures inside cards on web. */
export function Meter({ value, height = 10, label }: { value: number; height?: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2 }]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
    >
      <View style={[styles.fill, { width: `${pct}%`, borderRadius: height / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: '#E0E0E0', overflow: 'hidden', alignSelf: 'stretch' },
  fill: { height: '100%', backgroundColor: '#1B5E20' },
});
