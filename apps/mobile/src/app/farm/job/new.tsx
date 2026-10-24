import { todayIso } from '@croppr/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { LoadError, Loading } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import { WarningBanner } from '@/components/WarningBanner';
import { useMyFarm } from '@/features/farm/api';
import { emptyJob, jobToInput, useJob, useSaveJob } from '@/features/farm/jobsApi';
import { JobForm } from '@/features/farm/JobForm';
import { useUserId } from '@/providers/AuthProvider';
import { t } from '@/i18n';

/** Post a job, or repost one (`?from=<job id>`): a copy with the dates cleared. */
export default function NewJob() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const farm = useMyFarm(useUserId());
  const source = useJob(from);
  if (farm.isPending || (from && source.isPending)) return <Loading />;
  if (farm.isError || !farm.data) return <LoadError onRetry={() => farm.refetch()} />;
  if (from && (source.isError || !source.data)) return <LoadError onRetry={() => source.refetch()} />;

  const initial = source.data
    ? { ...jobToInput(source.data), startDate: '', endDate: '' }
    : emptyJob(farm.data.postcode, todayIso());
  return <NewJobForm farmId={farm.data.id} initial={initial} reposting={!!source.data} />;
}

function NewJobForm({
  farmId,
  initial,
  reposting,
}: {
  farmId: string;
  initial: ReturnType<typeof emptyJob>;
  reposting: boolean;
}) {
  const save = useSaveJob(farmId);
  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen options={{ title: reposting ? t('jobs.repost') : t('jobs.post') }} />
      {reposting ? <WarningBanner>{t('jobs.copied')}</WarningBanner> : null}
      <JobForm
        initial={initial}
        submitLabel={t('jobs.postSubmit')}
        onSubmit={async (values) => {
          const id = await save.mutateAsync({ values });
          router.replace(`/farm/job/${id}`);
        }}
      />
    </Screen>
  );
}
