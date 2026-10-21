import { displayToIso, isoToDisplay } from '@croppr/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TextInput } from 'react-native-paper';
import { FieldMessage } from './TextField';

interface Props {
  label: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  error?: string;
}

/**
 * DD/MM/YYYY entry with a number pad and auto-inserted slashes. Simpler and more reliable outdoors
 * than a spinner picker. Emits ISO dates (or null while incomplete/invalid).
 */
export function DateField({ label, value, onChange, error }: Props) {
  const [text, setText] = useState(isoToDisplay(value));
  const [lastValue, setLastValue] = useState(value);

  // Keep in sync when the form value changes from outside (e.g. reset with loaded data).
  if (value !== lastValue) {
    setLastValue(value);
    if (value && displayToIso(text) !== value) setText(isoToDisplay(value));
  }

  function handle(input: string) {
    const digits = input.replace(/\D/g, '').slice(0, 8);
    const formatted = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
    setText(formatted);
    onChange(displayToIso(formatted));
  }

  const incomplete = text.length > 0 && displayToIso(text) === null;
  return (
    <View style={styles.wrap}>
      <TextInput
        mode="outlined"
        label={label}
        placeholder="DD/MM/YYYY"
        value={text}
        onChangeText={handle}
        keyboardType="number-pad"
        maxLength={10}
        error={!!error || incomplete}
        style={styles.input}
      />
      <FieldMessage error={error ?? (incomplete ? 'Use DD/MM/YYYY' : undefined)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  input: { fontSize: 18 },
});
