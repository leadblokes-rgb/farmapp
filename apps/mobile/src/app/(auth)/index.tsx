import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import type { SelfServeRole } from '@croppr/shared';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';

export default function Welcome() {
  const go = (role: SelfServeRole) => router.push({ pathname: '/sign-in', params: { role } });

  return (
    <Screen>
      <View style={styles.hero}>
        <Image
          source={require('../../../assets/brand/logo.png')}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel="Croppr"
        />
        <Text variant="headlineSmall" style={[styles.center, styles.headline]}>
          Get matched with farm work across Australia.
        </Text>
        <Text variant="bodyLarge" style={styles.center}>
          Whether you&apos;re after a season&apos;s work or hiring your next crew.
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
  logo: { width: '80%', aspectRatio: 900 / 817, alignSelf: 'center', maxWidth: 320 },
  center: { textAlign: 'center' },
  headline: { fontWeight: '700' },
  actions: { gap: 14 },
});
