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
      <Section
        title="Business details"
        note={
          legalNote ??
          'We check your ABN (and labour hire licence, if you have one) before you can post jobs.'
        }
      >
        <TextField
          control={control}
          name="businessName"
          label="Business or trading name"
          autoComplete="organization"
        />
        <TextField
          control={control}
          name="abn"
          label="ABN"
          keyboardType="number-pad"
          maxLength={14}
          hint={
            abn.replace(/\s/g, '').length === 11 && isValidAbn(abn)
              ? '✓ ABN format looks right'
              : '11 digits, e.g. 51 824 753 556'
          }
        />
        <Controller
          control={control}
          name="isLabourHire"
          render={({ field }) => (
            <SwitchRow
              label="We are a labour hire provider"
              description="Supplying workers to other growers. Queensland requires a labour hire licence."
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        {isLabourHire ? (
          <TextField
            control={control}
            name="labourHireLicenceNumber"
            label="Labour hire licence number"
            autoCapitalize="characters"
            hint="We check this against the Queensland labour hire licence register."
          />
        ) : null}
      </Section>

      <Section title="Contact and location">
        <TextField
          control={control}
          name="contactPhone"
          label="Contact phone"
          keyboardType="phone-pad"
          autoComplete="tel"
          hint="Only Croppr staff see this. Workers contact you through in-app chat."
        />
        <Controller
          control={control}
          name="postcode"
          render={({ field, fieldState }) => (
            <PostcodeField
              label="Farm postcode"
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              hint={place.data ? `${place.data.locality}, ${place.data.state}` : undefined}
            />
          )}
        />
        <TextField
          control={control}
          name="description"
          label="About your farm (optional)"
          multiline
          numberOfLines={4}
          hint="What you grow, seasons, what workers can expect."
        />
      </Section>

      <HelperText type="error" visible={submitError !== null || Object.keys(errors).length > 0}>
        {submitError ?? 'Please fix the highlighted fields above.'}
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
