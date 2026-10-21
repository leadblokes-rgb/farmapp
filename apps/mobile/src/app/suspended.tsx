import { Text } from 'react-native-paper';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/providers/AuthProvider';

export default function Suspended() {
  const { signOut } = useAuth();
  return (
    <Screen>
      <Text variant="headlineMedium">Account suspended</Text>
      <Text variant="bodyLarge">
        Your account has been suspended by the FarmMatch team. If you think this is a mistake, contact
        support@farmmatch.example.
      </Text>
      <BigButton mode="outlined" onPress={signOut}>
        Sign out
      </BigButton>
    </Screen>
  );
}
