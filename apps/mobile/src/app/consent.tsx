import { legal } from '@croppr/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Checkbox, HelperText, Text } from 'react-native-paper';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

/** Shown after sign-in until the user accepts the current terms of use and privacy policy. */
export default function Consent() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updated = !!profile?.terms_accepted_at;

  async function accept() {
    setSaving(true);
    setError(null);
    const { error: e } = await supabase.rpc('accept_legal', {
      p_terms_version: legal.termsVersion,
      p_privacy_version: legal.privacyVersion,
    });
    if (e) {
      setError(friendlyError(e));
      setSaving(false);
      return;
    }
    await refreshProfile();
  }

  return (
    <Screen scroll>
      <Text variant="headlineMedium" style={styles.bold}>
        {updated ? 'We’ve updated our terms' : 'Before you start'}
      </Text>
      <Text variant="bodyLarge">
        Croppr holds information like your visa details and payslips, so here’s how we look after it and the
        rules everyone on Croppr agrees to.
      </Text>
      {legal.draft ? (
        <Text variant="bodySmall" style={styles.draft}>
          These are draft documents for testing and will be finalised before launch.
        </Text>
      ) : null}

      <Agree
        label="I agree to the Terms of use"
        checked={terms}
        onToggle={() => setTerms((v) => !v)}
        onRead={() => router.push('/legal/terms')}
      />
      <Agree
        label="I’ve read the Privacy policy"
        checked={privacy}
        onToggle={() => setPrivacy((v) => !v)}
        onRead={() => router.push('/legal/privacy')}
      />

      <HelperText type="error" visible={!!error}>
        {error}
      </HelperText>
      <BigButton disabled={!terms || !privacy || saving} loading={saving} onPress={accept}>
        Continue
      </BigButton>
      <Button mode="text" onPress={signOut}>
        Sign out
      </Button>
    </Screen>
  );
}

function Agree({
  label,
  checked,
  onToggle,
  onRead,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  onRead: () => void;
}) {
  return (
    <View style={styles.row}>
      <Checkbox.Item
        label={label}
        status={checked ? 'checked' : 'unchecked'}
        onPress={onToggle}
        position="leading"
        style={styles.item}
        labelStyle={styles.label}
        accessibilityLabel={label}
      />
      <Button compact onPress={onRead} accessibilityLabel={`Read: ${label.replace(/^I.{0,15}(the )/, '')}`}>
        Read
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '800' },
  draft: { opacity: 0.7, fontStyle: 'italic' },
  row: { flexDirection: 'row', alignItems: 'center' },
  item: { flex: 1, paddingHorizontal: 0, minHeight: 56 },
  label: { textAlign: 'left', fontSize: 17 },
});
