import { legal } from '@croppr/shared';
import { router } from 'expo-router';
import { Linking, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { Section } from '@/components/form/Section';

/** Profile → "Privacy, terms and support". */
export function LegalLinks() {
  return (
    <Section title="Privacy, terms and support">
      <Button
        mode="text"
        icon="file-document-outline"
        style={styles.left}
        onPress={() => router.push('/legal/terms')}
      >
        Terms of use
      </Button>
      <Button
        mode="text"
        icon="shield-account-outline"
        style={styles.left}
        onPress={() => router.push('/legal/privacy')}
      >
        Privacy policy
      </Button>
      <Button
        mode="text"
        icon="email-outline"
        style={styles.left}
        onPress={() => Linking.openURL(`mailto:${legal.supportEmail}`)}
      >
        Contact support ({legal.supportEmail})
      </Button>
    </Section>
  );
}

const styles = StyleSheet.create({
  left: { alignSelf: 'flex-start' },
});
