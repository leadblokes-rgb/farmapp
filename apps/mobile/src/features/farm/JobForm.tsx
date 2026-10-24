import {
  JOB_ROLE_KEYS,
  belowAwardIssue,
  formatCents,
  jobSchema,
  payRules,
  awardMinHourlyCents,
  EMPLOYMENT_TYPES,
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
import { usePostcode, useSpecifiedWorkCheck } from '@/features/common/api';
import { zodResolver } from '@/lib/zodResolver';
import { MIN_TAP } from '@/theme';
import { friendlyError } from '@/lib/errors';
import { t } from '@/i18n';
import { employmentDescription, employmentLabel, roleLabel, sharedText } from '@/i18n/shared';

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
  // When the farm enters a new postcode or type of work, pre-tick "specified work" from the
  // eligible postcode lists (in the database). The farm can still change it.
  const roleType = useWatch({ control, name: 'roleType' });
  const postcodeValid = /^\d{4}$/.test(postcode);
  const check = useSpecifiedWorkCheck(postcode, roleType);
  const eligiblePostcode =
    postcodeValid && !!check.data && (check.data.eligible_417 || check.data.eligible_462);
  const checkKey = `${postcode}|${roleType}`;
  const appliedKey = useRef(checkKey);
  useEffect(() => {
    if (!postcodeValid || !check.data || appliedKey.current === checkKey) return;
    appliedKey.current = checkKey;
    setValue('likelySpecifiedWork', check.data.eligible_417 || check.data.eligible_462);
  }, [checkKey, check.data, postcodeValid, setValue]);
  const place = usePostcode(postcode);
  const employmentType = useWatch({ control, name: 'employmentType' });
  const awardRate = formatCents(awardMinHourlyCents(employmentType));
  const typeLabel = employmentLabel(employmentType);
  const awardIssue = belowAwardIssue({
    payType,
    payRateCents: payRateCents ?? 0,
    minHourlyGuaranteeCents,
    employmentType,
  });
  const awardWarning = awardIssue && sharedText(awardIssue);

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
      <Section title={t('jobForm.theJob')}>
        <TextField
          control={control}
          name="title"
          label={t('jobForm.title')}
          placeholder={t('jobForm.titlePlaceholder')}
        />
        <Controller
          control={control}
          name="roleType"
          render={({ field }) => (
            <SingleChoiceChips
              options={JOB_ROLE_KEYS.map((key) => ({ key, label: roleLabel(key) }))}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <TextField
          control={control}
          name="description"
          label={t('jobForm.description')}
          multiline
          numberOfLines={4}
          hint={t('jobForm.descriptionHint')}
        />
        <Controller
          control={control}
          name="workersNeeded"
          render={({ field }) => (
            <Stepper
              label={t('jobForm.workersNeeded')}
              value={field.value}
              onChange={field.onChange}
              min={1}
              max={500}
            />
          )}
        />
      </Section>

      <Section title={t('jobForm.whereWhen')}>
        <Controller
          control={control}
          name="postcode"
          render={({ field, fieldState }) => (
            <PostcodeField
              label={t('jobForm.postcode')}
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
        <View style={styles.row}>
          <Controller
            control={control}
            name="startDate"
            render={({ field, fieldState }) => (
              <DateField
                label={t('jobForm.startDate')}
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
                label={t('jobForm.endDate')}
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
              label={t('jobForm.hours')}
              value={field.value}
              onChange={field.onChange}
              min={1}
              max={80}
            />
          )}
        />
      </Section>

      <Section title={t('jobForm.pay')}>
        <Text variant="titleMedium">{t('jobForm.employmentType')}</Text>
        <Controller
          control={control}
          name="employmentType"
          render={({ field, fieldState }) => (
            <View>
              <SingleChoiceChips
                options={EMPLOYMENT_TYPES.map((e) => ({ key: e.key, label: employmentLabel(e.key) }))}
                value={field.value}
                onChange={field.onChange}
              />
              <FieldMessage
                error={fieldState.error?.message}
                hint={t('jobForm.employmentHint', {
                  description: employmentDescription(field.value),
                  rate: formatCents(awardMinHourlyCents(field.value)),
                })}
              />
            </View>
          )}
        />
        <Controller
          control={control}
          name="payType"
          render={({ field }) => (
            <SegmentedButtons
              value={field.value}
              onValueChange={field.onChange}
              buttons={[
                { value: 'hourly', label: t('jobForm.hourly'), icon: 'clock-outline', style: styles.segment },
                { value: 'piece_rate', label: t('jobForm.pieceRate'), icon: 'basket', style: styles.segment },
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
                label={t('jobForm.hourlyRate')}
                suffix={t('form.perHour')}
                value={field.value || null}
                onChange={field.onChange}
                error={fieldState.error?.message}
                hint={t('jobForm.awardMin', { type: typeLabel, rate: awardRate })}
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
                    label={t('jobForm.pieceRate')}
                    value={field.value || null}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <View style={styles.flex}>
                <TextField control={control} name="pieceRateUnit" label={t('jobForm.per')} />
              </View>
            </View>
            <Controller
              control={control}
              name="minHourlyGuaranteeCents"
              render={({ field, fieldState }) => (
                <MoneyField
                  label={t('jobForm.guarantee')}
                  suffix={t('form.perHour')}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                  hint={t('jobForm.guaranteeHint', { type: typeLabel.toLowerCase(), rate: awardRate })}
                />
              )}
            />
            {pieceRateUnit ? (
              <Text variant="bodyMedium">
                {t('jobForm.workersSee', {
                  rate: formatCents(payRateCents || 0),
                  unit: pieceRateUnit,
                  min: formatCents(minHourlyGuaranteeCents || 0),
                })}
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
              {t('jobForm.fairWork')}
            </Button>
          </>
        ) : null}
      </Section>

      <Section title={t('jobForm.provide')}>
        <Controller
          control={control}
          name="accommodationProvided"
          render={({ field }) => (
            <SwitchRow label={t('jobForm.accommodation')} value={field.value} onChange={field.onChange} />
          )}
        />
        {accommodationProvided ? (
          <Controller
            control={control}
            name="accommodationCostWeekCents"
            render={({ field, fieldState }) => (
              <MoneyField
                label={t('jobForm.accommodationCost')}
                suffix={t('form.perWeek')}
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
            <SwitchRow label={t('jobForm.transport')} value={field.value} onChange={field.onChange} />
          )}
        />
        <Controller
          control={control}
          name="carRequired"
          render={({ field }) => (
            <SwitchRow label={t('jobForm.car')} value={field.value} onChange={field.onChange} />
          )}
        />
        <Controller
          control={control}
          name="likelySpecifiedWork"
          render={({ field }) => (
            <SwitchRow
              label={t('jobForm.specified')}
              description={t('jobForm.specifiedNote')}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        {postcodeValid && check.data && likelySpecifiedWork && !eligiblePostcode ? (
          <WarningBanner>{t('jobForm.notEligible')}</WarningBanner>
        ) : null}
        {postcodeValid && !likelySpecifiedWork && eligiblePostcode ? (
          <Text variant="bodyMedium">{t('jobForm.eligible')}</Text>
        ) : null}
      </Section>

      <FieldMessage error={submitError ?? (Object.keys(errors).length ? t('form.fixFields') : undefined)} />
      <HelperText type="info" visible={!!awardWarning}>
        {t('jobForm.stillPost')}
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
