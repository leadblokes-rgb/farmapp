import { isSpecifiedWorkPostcode, isValidAbn, isWhmSubclass } from '@croppr/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { HelperText, Text, TextInput } from 'react-native-paper';
import { BigButton } from '@/components/BigButton';
import { PostcodeField } from '@/components/form/PostcodeField';
import { SwitchRow } from '@/components/form/SwitchRow';
import type { EmployerInput } from './api';

interface Props {
  initial: EmployerInput;
  submitLabel: string;
  onSubmit: (v: EmployerInput) => Promise<void>;
  /** The worker's visa, to pre-set "counts as specified work" from the postcode. */
  visaType?: string | null;
}

export function EmployerForm({ initial, submitLabel, onSubmit, visaType }: Props) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof EmployerInput>(k: K, value: EmployerInput[K]) =>
    setV((p) => ({ ...p, [k]: value }));

  async function submit() {
    if (v.name.trim().length < 2) return setError('Enter the employer’s name');
    if (v.abn.trim() && !isValidAbn(v.abn)) return setError('That ABN doesn’t look right (it’s optional)');
    setError(null);
    setSaving(true);
    try {
      await onSubmit(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      <TextInput
        mode="outlined"
        label="Employer name"
        accessibilityLabel="Employer name"
        value={v.name}
        onChangeText={(t) => set('name', t)}
        style={styles.input}
      />
      <PostcodeField
        label="Work postcode"
        value={v.postcode}
        onChange={(p) => {
          set('postcode', p);
          // Plant & animal cultivation in an eligible postcode for the worker's visa: pre-set the switch.
          if (isWhmSubclass(visaType) && /^\d{4}$/.test(p) && p !== v.postcode)
            set('countsAsSpecified', isSpecifiedWorkPostcode(p, visaType));
        }}
        hint="Where the work was done (eligibility depends on the postcode)."
      />
      <TextInput
        mode="outlined"
        label="Employer ABN (optional, on your payslip)"
        accessibilityLabel="Employer ABN"
        value={v.abn}
        onChangeText={(t) => set('abn', t)}
        keyboardType="number-pad"
        maxLength={14}
        style={styles.input}
      />
      {isWhmSubclass(visaType) && /^\d{4}$/.test(v.postcode) ? (
        <Text variant="bodyMedium">
          {isSpecifiedWorkPostcode(v.postcode, visaType)
            ? `✓ Eligible postcode for ${visaType} plant & animal cultivation.`
            : `Not an eligible postcode for ${visaType} plant & animal cultivation. Only count it if it’s another kind of specified work.`}
        </Text>
      ) : null}
      <SwitchRow
        label="This counts as specified work"
        description="e.g. plant and animal cultivation in an eligible regional postcode. Turn off for other jobs (like a city café) so they aren't counted."
        value={v.countsAsSpecified}
        onChange={(b) => set('countsAsSpecified', b)}
      />
      <HelperText type="error" visible={error !== null}>
        {error}
      </HelperText>
      <BigButton onPress={submit} loading={saving} disabled={saving}>
        {submitLabel}
      </BigButton>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  input: { fontSize: 18 },
});
