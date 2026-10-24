import { isValidAbn } from '@croppr/shared';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { HelperText, Text, TextInput } from 'react-native-paper';
import { BigButton } from '@/components/BigButton';
import { PostcodeField } from '@/components/form/PostcodeField';
import { SwitchRow } from '@/components/form/SwitchRow';
import { useSpecifiedWorkCheck } from '@/features/common/api';
import type { EmployerInput } from './api';
import { t } from '@/i18n';

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
    if (v.name.trim().length < 2) return setError(t('employer.nameRequired'));
    if (v.abn.trim() && !isValidAbn(v.abn)) return setError(t('employer.badAbn'));
    setError(null);
    setSaving(true);
    try {
      await onSubmit(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('employer.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      <TextInput
        mode="outlined"
        label={t('employer.name')}
        accessibilityLabel={t('employer.name')}
        value={v.name}
        onChangeText={(text) => set('name', text)}
        style={styles.input}
      />
      <PostcodeField
        label={t('employer.postcode')}
        value={v.postcode}
        onChange={(p) => set('postcode', p)}
        hint={t('employer.postcodeHint')}
      />
      <TextInput
        mode="outlined"
        label={t('employer.abn')}
        accessibilityLabel={t('employer.abnLabel')}
        value={v.abn}
        onChangeText={(text) => set('abn', text)}
        keyboardType="number-pad"
        maxLength={14}
        style={styles.input}
      />
      {/^\d{4}$/.test(v.postcode) && eligible != null ? (
        <Text variant="bodyMedium">
          {eligible
            ? t('employer.eligible', { visa: subclass, work: check.data!.label ?? t('employer.plantAnimal') })
            : t('employer.notEligible', { visa: subclass })}
        </Text>
      ) : null}
      <SwitchRow
        label={t('employer.counts')}
        description={t('employer.countsNote')}
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
