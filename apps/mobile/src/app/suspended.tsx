import { legal } from '@croppr/shared';
import { Linking } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/providers/AuthProvider';
import { t } from '@/i18n';

export default function Suspended() {
  const { signOut } = useAuth();
  return (
    <Screen>
      <Text variant="headlineMedium">{t('suspended.title')}</Text>
      <Text variant="bodyLarge">{t('suspended.body', { email: legal.supportEmail })}</Text>
      <Button
        mode="outlined"
        icon="email-outline"
        onPress={() => Linking.openURL(`mailto:${legal.supportEmail}`)}
      >
        {t('suspended.contact')}
      </Button>
      <BigButton mode="outlined" onPress={signOut}>
        {t('common.signOut')}
      </BigButton>
    </Screen>
  );
}
