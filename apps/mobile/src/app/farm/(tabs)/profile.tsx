import { useState } from 'react';
import { LoadError, Loading } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import { DangerZone } from '@/features/common/DangerZone';
import { farmToInput, useMyFarm, useSaveFarm } from '@/features/farm/api';
import { FarmForm } from '@/features/farm/FarmForm';
import { VerificationStatusCard } from '@/features/farm/VerificationStatusCard';
import { useUserId } from '@/providers/AuthProvider';
import { Toast } from '@/components/Toast';

export default function FarmProfile() {
  const userId = useUserId();
  const farm = useMyFarm(userId);
  const save = useSaveFarm(userId);
  const [saved, setSaved] = useState(false);

  if (farm.isPending) return <Loading />;
  if (farm.isError || !farm.data) return <LoadError onRetry={() => farm.refetch()} />;

  const verified = farm.data.verification_status === 'verified';
  return (
    <>
      <Screen scroll edges={[]}>
        <VerificationStatusCard farm={farm.data} />
        <FarmForm
          // Remount when the saved record changes so the form shows server-normalised values.
          key={farm.data.updated_at}
          initial={farmToInput(farm.data)}
          submitLabel={farm.data.verification_status === 'rejected' ? 'Save and resubmit' : 'Save changes'}
          legalNote={
            verified
              ? 'Changing your business name, ABN or labour hire details means we re-check them before you can post new jobs.'
              : undefined
          }
          onSubmit={async (values) => {
            await save.mutateAsync(values);
            setSaved(true);
          }}
        />
        <DangerZone />
      </Screen>
      <Toast message={saved ? 'Farm details saved' : null} onDismiss={() => setSaved(false)} />
    </>
  );
}
