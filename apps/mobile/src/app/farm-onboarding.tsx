import { Text } from 'react-native-paper';
import { Screen } from '@/components/Screen';
import { EMPTY_FARM, useSaveFarm } from '@/features/farm/api';
import { FarmForm } from '@/features/farm/FarmForm';
import { RequireSession, useAuth, useUserId } from '@/providers/AuthProvider';
import { t } from '@/i18n';

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
      <Text variant="headlineMedium">{t('onboarding.farm.title')}</Text>
      <Text variant="bodyLarge">{t('onboarding.farm.intro')}</Text>
      <FarmForm
        initial={EMPTY_FARM}
        submitLabel={t('onboarding.farm.submit')}
        onSubmit={async (values) => {
          await save.mutateAsync(values);
          await refreshProfile();
        }}
      />
    </Screen>
  );
}
