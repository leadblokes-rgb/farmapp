import {
  SKILLS,
  VISA_TYPE_LABELS,
  VISA_TYPES,
  VISA_TYPES_WITH_EXPIRY,
  workerProfileSchema,
  type WorkerProfileInput,
} from '@croppr/shared';
import { useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, IconButton, RadioButton, SegmentedButtons, Text } from 'react-native-paper';
import { BigButton } from '@/components/BigButton';
import { ChipSelect } from '@/components/form/ChipSelect';
import { CountryPicker } from '@/components/form/CountryPicker';
import { DateField } from '@/components/form/DateField';
import { PhotoField, type PickedImage } from '@/components/form/PhotoField';
import { PostcodeField } from '@/components/form/PostcodeField';
import { Section } from '@/components/form/Section';
import { Stepper } from '@/components/form/Stepper';
import { SwitchRow } from '@/components/form/SwitchRow';
import { FieldMessage, TextField } from '@/components/form/TextField';
import { zodResolver } from '@/lib/zodResolver';
import { usePostcode, useRegions } from '@/features/common/api';
import { MIN_TAP } from '@/theme';
import { friendlyError } from '@/lib/errors';

interface Props {
  initial: WorkerProfileInput;
  photoUrl?: string | null;
  submitLabel: string;
  onSubmit: (values: WorkerProfileInput, photo: PickedImage | null) => Promise<void>;
}

