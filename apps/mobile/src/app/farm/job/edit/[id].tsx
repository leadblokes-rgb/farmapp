import { router, Stack, useLocalSearchParams } from 'expo-router';
import { LoadError, Loading } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import { useMyFarm } from '@/features/farm/api';
import { jobToInput, useJob, useSaveJob } from '@/features/farm/jobsApi';
import { JobForm } from '@/features/farm/JobForm';
import { useUserId } from '@/providers/AuthProvider';

export default function EditJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const farm = useMyFarm(useUserId());
  const job = useJob(id);
  const save = useSaveJob(farm.data?.id ?? '');

  if (job.isPending || farm.isPending) return <Loading />;
  if (job.isError || !job.data) return <LoadError onRetry={() => job.refetch()} />;

  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen options={{ title: 'Edit job' }} />
      <JobForm
        initial={jobToInput(job.data)}
        submitLabel="Save changes"
        onSubmit={async (values) => {
          await save.mutateAsync({ id, values });
          router.back();
        }}
      />
    </Screen>
  );
}
