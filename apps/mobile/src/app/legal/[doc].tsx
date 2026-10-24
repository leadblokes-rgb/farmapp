import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { Screen } from '@/components/Screen';
import { LegalDocument, type LegalDoc } from '@/features/legal/LegalDocument';
import { MIN_TAP } from '@/theme';
import { t } from '@/i18n';

/** Terms of use / privacy policy, with a visible Back button (not everyone knows to swipe back). */
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const which: LegalDoc = doc === 'privacy' ? 'privacy' : 'terms';
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <Screen scroll>
      <View style={styles.bar}>
        <Button
          icon="arrow-left"
          mode="text"
          onPress={back}
          contentStyle={styles.tall}
          accessibilityLabel={t('common.back')}
        >
          {t('common.back')}
        </Button>
        <Text variant="titleMedium" style={styles.title}>
          {which === 'privacy' ? t('legal.privacy') : t('legal.terms')}
        </Text>
      </View>
      <LegalDocument doc={which} />
      <Button mode="outlined" icon="arrow-left" onPress={back} contentStyle={styles.tall}>
        {t('common.back')}
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -12 },
  title: { fontWeight: '700', flexShrink: 1 },
  tall: { minHeight: MIN_TAP },
});
