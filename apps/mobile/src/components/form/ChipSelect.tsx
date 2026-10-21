import { StyleSheet, View } from 'react-native';
import { Chip } from 'react-native-paper';

interface Props {
  options: readonly { key: string; label: string }[];
  selected: string[];
  onChange: (keys: string[]) => void;
}

export function ChipSelect({ options, selected, onChange }: Props) {
  const toggle = (key: string) =>
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);

  return (
    <View style={styles.wrap}>
      {options.map((o) => {
        const on = selected.includes(o.key);
        return (
          <Chip
            key={o.key}
            selected={on}
            showSelectedCheck
            mode={on ? 'flat' : 'outlined'}
            onPress={() => toggle(o.key)}
            style={styles.chip}
            textStyle={styles.text}
          >
            {o.label}
          </Chip>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, justifyContent: 'center' },
  text: { fontSize: 16 },
});
