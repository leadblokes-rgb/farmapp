import { Text } from 'react-native-paper';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/providers/AuthProvider';
import { t } from '@/i18n';

// Admin work happens in the Supabase dashboard for the MVP (see docs/admin-runbook.md from milestone 2).
export default function Admin() {
  const { signOut } = useAuth();
  return (
    <Screen>
      <Text variant="headlineMedium">{t('admin.title')}</Text>
      <Text variant="bodyLarge">{t('admin.body')}</Text>
      <BigButton mode="outlined" onPress={signOut}>
        {t('common.signOut')}
      </BigButton>
    </Screen>
  );
}
