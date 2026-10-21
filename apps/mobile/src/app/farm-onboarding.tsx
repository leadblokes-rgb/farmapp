import { Text } from 'react-native-paper';
import { Screen } from '@/components/Screen';
import { EMPTY_FARM, useSaveFarm } from '@/features/farm/api';
import { FarmForm } from '@/features/farm/FarmForm';
import { RequireSession, useAuth, useUserId } from '@/providers/AuthProvider';

export default function FarmOnboarding() {
  return (
    <RequireSession>
      <FarmOnboardingScreen />
    </RequireSession>
  );
}

function FarmOnboardingScreen() {
  const { refreshProfile } = useAuth();
  const userId = useUserId();
  const save = useSaveFarm(userId);

  return (
    <Screen scroll>
      <Text variant="headlineMedium">Register your business</Text>
      <Text variant="bodyLarge">
        Every farm on Croppr is checked by our team, so workers can trust the jobs they see.
      </Text>
      <FarmForm
        initial={EMPTY_FARM}
        submitLabel="Submit for verification"
        onSubmit={async (values) => {
          await save.mutateAsync(values);
          await refreshProfile();
        }}
      />
    </Screen>
  );
}
