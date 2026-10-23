import { isoToDisplay, todayIso } from '@croppr/shared';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, HelperText, Modal, Portal, Text } from 'react-native-paper';
import { BigButton } from '@/components/BigButton';
import { DateField } from '@/components/form/DateField';
import { SingleChoiceChips } from '@/components/form/SingleChoiceChips';
import { Stepper } from '@/components/form/Stepper';
import type { TrackerData } from './api';

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
  const chooseEmployer = (id: string) => {
    setEmployerId(id);
    setHours(defaults.hoursFor(id));
    setConfirmReplace(false);
  };
  const existing = shifts.find((s) => s.employer_id === employerId && s.work_date === date);
  const employerName = employers.find((e) => e.id === employerId)?.name ?? 'this employer';

  function save() {
    if (!employerId || !date) return;
    if (existing && !confirmReplace) return setConfirmReplace(true);
    onSave({ employerId, workDate: date, hours });
  }

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text variant="headlineSmall" style={styles.bold}>
        Log a shift
      </Text>
      <Text variant="titleMedium">Where</Text>
      <SingleChoiceChips
        options={employers.map((e) => ({ key: e.id, label: e.name }))}
        value={employerId}
        onChange={chooseEmployer}
      />
      <DateField
        label="Date"
        value={date}
        maxDate={todayIso()}
        onChange={(d) => {
          setDate(d);
          setConfirmReplace(false);
        }}
      />
      <Stepper
        label="Hours worked"
        value={hours}
        onChange={setHours}
        min={0.5}
        max={16}
        step={0.5}
        suffix="h"
      />
      <HelperText type="error" visible={!!error}>
        {error}
      </HelperText>
      {confirmReplace && existing ? (
        <Text variant="bodyLarge" style={styles.confirm}>
          You already logged {existing.hours}h at {employerName} on {isoToDisplay(existing.work_date)}.
          Replace it with {hours}h?
        </Text>
      ) : null}
      <BigButton icon="check" disabled={!employerId || !date || saving} loading={saving} onPress={save}>
        {confirmReplace && existing ? `Replace with ${hours}h` : 'Save shift'}
      </BigButton>
      <Button mode="text" onPress={onDismiss} contentStyle={styles.tall}>
        Cancel
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
