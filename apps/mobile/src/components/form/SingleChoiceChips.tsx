import { StyleSheet, View } from 'react-native';
import { Chip } from 'react-native-paper';

interface Props<K extends string> {
  options: readonly { key: K; label: string }[];
  value: K | undefined;
  onChange: (key: K) => void;
}

export function SingleChoiceChips<K extends string>({ options, value, onChange }: Props<K>) {
  return (
    <View style={styles.wrap}>
      {options.map((o) => (
        <Chip
          key={o.key}
          selected={o.key === value}
          showSelectedCheck
          mode={o.key === value ? 'flat' : 'outlined'}
          onPress={() => onChange(o.key)}
          style={styles.chip}
          textStyle={styles.text}
          accessibilityRole="radio"
          accessibilityState={{ selected: o.key === value }}
        >
          {o.label}
        </Chip>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, justifyContent: 'center' },
  text: { fontSize: 16 },
});
