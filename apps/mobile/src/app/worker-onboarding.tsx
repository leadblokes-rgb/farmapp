import { Text } from 'react-native-paper';
import { Screen } from '@/components/Screen';
import { EMPTY_WORKER_PROFILE, useSaveWorkerProfile } from '@/features/worker/api';
import { WorkerProfileForm } from '@/features/worker/WorkerProfileForm';
import { RequireSession, useAuth, useUserId } from '@/providers/AuthProvider';
import { t } from '@/i18n';

export default function WorkerOnboarding() {
  return (
    <RequireSession>
      <WorkerOnboardingScreen />
    </RequireSession>
  );
}

function WorkerOnboardingScreen() {
  const { refreshProfile } = useAuth();
  const userId = useUserId();
  const save = useSaveWorkerProfile(userId);

  return (
    <Screen scroll>
      <Text variant="headlineMedium">{t('onboarding.worker.title')}</Text>
      <Text variant="bodyLarge">{t('onboarding.worker.intro')}</Text>
      <WorkerProfileForm
        initial={EMPTY_WORKER_PROFILE}
        submitLabel={t('onboarding.worker.submit')}
        onSubmit={async (values, photo) => {
          await save.mutateAsync({ values, photo });
          await refreshProfile();
        }}
      />
    </Screen>
  );
}