export function WorkerProfileForm({ initial, photoUrl, submitLabel, onSubmit }: Props) {
  const regions = useRegions();
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<WorkerProfileInput>({ defaultValues: initial, resolver: zodResolver(workerProfileSchema) });
  const availability = useFieldArray({ control, name: 'availability' });

  const [visaType, travelMode, postcode, fullName] = useWatch({
    control,
    name: ['visaType', 'travelMode', 'currentPostcode', 'fullName'],
  });
  const place = usePostcode(postcode);

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await onSubmit(values, photo);
      setPhoto(null);
    } catch (e) {
      setSubmitError(friendlyError(e));
    }
  });

  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  return (
    <View style={styles.form}>
      <Section title="About you">
        <PhotoField currentUrl={photoUrl} picked={photo} onPick={setPhoto} initials={initials} />
        <TextField
          control={control}
          name="fullName"
          label="Full name"
          autoComplete="name"
          textContentType="name"
        />
        <Controller
          control={control}
          name="nationality"
          render={({ field, fieldState }) => (
            <CountryPicker
              label="Nationality"
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
      </Section>

      <Section
        title="Visa"
        note="Private: only you can see this. Farms only see your visa type and whether it covers their job dates. We never ask for your passport number."
      >
        <Controller
          control={control}
          name="visaType"
          render={({ field }) => (
            <RadioButton.Group onValueChange={(v) => field.onChange(v)} value={field.value}>
              {VISA_TYPES.map((v) => (
                <RadioButton.Item
                  key={v}
                  value={v}
                  label={VISA_TYPE_LABELS[v]}
                  style={styles.radio}
                  labelStyle={styles.radioLabel}
                />
              ))}
            </RadioButton.Group>
          )}
        />
        {VISA_TYPES_WITH_EXPIRY.includes(visaType) ? (
          <Controller
            control={control}
            name="visaExpiry"
            render={({ field, fieldState }) => (
              <DateField
                label="Visa expiry date"
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
        ) : null}
      </Section>

      <Section title="Where and when">
        <Controller
          control={control}
          name="currentPostcode"
          render={({ field, fieldState }) => (
            <PostcodeField
              label="Postcode you're in now"
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              hint={
                place.data ? `${place.data.locality}, ${place.data.state}` : 'Used to show jobs near you.'
              }
              allowLocation
            />
          )}
        />
        <Text variant="bodyLarge">Regions you&apos;d like to work in</Text>
        <Controller
          control={control}
          name="regionIds"
          render={({ field, fieldState }) => (
            <View>
              <ChipSelect
                options={(regions.data ?? []).map((r) => ({ key: r.id, label: r.name }))}
                selected={field.value}
                onChange={field.onChange}
              />
              <FieldMessage error={fieldState.error?.message} />
            </View>
          )}
        />
        <Text variant="bodyLarge">Dates you&apos;re available</Text>
        {availability.fields.map((item, index) => (
          <View key={item.id} style={styles.dateRow}>
            <Controller
              control={control}
              name={`availability.${index}.startDate`}
              render={({ field, fieldState }) => (
                <DateField
                  label="From"
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? '')}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name={`availability.${index}.endDate`}
              render={({ field, fieldState }) => (
                <DateField
                  label="To"
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? '')}
                  error={fieldState.error?.message}
                />
              )}
            />
            <IconButton
              icon="delete-outline"
              size={28}
              style={styles.iconButton}
              disabled={availability.fields.length === 1}
              onPress={() => availability.remove(index)}
              accessibilityLabel="Remove these dates"
            />
          </View>
        ))}
        <FieldMessage error={errors.availability?.message ?? errors.availability?.root?.message} />
        <Button
          mode="text"
          icon="plus"
          onPress={() => availability.append({ startDate: '', endDate: '' })}
          contentStyle={styles.tall}
        >
          Add another date range
        </Button>
      </Section>

      <Section title="Travel and transport">
        <Controller
          control={control}
          name="hasCar"
          render={({ field }) => (
            <SwitchRow label="I have a car" value={field.value} onChange={field.onChange} />
          )}
        />
        <Controller
          control={control}
          name="needsAccommodation"
          render={({ field }) => (
            <SwitchRow label="I need accommodation" value={field.value} onChange={field.onChange} />
          )}
        />
        <Controller
          control={control}
          name="travelMode"
          render={({ field }) => (
            <SegmentedButtons
              value={field.value}
              onValueChange={(v) => {
                field.onChange(v);
                setValue('groupSize', v === 'group' ? 2 : 1);
              }}
              buttons={[
                { value: 'solo', label: 'Solo', icon: 'account', style: styles.segment },
                { value: 'group', label: 'With a group', icon: 'account-group', style: styles.segment },
              ]}
            />
          )}
        />
        {travelMode === 'group' ? (
          <Controller
            control={control}
            name="groupSize"
            render={({ field, fieldState }) => (
              <View>
                <Stepper
                  label="People in your group (incl. you)"
                  value={field.value}
                  onChange={field.onChange}
                  min={2}
                  max={20}
                />
                <FieldMessage
                  error={fieldState.error?.message}
                  hint="Each person creates their own profile and applies; farms will see you're travelling together."
                />
              </View>
            )}
          />
        ) : null}
      </Section>

      <Section title="Experience">
        <Controller
          control={control}
          name="yearsExperience"
          render={({ field }) => (
            <Stepper
              label="Seasons of farm work"
              value={field.value}
              onChange={field.onChange}
              min={0}
              max={50}
            />
          )}
        />
        <Controller
          control={control}
          name="skills"
          render={({ field }) => (
            <ChipSelect options={SKILLS} selected={field.value} onChange={(keys) => field.onChange(keys)} />
          )}
        />
        <TextField
          control={control}
          name="experienceSummary"
          label="Anything else farms should know? (optional)"
          multiline
          numberOfLines={4}
        />
      </Section>

      <HelperText
        type="error"
        visible={submitError !== null || Object.keys(errors).length > 0}
        style={styles.submitError}
      >
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
  radio: { minHeight: MIN_TAP, paddingHorizontal: 0 },
  radioLabel: { fontSize: 17 },
  dateRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  iconButton: { width: MIN_TAP, height: MIN_TAP, marginTop: 6 },
  segment: { minHeight: MIN_TAP, justifyContent: 'center' },
  tall: { minHeight: MIN_TAP },
  submitError: { fontSize: 15 },
});
