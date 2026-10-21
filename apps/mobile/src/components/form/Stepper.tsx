import { StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { MIN_TAP } from '@/theme';

interface Props {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  suffix?: string;
}

/** Big −/+ buttons instead of typing numbers: easier with gloves or wet hands. */
export function Stepper({ label, value, onChange, min, max, suffix }: Props) {
  return (
    <View style={styles.row}>
      <Text variant="bodyLarge" style={styles.label}>
        {label}
      </Text>
      <IconButton
        icon="minus"
        mode="outlined"
        size={28}
        style={styles.button}
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, value - 1))}
        accessibilityLabel={`Decrease ${label}`}
      />
      <Text variant="titleLarge" style={styles.value}>
        {value}
        {suffix ? ` ${suffix}` : ''}
      </Text>
      <IconButton
        icon="plus"
        mode="outlined"
        size={28}
        style={styles.button}
        disabled={value >= max}
        onPress={() => onChange(Math.min(max, value + 1))}
        accessibilityLabel={`Increase ${label}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TAP },
  label: { flex: 1 },
  button: { width: MIN_TAP, height: MIN_TAP, margin: 0 },
  value: { minWidth: 56, textAlign: 'center' },
});
