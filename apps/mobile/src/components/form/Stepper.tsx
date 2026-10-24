import { StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { MIN_TAP } from '@/theme';
import { t } from '@/i18n';

interface Props {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  suffix?: string;
  /** Increment per tap (e.g. 0.5 for hours). */
  step?: number;
}

/** Big −/+ buttons instead of typing numbers: easier with gloves or wet hands. */
export function Stepper({ label, value, onChange, min, max, suffix, step = 1 }: Props) {
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
        onPress={() => onChange(Math.max(min, value - step))}
        accessibilityLabel={t('form.decrease', { label })}
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
        onPress={() => onChange(Math.min(max, value + step))}
        accessibilityLabel={t('form.increase', { label })}
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
