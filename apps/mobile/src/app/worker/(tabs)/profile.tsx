import { useState } from 'react';
import { LoadError, Loading } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import { DangerZone } from '@/features/common/DangerZone';
import { useMyWorkerProfile, useSaveWorkerProfile } from '@/features/worker/api';
import { GroupCard } from '@/features/worker/GroupCard';
import { WorkerProfileForm } from '@/features/worker/WorkerProfileForm';
import { useSignedUrl } from '@/lib/storage';
import { useUserId } from '@/providers/AuthProvider';
import { Toast } from '@/components/Toast';

export default function WorkerProfile() {
  const userId = useUserId();
  const profile = useMyWorkerProfile(userId);
  const photoUrl = useSignedUrl('avatars', profile.data?.photoPath);
  const save = useSaveWorkerProfile(userId);
  const [saved, setSaved] = useState(false);

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
          submitLabel="Save changes"
          onSubmit={async (values, photo) => {
            await save.mutateAsync({ values, photo });
            setSaved(true);
          }}
        />
        <DangerZone />
      </Screen>
      <Toast message={saved ? 'Profile saved' : null} onDismiss={() => setSaved(false)} />
    </>
  );
}
