import { legal } from '@croppr/shared';
import { router } from 'expo-router';
import { Linking, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { Section } from '@/components/form/Section';
import { t } from '@/i18n';

/** Profile → "Privacy, terms and support". */
export function LegalLinks() {
  return (
    <Section title={t('legal.linksTitle')}>
      <Button
        mode="text"
        icon="file-document-outline"
        style={styles.left}
        onPress={() => router.push('/legal/terms')}
      >
        {t('legal.terms')}
      </Button>
      <Button
        mode="text"
        icon="shield-account-outline"
        style={styles.left}
        onPress={() => router.push('/legal/privacy')}
      >
        {t('legal.privacy')}
      </Button>
      <Button
        mode="text"
        icon="email-outline"
        style={styles.left}
        onPress={() => Linking.openURL(`mailto:${legal.supportEmail}`)}
      >
        {t('legal.contact', { email: legal.supportEmail })}
      </Button>
    </Section>
  );
}

const styles = StyleSheet.create({
  left: { alignSelf: 'flex-start' },
});
