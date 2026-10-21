import { todayIso } from '@croppr/shared';
import { router, Stack } from 'expo-router';
import { LoadError, Loading } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import { useMyFarm } from '@/features/farm/api';
import { emptyJob, useSaveJob } from '@/features/farm/jobsApi';
import { JobForm } from '@/features/farm/JobForm';
import { useUserId } from '@/providers/AuthProvider';

export default function NewJob() {
  const farm = useMyFarm(useUserId());
  if (farm.isPending) return <Loading />;
  if (farm.isError || !farm.data) return <LoadError onRetry={() => farm.refetch()} />;
  return <NewJobForm farmId={farm.data.id} postcode={farm.data.postcode} />;
}

function NewJobForm({ farmId, postcode }: { farmId: string; postcode: string }) {
  const save = useSaveJob(farmId);
  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen options={{ title: 'Post a job' }} />
      <JobForm
        initial={emptyJob(postcode, todayIso())}
        submitLabel="Post job"
        onSubmit={async (values) => {
          const id = await save.mutateAsync({ values });
          router.replace(`/farm/job/${id}`);
        }}
      />
    </Screen>
  );
}
