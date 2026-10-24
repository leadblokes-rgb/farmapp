import { isoToDisplay, shiftIssue, todayIso, trackerLimits } from '@croppr/shared';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, HelperText, Modal, Portal, Text } from 'react-native-paper';
import { BigButton } from '@/components/BigButton';
import { DateField } from '@/components/form/DateField';
import { SingleChoiceChips } from '@/components/form/SingleChoiceChips';
import { Stepper } from '@/components/form/Stepper';
import type { TrackerData } from './api';
import { t } from '@/i18n';
import { sharedText } from '@/i18n/shared';

interface Props {
  visible: boolean;
  employers: TrackerData['employers'];
  /** Already-logged shifts, so saving over one asks first instead of silently replacing it. */
  shifts: TrackerData['shifts'];
  /** Pre-selected employer, and the usual hours at a given employer (from their last shift there). */
  defaults: { employerId?: string; hoursFor: (employerId: string | undefined) => number };
  saving: boolean;
  error?: string;
  onSave: (s: { employerId: string; workDate: string; hours: number }) => void;
  onDismiss: () => void;
}

/** Log one day's work: employer, date (today by default) and hours, all with big controls. */
export function LogShiftSheet({
  visible,
  employers,
  shifts,
  defaults,
  saving,
  error,
  onSave,
  onDismiss,
}: Props) {
  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        {visible ? (
          <Form
            employers={employers}
            shifts={shifts}
            defaults={defaults}
            saving={saving}
            error={error}
            onSave={onSave}
            onDismiss={onDismiss}
          />
        ) : null}
      </Modal>
    </Portal>
  );
}

function Form({ employers, shifts, defaults, saving, error, onSave, onDismiss }: Omit<Props, 'visible'>) {
  const [employerId, setEmployerId] = useState(defaults.employerId ?? employers[0]?.id);
  const [date, setDate] = useState<string | null>(todayIso());
  const [hours, setHours] = useState(defaults.hoursFor(employerId));
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const chooseEmployer = (id: string) => {
    setEmployerId(id);
    setHours(defaults.hoursFor(id));
    setConfirmReplace(false);
  };
  const existing = shifts.find((s) => s.employer_id === employerId && s.work_date === date);
  const employerName = employers.find((e) => e.id === employerId)?.name ?? t('logShift.thisEmployer');

  function save() {
    if (!employerId) return;
    const issue = shiftIssue({ workDate: date, hours }, todayIso());
    const invalid = issue && sharedText(issue);
    setProblem(invalid);
    if (invalid || !date) return;
    if (existing && !confirmReplace) return setConfirmReplace(true);
    onSave({ employerId, workDate: date, hours });
  }

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text variant="headlineSmall" style={styles.bold}>
        {t('logShift.title')}
      </Text>
      <Text variant="titleMedium">{t('logShift.where')}</Text>
      <SingleChoiceChips
        options={employers.map((e) => ({ key: e.id, label: e.name }))}
        value={employerId}
        onChange={chooseEmployer}
      />
      <DateField
        label={t('logShift.date')}
        value={date}
        maxDate={todayIso()}
        onChange={(d) => {
          setDate(d);
          setConfirmReplace(false);
        }}
      />
      <Stepper
        label={t('logShift.hours')}
        value={hours}
        onChange={setHours}
        min={0.5}
        max={trackerLimits.maxHoursPerDay}
        step={0.5}
        suffix={t('logShift.hoursSuffix')}
      />
      <HelperText type="error" visible={!!(problem ?? error)}>
        {problem ?? error}
      </HelperText>
      {confirmReplace && existing ? (
        <Text variant="bodyLarge" style={styles.confirm}>
          {t('logShift.alreadyLogged', {
            hours: existing.hours,
            employer: employerName,
            date: isoToDisplay(existing.work_date),
            newHours: hours,
          })}
        </Text>
      ) : null}
      <BigButton icon="check" disabled={!employerId || saving} loading={saving} onPress={save}>
        {confirmReplace && existing ? t('logShift.replaceWith', { hours }) : t('logShift.save')}
      </BigButton>
      <Button mode="text" onPress={onDismiss} contentStyle={styles.tall}>
        {t('form.cancel')}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  modal: { backgroundColor: 'white', margin: 12, borderRadius: 16, maxHeight: '92%' },
  body: { padding: 20, gap: 12 },
  bold: { fontWeight: '700' },
  tall: { minHeight: 56 },
  confirm: { backgroundColor: '#FFF4D6', padding: 12, borderRadius: 8 },
});
