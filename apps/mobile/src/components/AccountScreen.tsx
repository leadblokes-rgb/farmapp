import { StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { useAuth } from '@/providers/AuthProvider';
import { BigButton } from './BigButton';
import { Screen } from './Screen';

/** Minimal account screen until full profiles arrive in milestone 2. */
export function AccountScreen() {
  const { session, profile, signOut } = useAuth();
  return (
    <Screen edges={[]}>
      <Card mode="outlined">
        <Card.Content style={styles.content}>
          <Text variant="titleLarge">Signed in</Text>
          <Text variant="bodyLarge">{session?.user.email}</Text>
          <Text variant="bodyLarge">Account type: {profile?.role}</Text>
        </Card.Content>
      </Card>
      <Text variant="bodyMedium">Your full profile can be edited from milestone 2.</Text>
      <BigButton mode="outlined" icon="logout" onPress={signOut}>
        Sign out
      </BigButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 6 },
});
