import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Button, Dialog, Divider, IconButton, Portal, Text } from 'react-native-paper';
import { LoadError, Loading } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import { dateRangeLabel, shortDate } from '@/features/jobs/format';
import {
  useDeleteEmployer,
  useDeletePayslip,
  useDeleteShift,
  useSaveEmployer,
  useTracker,
} from '@/features/tracker/api';
import { EmployerForm } from '@/features/tracker/EmployerForm';
import { signedUrl } from '@/lib/storage';
import { useUserId } from '@/providers/AuthProvider';
import { MIN_TAP } from '@/theme';

export default function EmployerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const tracker = useTracker(userId);
  const save = useSaveEmployer(userId);
  const remove = useDeleteEmployer(userId);
  const deleteShift = useDeleteShift(userId);
  const deletePayslip = useDeletePayslip(userId);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (tracker.isPending) return <Loading />;
  const employer = tracker.data?.employers.find((e) => e.id === id);
  if (tracker.isError || !employer) return <LoadError onRetry={() => tracker.refetch()} />;

  const days = tracker.data!.estimate.byEmployer.find((b) => b.employerId === id)?.days ?? 0;
  const shifts = tracker.data!.shifts.filter((s) => s.employer_id === id);
  const payslips = tracker.data!.payslips.filter((p) => p.employer_id === id);

  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen options={{ title: employer.name }} />
      <Text variant="headlineSmall" style={styles.bold}>
        {employer.name}
      </Text>
      <Text variant="bodyLarge">
        {days} day{days === 1 ? '' : 's'} counted (estimate) ·{' '}
        {employer.counts_as_specified ? 'specified work' : 'not counted'}
      </Text>
      <Button mode="text" icon="pencil" onPress={() => setEditing((e) => !e)} style={styles.left}>
        {editing ? 'Hide edit' : 'Edit employer'}
      </Button>
      {editing ? (
        <EmployerForm
          initial={{
            name: employer.name,
            postcode: employer.postcode ?? '',
            abn: employer.abn ?? '',
            countsAsSpecified: employer.counts_as_specified,
          }}
          submitLabel="Save"
          onSubmit={async (v) => {
            await save.mutateAsync({ id, v });
            setEditing(false);
          }}
        />
      ) : null}

      <Divider />
      <Text variant="titleLarge" style={styles.bold}>
        Payslips ({payslips.length})
      </Text>
      {payslips.length === 0 ? (
        <Text variant="bodyMedium">Payslips are the best evidence for your visa application.</Text>
      ) : null}
      {payslips.map((p) => (
        <View key={p.id} style={styles.row}>
          <View style={styles.flex}>
            <Text variant="bodyLarge">{dateRangeLabel(p.period_start, p.period_end)}</Text>
            <Text variant="bodyMedium">
              {p.days_worked} days · {p.hours_total} hrs{p.file_path ? ' · file attached' : ''}
            </Text>
          </View>
          {p.file_path ? (
            <IconButton
              icon="eye"
              accessibilityLabel="View payslip file"
              onPress={async () => Linking.openURL(await signedUrl('payslips', p.file_path!))}
            />
          ) : null}
          <IconButton
            icon="delete-outline"
            accessibilityLabel="Delete payslip"
            onPress={() => deletePayslip.mutate({ id: p.id, filePath: p.file_path })}
          />
        </View>
      ))}
      <Button
        mode="outlined"
        icon="plus"
        contentStyle={styles.tall}
        onPress={() => router.push({ pathname: '/worker/payslip/new', params: { employerId: id } })}
      >
        Add payslip
      </Button>

      <Divider />
      <Text variant="titleLarge" style={styles.bold}>
        Shifts ({shifts.length})
      </Text>
      {shifts.map((s) => (
        <View key={s.id} style={styles.row}>
          <Text variant="bodyLarge" style={styles.flex}>
            {shortDate(s.work_date)} · {s.hours} h
          </Text>
          <IconButton
            icon="delete-outline"
            accessibilityLabel={`Delete shift on ${s.work_date}`}
            onPress={() => deleteShift.mutate(s.id)}
          />
        </View>
      ))}

      <Button
        mode="text"
        textColor="#B00020"
        icon="delete"
        contentStyle={styles.tall}
        onPress={() => setConfirmDelete(true)}
      >
        Delete employer and its records
      </Button>
      <Portal>
        <Dialog visible={confirmDelete} onDismiss={() => setConfirmDelete(false)}>
          <Dialog.Title>Delete {employer.name}?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyLarge">
              This deletes its {shifts.length} shifts and {payslips.length} payslips.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              textColor="#B00020"
              onPress={async () => {
                for (const p of payslips)
                  if (p.file_path) await deletePayslip.mutateAsync({ id: p.id, filePath: p.file_path });
                await remove.mutateAsync(id);
                router.back();
              }}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
  left: { alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TAP },
  flex: { flex: 1 },
  tall: { minHeight: MIN_TAP },
});
