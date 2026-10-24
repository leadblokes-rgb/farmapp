import { farmSchema, isValidAbn, type FarmInput, type FarmOutput } from '@croppr/shared';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { HelperText } from 'react-native-paper';
import { BigButton } from '@/components/BigButton';
import { PostcodeField } from '@/components/form/PostcodeField';
import { Section } from '@/components/form/Section';
import { SwitchRow } from '@/components/form/SwitchRow';
import { TextField } from '@/components/form/TextField';
import { usePostcode } from '@/features/common/api';
import { zodResolver } from '@/lib/zodResolver';
import { friendlyError } from '@/lib/errors';
import { t } from '@/i18n';

interface Props {
  initial: FarmInput;
  submitLabel: string;
  /** Shown above the legal-details section, e.g. that edits trigger re-verification. */
  legalNote?: string;
  onSubmit: (values: FarmOutput) => Promise<void>;
}

export function FarmForm({ initial, submitLabel, legalNote, onSubmit }: Props) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FarmInput, unknown, FarmOutput>({ defaultValues: initial, resolver: zodResolver(farmSchema) });

  const [isLabourHire, abn, postcode] = useWatch({ control, name: ['isLabourHire', 'abn', 'postcode'] });
  const place = usePostcode(postcode);

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await onSubmit(values);
    } catch (e) {
      setSubmitError(friendlyError(e));
    }
  });

  return (
    <View style={styles.form}>
      <Section title={t('farmForm.business')} note={legalNote ?? t('farmForm.businessNote')}>
        <TextField
          control={control}
          name="businessName"
          label={t('farmForm.name')}
          autoComplete="organization"
        />
        <TextField
          control={control}
          name="abn"
          label={t('farmForm.abn')}
          keyboardType="number-pad"
          maxLength={14}
          hint={
            abn.replace(/\s/g, '').length === 11 && isValidAbn(abn)
              ? t('farmForm.abnOk')
              : t('farmForm.abnHint')
          }
        />
        <Controller
          control={control}
          name="isLabourHire"
          render={({ field }) => (
            <SwitchRow
              label={t('farmForm.labourHire')}
              description={t('farmForm.labourHireNote')}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        {isLabourHire ? (
          <TextField
            control={control}
            name="labourHireLicenceNumber"
            label={t('farmForm.licence')}
            autoCapitalize="characters"
            hint={t('farmForm.licenceHint')}
          />
        ) : null}
      </Section>

      <Section title={t('farmForm.contact')}>
        <TextField
          control={control}
          name="contactPhone"
          label={t('farmForm.phone')}
          keyboardType="phone-pad"
          autoComplete="tel"
          hint={t('farmForm.phoneHint')}
        />
        <Controller
          control={control}
          name="postcode"
          render={({ field, fieldState }) => (
            <PostcodeField
              label={t('farmForm.postcode')}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              hint={
                place.data
                  ? t('form.place', { locality: place.data.locality, state: place.data.state })
                  : undefined
              }
            />
          )}
        />
        <TextField
          control={control}
          name="description"
          label={t('farmForm.about')}
          multiline
          numberOfLines={4}
          hint={t('farmForm.aboutHint')}
        />
      </Section>

      <HelperText type="error" visible={submitError !== null || Object.keys(errors).length > 0}>
        {submitError ?? t('form.fixFields')}
      </HelperText>
      <BigButton onPress={() => submit()} loading={isSubmitting} disabled={isSubmitting}>
        {submitLabel}
      </BigButton>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
});
