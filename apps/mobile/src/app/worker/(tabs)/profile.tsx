import { useState } from 'react';
import { LoadError, Loading } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import { DangerZone } from '@/features/common/DangerZone';
import { NotificationSettings } from '@/features/common/NotificationSettings';
import { LegalLinks } from '@/features/legal/LegalLinks';
import { useMyWorkerProfile, useSaveWorkerProfile } from '@/features/worker/api';
import { GroupCard } from '@/features/worker/GroupCard';
import { JobAlertsCard } from '@/features/worker/JobAlertsCard';
import { ResumeCard } from '@/features/worker/ResumeCard';
import { WorkerProfileForm } from '@/features/worker/WorkerProfileForm';
import { useSignedUrl } from '@/lib/storage';
import { useUserId } from '@/providers/AuthProvider';
import { Toast } from '@/components/Toast';
import { t } from '@/i18n';

export default function WorkerProfile() {
  const userId = useUserId();
  const profile = useMyWorkerProfile(userId);
  const photoUrl = useSignedUrl('avatars', profile.data?.photoPath);
  const save = useSaveWorkerProfile(userId);
  const [message, setMessage] = useState<string | null>(null);

  if (profile.isPending) return <Loading />;
  if (profile.isError || !profile.data) return <LoadError onRetry={() => profile.refetch()} />;

  return (
    <>
      <Screen scroll edges={[]}>
        <GroupCard userId={userId} />
        <WorkerProfileForm
          // Remount when the saved profile changes (e.g. after joining a group).
          key={profile.dataUpdatedAt}
          initial={profile.data.values}
          photoUrl={photoUrl.data}
          submitLabel={t('common.saveChanges')}
          onSubmit={async (values, photo) => {
            await save.mutateAsync({ values, photo });
            setMessage(t('workerProfile.saved'));
          }}
        />
        <ResumeCard userId={userId} onMessage={setMessage} />
        <JobAlertsCard userId={userId} onSaved={setMessage} />
        <NotificationSettings userId={userId} role="worker" onSaved={setMessage} />
        <LegalLinks />
        <DangerZone />
      </Screen>
      <Toast message={message} onDismiss={() => setMessage(null)} />
    </>
  );
}
