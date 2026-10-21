import { Pressable, StyleSheet, View } from 'react-native';
import { Switch, Text } from 'react-native-paper';
import { MIN_TAP } from '@/theme';

interface Props {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

/** The whole row toggles, not just the small switch. */
export function SwitchRow({ label, description, value, onChange }: Props) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={styles.row}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
    >
      <View style={styles.text}>
        <Text variant="bodyLarge">{label}</Text>
        {description ? (
          <Text variant="bodyMedium" style={styles.description}>
            {description}
          </Text>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TAP, gap: 12, paddingVertical: 4 },
  text: { flex: 1 },
  description: { opacity: 0.75 },
});
