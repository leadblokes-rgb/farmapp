import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { displayToIso, isoToDisplay } from '@croppr/shared';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Button, Modal, Portal, Text, TextInput } from 'react-native-paper';
import { MIN_TAP } from '@/theme';
import { FieldMessage } from './TextField';

interface Props {
  label: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  error?: string;
  /** Earliest / latest allowed ISO dates (inclusive). */
  minDate?: string | null;
  maxDate?: string | null;
}

// ISO dates are calendar dates, so convert through local midnight (the native pickers work in local time).
const isoToLocal = (iso: string) => new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const localToIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function rangeError(iso: string | null, min?: string | null, max?: string | null): string | undefined {
  if (!iso) return undefined;
  if (min && iso < min) return `Pick ${isoToDisplay(min)} or later`;
  if (max && iso > max) return `Pick ${isoToDisplay(max)} or earlier`;
  return undefined;
}

/**
 * Tap to open the phone's calendar (iOS inline calendar in a sheet, Android date dialog).
 * On web, typed DD/MM/YYYY entry. Emits ISO dates, or null while empty/invalid.
 */
export function DateField(props: Props) {
  return Platform.OS === 'web' ? <TypedDateField {...props} /> : <NativeDateField {...props} />;
}

function NativeDateField({ label, value, onChange, error, minDate, maxDate }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(new Date());
  const min = minDate ? isoToLocal(minDate) : undefined;
  const max = maxDate ? isoToLocal(maxDate) : undefined;

  function initial() {
    const d = value ? isoToLocal(value) : new Date();
    if (min && d < min) return min;
    if (max && d > max) return max;
    return d;
  }

  function show() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initial(),
        mode: 'date',
        minimumDate: min,
        maximumDate: max,
        onChange: (event, d) => {
          if (event.type === 'set' && d) onChange(localToIso(d));
        },
      });
      return;
    }
    setDraft(initial());
    setOpen(true);
  }

  const message = error ?? rangeError(value, minDate, maxDate);
  return (
    <View style={styles.wrap}>
      <Pressable onPress={show} accessibilityRole="button" accessibilityLabel={label}>
        {/* pointerEvents none: the whole field is one tap target that opens the calendar. */}
        <View pointerEvents="none">
          <TextInput
            mode="outlined"
            label={label}
            placeholder="Choose a date"
            value={isoToDisplay(value)}
            editable={false}
            error={!!message}
            right={<TextInput.Icon icon="calendar" />}
            style={styles.input}
          />
        </View>
      </Pressable>
      <FieldMessage error={message} />
      {Platform.OS === 'ios' ? (
        <Portal>
          <Modal visible={open} onDismiss={() => setOpen(false)} contentContainerStyle={styles.sheet}>
            <Text variant="titleMedium" style={styles.bold}>
              {label}
            </Text>
            <DateTimePicker
              value={draft}
              mode="date"
              display="inline"
              minimumDate={min}
              maximumDate={max}
              onChange={(_, d) => d && setDraft(d)}
              locale="en-AU"
            />
            <View style={styles.actions}>
              <Button mode="text" contentStyle={styles.tall} onPress={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                mode="contained"
                contentStyle={styles.tall}
                onPress={() => {
                  onChange(localToIso(draft));
                  setOpen(false);
                }}
              >
                Done
              </Button>
            </View>
          </Modal>
        </Portal>
      ) : null}
    </View>
  );
}

/** DD/MM/YYYY entry with auto-inserted slashes (web, where there's no native calendar). */
function TypedDateField({ label, value, onChange, error, minDate, maxDate }: Props) {
  const [text, setText] = useState(isoToDisplay(value));
  const [lastValue, setLastValue] = useState(value);

  // Keep in sync when the form value changes from outside (e.g. reset with loaded data).
  if (value !== lastValue) {
    setLastValue(value);
    if (displayToIso(text) !== value) setText(isoToDisplay(value));
  }

  function handle(input: string) {
    const digits = input.replace(/\D/g, '').slice(0, 8);
    const formatted = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
    setText(formatted);
    onChange(displayToIso(formatted));
  }

  const incomplete = text.length > 0 && displayToIso(text) === null;
  const message = error ?? (incomplete ? 'Use DD/MM/YYYY' : rangeError(value, minDate, maxDate));
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
        error={!!message}
        accessibilityLabel={label}
        style={styles.input}
      />
      <FieldMessage error={message} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  input: { fontSize: 18 },
  sheet: { backgroundColor: 'white', margin: 12, borderRadius: 16, padding: 16, gap: 8 },
  bold: { fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  tall: { minHeight: MIN_TAP },
});
