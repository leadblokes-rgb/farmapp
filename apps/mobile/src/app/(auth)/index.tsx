import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import type { SelfServeRole } from '@croppr/shared';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';

export default function Welcome() {
  const go = (role: SelfServeRole) => router.push({ pathname: '/sign-in', params: { role } });

  return (
    <Screen>
      <View style={styles.hero}>
        <Image
          source={require('../../../assets/brand/logo.png')}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel={t('welcome.logo')}
        />
        <Text variant="headlineSmall" style={[styles.center, styles.headline]}>
          {t('welcome.headline')}
        </Text>
        <Text variant="bodyLarge" style={styles.center}>
          {t('welcome.sub')}
        </Text>
      </View>
      <View style={styles.actions}>
        <BigButton icon="account-search" onPress={() => go('worker')}>
          {t('welcome.worker')}
        </BigButton>
        <BigButton mode="outlined" icon="barn" onPress={() => go('farm')}>
          {t('welcome.farm')}
        </BigButton>
        <Text variant="bodyMedium" style={styles.center}>
          {t('welcome.already')}
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
