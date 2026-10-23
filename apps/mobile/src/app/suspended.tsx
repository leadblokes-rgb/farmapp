import { legal } from '@croppr/shared';
import { Linking } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/providers/AuthProvider';

export default function Suspended() {
  const { signOut } = useAuth();
  return (
    <Screen>
      <Text variant="headlineMedium">Account suspended</Text>
      <Text variant="bodyLarge">
        Your account has been suspended by the Croppr team. If you think this is a mistake, contact us at{' '}
        {legal.supportEmail}.
      </Text>
      <Button
        mode="outlined"
        icon="email-outline"
        onPress={() => Linking.openURL(`mailto:${legal.supportEmail}`)}
      >
        Contact support
      </Button>
      <BigButton mode="outlined" onPress={signOut}>
        Sign out
      </BigButton>
    </Screen>
  );
}
