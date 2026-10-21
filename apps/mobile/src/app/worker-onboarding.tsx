import { Text } from 'react-native-paper';
import { Screen } from '@/components/Screen';
import { EMPTY_WORKER_PROFILE, useSaveWorkerProfile } from '@/features/worker/api';
import { WorkerProfileForm } from '@/features/worker/WorkerProfileForm';
import { RequireSession, useAuth, useUserId } from '@/providers/AuthProvider';

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
      <Text variant="headlineMedium">Set up your profile</Text>
      <Text variant="bodyLarge">Farms use this to pick their crew. It takes about 3 minutes.</Text>
      <WorkerProfileForm
        initial={EMPTY_WORKER_PROFILE}
        submitLabel="Save and start finding work"
        onSubmit={async (values, photo) => {
          await save.mutateAsync({ values, photo });
          await refreshProfile();
        }}
      />
    </Screen>
  );
}
