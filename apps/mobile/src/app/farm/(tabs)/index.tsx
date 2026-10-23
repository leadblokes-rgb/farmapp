import { jobRoleLabel } from '@croppr/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Card, Chip, Text } from 'react-native-paper';
import { BigButton } from '@/components/BigButton';
import { LoadError, Loading } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import { Toast } from '@/components/Toast';
import { useMyFarm } from '@/features/farm/api';
import { useMyJobs, type JobWithCounts } from '@/features/farm/jobsApi';
import { VerificationStatusCard } from '@/features/farm/VerificationStatusCard';
import { PendingReviews } from '@/features/ratings/PendingReviews';
import { dateRangeLabel, payLabel } from '@/features/jobs/format';
import { useUserId } from '@/providers/AuthProvider';

const STATUS_LABEL = { open: 'Open', filled: 'Filled', closed: 'Closed' } as const;

export default function Jobs() {
  const farm = useMyFarm(useUserId());
  const jobs = useMyJobs(farm.data?.id);
  const [message, setMessage] = useState<string | null>(null);
  const [buttonHeight, setButtonHeight] = useState(0);

  if (farm.isPending) return <Loading />;
  if (farm.isError || !farm.data) return <LoadError onRetry={() => farm.refetch()} />;

  const verified = farm.data.verification_status === 'verified';
  return (
    <Screen edges={[]}>
      <FlatList
        data={jobs.data ?? []}
        keyExtractor={(j) => j.id}
        contentContainerStyle={styles.list}
        refreshing={jobs.isRefetching}
        onRefresh={() => jobs.refetch()}
        ListHeaderComponent={
          verified ? <PendingReviews onMessage={setMessage} /> : <VerificationStatusCard farm={farm.data} />
        }
        ListEmptyComponent={
          jobs.isPending ? undefined : (
            <View style={styles.empty}>
              <Text variant="headlineSmall">No jobs yet</Text>
              <Text variant="bodyLarge" style={styles.center}>
                Post a job and Croppr will build you a ranked shortlist of available workers.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => <JobCard job={item} />}
      />
      <View onLayout={(e) => setButtonHeight(e.nativeEvent.layout.height)}>
        <BigButton icon="plus" disabled={!verified} onPress={() => router.push('/farm/job/new')}>
          Post a job
        </BigButton>
      </View>
      <Toast message={message} onDismiss={() => setMessage(null)} bottomOffset={buttonHeight + 20} />
    </Screen>
  );
}

function JobCard({ job }: { job: JobWithCounts }) {
  const applicants = job.applications[0]?.count ?? 0;
  const pay = payLabel(job);
  return (
    <Card
      mode="outlined"
      onPress={() => router.push(`/farm/job/${job.id}`)}
      style={job.status !== 'open' && styles.dim}
    >
      <Card.Content style={styles.cardContent}>
        <View style={styles.titleRow}>
          <Text variant="titleLarge" style={styles.title}>
            {job.title}
          </Text>
          <Chip compact>{STATUS_LABEL[job.status]}</Chip>
        </View>
        <Text variant="bodyLarge">
          {jobRoleLabel(job.role_type)} · {dateRangeLabel(job.start_date, job.end_date)}
        </Text>
        <Text variant="bodyLarge">
          {pay.main} · {job.workers_needed} needed
        </Text>
        <Text variant="titleMedium" style={styles.applicants}>
          {applicants} applicant{applicants === 1 ? '' : 's'}
        </Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12, paddingBottom: 12, flexGrow: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 48 },
  center: { textAlign: 'center' },
  cardContent: { gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontWeight: '700' },
  applicants: { color: '#17482F', fontWeight: '700' },
  dim: { opacity: 0.7 },
});
