import {
  JOB_ROLES,
  belowAwardWarning,
  isSpecifiedWorkPostcodeForAnyWhm,
  formatCents,
  jobSchema,
  payRules,
  type JobInput,
} from '@croppr/shared';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Linking, StyleSheet, View } from 'react-native';
import { Button, HelperText, SegmentedButtons, Text } from 'react-native-paper';
import { BigButton } from '@/components/BigButton';
import { WarningBanner } from '@/components/WarningBanner';
import { DateField } from '@/components/form/DateField';
import { MoneyField } from '@/components/form/MoneyField';
import { PostcodeField } from '@/components/form/PostcodeField';
import { Section } from '@/components/form/Section';
import { SingleChoiceChips } from '@/components/form/SingleChoiceChips';
import { Stepper } from '@/components/form/Stepper';
import { SwitchRow } from '@/components/form/SwitchRow';
import { FieldMessage, TextField } from '@/components/form/TextField';
import { usePostcode } from '@/features/common/api';
import { zodResolver } from '@/lib/zodResolver';
import { MIN_TAP } from '@/theme';
import { friendlyError } from '@/lib/errors';

interface Props {
  initial: JobInput;
  submitLabel: string;
  onSubmit: (values: JobInput) => Promise<void>;
}

export function JobForm({ initial, submitLabel, onSubmit }: Props) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<JobInput>({ defaultValues: initial, resolver: zodResolver(jobSchema) });

  const [
    payType,
    payRateCents,
    minHourlyGuaranteeCents,
    accommodationProvided,
    postcode,
    pieceRateUnit,
    startDate,
    likelySpecifiedWork,
  ] = useWatch({
    control,
    name: [
      'payType',
      'payRateCents',
      'minHourlyGuaranteeCents',
      'accommodationProvided',
      'postcode',
      'pieceRateUnit',
      'startDate',
      'likelySpecifiedWork',
    ],
  });
  // When the farm enters a new postcode, pre-tick "specified work" from the eligible postcode list
  // (plant & animal cultivation). The farm can still change it.
  const postcodeValid = /^\d{4}$/.test(postcode);
  const eligiblePostcode = postcodeValid && isSpecifiedWorkPostcodeForAnyWhm(postcode);
  const lastPostcode = useRef(postcode);
  useEffect(() => {
    if (postcode === lastPostcode.current) return;
    lastPostcode.current = postcode;
    if (/^\d{4}$/.test(postcode)) setValue('likelySpecifiedWork', isSpecifiedWorkPostcodeForAnyWhm(postcode));
  }, [postcode, setValue]);
  const place = usePostcode(postcode);
  const awardWarning = belowAwardWarning({
    payType,
    payRateCents: payRateCents ?? 0,
    minHourlyGuaranteeCents,
  });

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
      <Section title="The job">
        <TextField control={control} name="title" label="Job title" placeholder="e.g. Strawberry pickers" />
        <Controller
          control={control}
          name="roleType"
          render={({ field }) => (
            <SingleChoiceChips options={JOB_ROLES} value={field.value} onChange={field.onChange} />
          )}
        />
        <TextField
          control={control}
          name="description"
          label="Description"
          multiline
          numberOfLines={4}
          hint="Start times, what the work involves, what to bring."
        />
        <Controller
          control={control}
          name="workersNeeded"
          render={({ field }) => (
            <Stepper label="Workers needed" value={field.value} onChange={field.onChange} min={1} max={500} />
          )}
        />
      </Section>

      <Section title="Where and when">
        <Controller
          control={control}
          name="postcode"
          render={({ field, fieldState }) => (
            <PostcodeField
              label="Work location postcode"
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              hint={place.data ? `${place.data.locality}, ${place.data.state}` : undefined}
            />
          )}
        />
        <View style={styles.row}>
          <Controller
            control={control}
            name="startDate"
            render={({ field, fieldState }) => (
              <DateField
                label="Start date"
                value={field.value || null}
                onChange={(v) => field.onChange(v ?? '')}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="endDate"
            render={({ field, fieldState }) => (
              <DateField
                label="End date"
                value={field.value || null}
                minDate={startDate || null}
                onChange={(v) => field.onChange(v ?? '')}
                error={fieldState.error?.message}
              />
            )}
          />
        </View>
        <Controller
          control={control}
          name="hoursPerWeek"
          render={({ field }) => (
            <Stepper
              label="Hours per week (approx.)"
              value={field.value}
              onChange={field.onChange}
              min={1}
              max={80}
            />
          )}
        />
      </Section>

      <Section title="Pay">
        <Controller
          control={control}
          name="payType"
          render={({ field }) => (
            <SegmentedButtons
              value={field.value}
              onValueChange={field.onChange}
              buttons={[
                { value: 'hourly', label: 'Hourly', icon: 'clock-outline', style: styles.segment },
                { value: 'piece_rate', label: 'Piece rate', icon: 'basket', style: styles.segment },
              ]}
            />
          )}
        />
        {payType === 'hourly' ? (
          <Controller
            control={control}
            name="payRateCents"
            render={({ field, fieldState }) => (
              <MoneyField
                label="Hourly rate"
                suffix="/hr"
                value={field.value || null}
                onChange={field.onChange}
                error={fieldState.error?.message}
                hint={`Casual award minimum: ${formatCents(payRules.awardMinHourlyCents)}/hr`}
              />
            )}
          />
        ) : (
          <>
            <View style={styles.row}>
              <Controller
                control={control}
                name="payRateCents"
                render={({ field, fieldState }) => (
                  <MoneyField
                    label="Piece rate"
                    value={field.value || null}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <View style={styles.flex}>
                <TextField control={control} name="pieceRateUnit" label="Per (bin, tray, kg…)" />
              </View>
            </View>
            <Controller
              control={control}
              name="minHourlyGuaranteeCents"
              render={({ field, fieldState }) => (
                <MoneyField
                  label="Guaranteed minimum per hour"
                  suffix="/hr"
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                  hint={`Required. Piece-rate workers must earn at least the award minimum (${formatCents(payRules.awardMinHourlyCents)}/hr).`}
                />
              )}
            />
            {pieceRateUnit ? (
              <Text variant="bodyMedium">
                Workers will see: {formatCents(payRateCents || 0)} per {pieceRateUnit}, at least{' '}
                {formatCents(minHourlyGuaranteeCents || 0)}/hr guaranteed.
              </Text>
            ) : null}
          </>
        )}
        {awardWarning ? (
          <>
            <WarningBanner>{awardWarning}</WarningBanner>
            <Button
              mode="text"
              icon="open-in-new"
              onPress={() => Linking.openURL(payRules.sourceUrl)}
              contentStyle={styles.tall}
            >
              Fair Work: horticulture pay rates
            </Button>
          </>
        ) : null}
      </Section>

      <Section title="What you provide">
        <Controller
          control={control}
          name="accommodationProvided"
          render={({ field }) => (
            <SwitchRow label="Accommodation available" value={field.value} onChange={field.onChange} />
          )}
        />
        {accommodationProvided ? (
          <Controller
            control={control}
            name="accommodationCostWeekCents"
            render={({ field, fieldState }) => (
              <MoneyField
                label="Accommodation cost per week (0 if free)"
                suffix="/wk"
                value={field.value}
                onChange={(v) => field.onChange(v ?? 0)}
                error={fieldState.error?.message}
              />
            )}
          />
        ) : null}
        <Controller
          control={control}
          name="transportProvided"
          render={({ field }) => (
            <SwitchRow label="Transport to work provided" value={field.value} onChange={field.onChange} />
          )}
        />
        <Controller
          control={control}
          name="carRequired"
          render={({ field }) => (
            <SwitchRow label="Workers need their own car" value={field.value} onChange={field.onChange} />
          )}
        />
        <Controller
          control={control}
          name="likelySpecifiedWork"
          render={({ field }) => (
            <SwitchRow
              label="Likely counts as specified work"
              description="Plant and animal cultivation in an eligible regional postcode usually counts towards a 2nd or 3rd working holiday visa. Ticked automatically from the postcode."
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        {postcodeValid && likelySpecifiedWork && !eligiblePostcode ? (
          <WarningBanner>
            This postcode isn’t on the eligible list for plant and animal cultivation. Workers on 417/462
            visas will see that. Only leave this on if it’s another kind of specified work.
          </WarningBanner>
        ) : null}
        {postcodeValid && !likelySpecifiedWork && eligiblePostcode ? (
          <Text variant="bodyMedium">
            This postcode is eligible for plant and animal cultivation, so workers will see that whatever you
            choose.
          </Text>
        ) : null}
      </Section>

      <FieldMessage
        error={
          submitError ?? (Object.keys(errors).length ? 'Please fix the highlighted fields above.' : undefined)
        }
      />
      <HelperText type="info" visible={!!awardWarning}>
        You can still post this job, but please check the pay first.
      </HelperText>
      <BigButton onPress={() => submit()} loading={isSubmitting} disabled={isSubmitting}>
        {submitLabel}
      </BigButton>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  flex: { flex: 1 },
  segment: { minHeight: MIN_TAP, justifyContent: 'center' },
  tall: { minHeight: MIN_TAP },
});
