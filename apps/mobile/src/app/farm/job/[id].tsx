import { jobRoleLabel } from '@croppr/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Snackbar, Text } from 'react-native-paper';
import { LoadError, Loading } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import { useMyFarm } from '@/features/farm/api';
import { jobToInput, useJob, useSaveJob, useSetJobStatus, type JobStatus } from '@/features/farm/jobsApi';
import { JobForm } from '@/features/farm/JobForm';
import { dateRangeLabel } from '@/features/jobs/format';
import { useUserId } from '@/providers/AuthProvider';
import { MIN_TAP } from '@/theme';

export default function FarmJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const farm = useMyFarm(useUserId());
  const job = useJob(id);
  const save = useSaveJob(farm.data?.id ?? '');
  const setStatus = useSetJobStatus();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (job.isPending || farm.isPending) return <Loading />;
  if (job.isError || !job.data) return <LoadError onRetry={() => job.refetch()} />;

  const j = job.data;
  const applicants = j.applications[0]?.count ?? 0;
  const changeStatus = (status: JobStatus, msg: string) =>
    setStatus.mutate({ id: j.id, status }, { onSuccess: () => setMessage(msg) });

  return (
    <>
      <Screen scroll edges={['bottom']}>
        <Stack.Screen options={{ title: j.title }} />
        <Card mode="outlined">
          <Card.Content style={styles.summary}>
            <Text variant="titleLarge" style={styles.bold}>
              {j.title}
            </Text>
            <Text variant="bodyLarge">
              {jobRoleLabel(j.role_type)} · {dateRangeLabel(j.start_date, j.end_date)} · {j.workers_needed}{' '}
              needed
            </Text>
            <Text variant="bodyLarge">
              Status: <Text style={styles.bold}>{j.status}</Text>
            </Text>
          </Card.Content>
        </Card>

        <Card mode="outlined" style={styles.applicants}>
          <Card.Content style={styles.summary}>
            <Text variant="titleLarge" style={styles.bold}>
              {applicants} applicant{applicants === 1 ? '' : 's'}
            </Text>
            <Text variant="bodyMedium">
              The ranked shortlist with bulk accept/decline arrives in milestone 4.
            </Text>
          </Card.Content>
        </Card>

        <View style={styles.actions}>
          {j.status === 'open' ? (
            <>
              <Button
                mode="outlined"
                icon="account-check"
                contentStyle={styles.tall}
                onPress={() => changeStatus('filled', 'Marked as filled. It no longer shows to workers.')}
              >
                Mark as filled
              </Button>
              <Button
                mode="outlined"
                icon="close-circle-outline"
                contentStyle={styles.tall}
                onPress={() => changeStatus('closed', 'Job closed. It no longer shows to workers.')}
              >
                Close job
              </Button>
            </>
          ) : (
            <Button
              mode="contained"
              icon="restore"
              contentStyle={styles.tall}
              onPress={() => changeStatus('open', 'Job reopened.')}
            >
              Reopen job
            </Button>
          )}
          <Button mode="text" icon="pencil" contentStyle={styles.tall} onPress={() => setEditing((e) => !e)}>
            {editing ? 'Hide edit form' : 'Edit job details'}
          </Button>
        </View>

        {editing ? (
          <JobForm
            key={j.updated_at}
            initial={jobToInput(j)}
            submitLabel="Save changes"
            onSubmit={async (values) => {
              await save.mutateAsync({ id: j.id, values });
              setEditing(false);
              setMessage('Job updated');
            }}
          />
        ) : null}
      </Screen>
      <Snackbar visible={message !== null} onDismiss={() => setMessage(null)} duration={3000}>
        {message}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  summary: { gap: 4 },
  bold: { fontWeight: '700' },
  applicants: { borderColor: '#1B5E20', borderWidth: 2 },
  actions: { gap: 8 },
  tall: { minHeight: MIN_TAP },
});
