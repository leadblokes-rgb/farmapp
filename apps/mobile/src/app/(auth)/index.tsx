import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import type { SelfServeRole } from '@farmmatch/shared';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';

export default function Welcome() {
  const go = (role: SelfServeRole) => router.push({ pathname: '/sign-in', params: { role } });

  return (
    <Screen>
      <View style={styles.hero}>
        <Text variant="displaySmall" style={styles.title}>FarmMatch</Text>
        <Text variant="titleMedium" style={styles.center}>
          Farm work across Australia, matched to your dates and your visa days.
        </Text>
      </View>
      <View style={styles.actions}>
        <BigButton icon="account-search" onPress={() => go('worker')}>
          I&apos;m looking for work
        </BigButton>
        <BigButton mode="outlined" icon="barn" onPress={() => go('farm')}>
          I&apos;m a farm or employer
        </BigButton>
        <Text variant="bodyMedium" style={styles.center}>
          Already have an account? Pick either option and sign in with your email.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, justifyContent: 'center', gap: 12 },
  title: { textAlign: 'center', fontWeight: '700' },
  center: { textAlign: 'center' },
  actions: { gap: 14 },
});
