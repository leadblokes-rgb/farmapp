import { centsToDollarsInput, parseDollarsToCents } from '@croppr/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TextInput } from 'react-native-paper';
import { FieldMessage } from './TextField';

interface Props {
  label: string;
  value: number | null;
  onChange: (cents: number | null) => void;
  error?: string;
  hint?: string;
  suffix?: string;
}

/** Dollar amount entry ("32.50") that stores whole cents. */
export function MoneyField({ label, value, onChange, error, hint, suffix }: Props) {
  const [text, setText] = useState(centsToDollarsInput(value));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (parseDollarsToCents(text) !== value) setText(centsToDollarsInput(value));
  }

  return (
    <View style={styles.wrap}>
      <TextInput
        mode="outlined"
        label={label}
        value={text}
        onChangeText={(t) => {
          const cleaned = t.replace(/[^\d.,]/g, '');
          setText(cleaned);
          onChange(parseDollarsToCents(cleaned));
        }}
        keyboardType="decimal-pad"
        left={<TextInput.Affix text="$" />}
        right={suffix ? <TextInput.Affix text={suffix} /> : undefined}
        error={!!error}
        accessibilityLabel={label}
        style={styles.input}
      />
      <FieldMessage error={error} hint={hint} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  input: { fontSize: 18 },
});
