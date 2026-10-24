import { useState } from 'react';
import { LoadError, Loading } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import { DangerZone } from '@/features/common/DangerZone';
import { NotificationSettings } from '@/features/common/NotificationSettings';
import { LegalLinks } from '@/features/legal/LegalLinks';
import { farmToInput, useMyFarm, useSaveFarm } from '@/features/farm/api';
import { FarmForm } from '@/features/farm/FarmForm';
import { FarmPageEditor } from '@/features/farm/FarmPageEditor';
import { VerificationStatusCard } from '@/features/farm/VerificationStatusCard';
import { useUserId } from '@/providers/AuthProvider';
import { Toast } from '@/components/Toast';
import { t } from '@/i18n';

export default function FarmProfile() {
  const userId = useUserId();
  const farm = useMyFarm(userId);
  const save = useSaveFarm(userId);
  const [message, setMessage] = useState<string | null>(null);

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
          submitLabel={
            farm.data.verification_status === 'rejected' ? t('farmProfile.resubmit') : t('common.saveChanges')
          }
          legalNote={verified ? t('farmProfile.legalNote') : undefined}
          onSubmit={async (values) => {
            await save.mutateAsync(values);
            setMessage(t('farmProfile.saved'));
          }}
        />
        <FarmPageEditor farm={farm.data} userId={userId} onSaved={setMessage} />
        <NotificationSettings userId={userId} role="farm" onSaved={setMessage} />
        <LegalLinks />
        <DangerZone />
      </Screen>
      <Toast message={message} onDismiss={() => setMessage(null)} />
    </>
  );
}
