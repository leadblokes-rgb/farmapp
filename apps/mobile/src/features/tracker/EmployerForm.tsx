import { isValidAbn } from '@croppr/shared';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { HelperText, Text, TextInput } from 'react-native-paper';
import { BigButton } from '@/components/BigButton';
import { PostcodeField } from '@/components/form/PostcodeField';
import { SwitchRow } from '@/components/form/SwitchRow';
import { useSpecifiedWorkCheck } from '@/features/common/api';
import type { EmployerInput } from './api';

interface Props {
  initial: EmployerInput;
  submitLabel: string;
  onSubmit: (v: EmployerInput) => Promise<void>;
}

export function EmployerForm({ initial, submitLabel, onSubmit }: Props) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof EmployerInput>(k: K, value: EmployerInput[K]) =>
    setV((p) => ({ ...p, [k]: value }));

  // When the worker enters a new postcode, pre-set "counts as specified work" from the eligible
  // postcode list for their visa (plant & animal cultivation). They can still change it.
  const check = useSpecifiedWorkCheck(v.postcode);
  const subclass = check.data?.my_visa_subclass ?? null;
  const eligible = subclass
    ? subclass === '417'
      ? check.data!.eligible_417
      : check.data!.eligible_462
    : null;
  const applied = useRef(initial.postcode);
  useEffect(() => {
    if (eligible == null || applied.current === v.postcode) return;
    applied.current = v.postcode;
    setV((p) => ({ ...p, countsAsSpecified: eligible }));
  }, [eligible, v.postcode]);

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
        onChange={(p) => set('postcode', p)}
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
      {/^\d{4}$/.test(v.postcode) && eligible != null ? (
        <Text variant="bodyMedium">
          {eligible
            ? `✓ Eligible postcode for ${subclass} ${check.data!.label ?? 'plant & animal cultivation'} (estimate only).`
            : `Not an eligible postcode for ${subclass} plant & animal cultivation. Only count it if it’s another kind of specified work.`}
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
