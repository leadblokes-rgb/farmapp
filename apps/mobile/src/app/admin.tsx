import { Text } from 'react-native-paper';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/providers/AuthProvider';

// Admin work happens in the Supabase dashboard for the MVP (see docs/admin-runbook.md from milestone 2).
export default function Admin() {
  const { signOut } = useAuth();
  return (
    <Screen>
      <Text variant="headlineMedium">Admin account</Text>
      <Text variant="bodyLarge">
        Admin tasks (approving farms, handling reports, suspending users) are done in the Supabase dashboard
        for now. The mobile app is for workers and farms.
      </Text>
      <BigButton mode="outlined" onPress={signOut}>
        Sign out
      </BigButton>
    </Screen>
  );
}
