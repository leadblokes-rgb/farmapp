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
import { t } from '@/i18n';

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
        {updated ? t('consent.titleUpdated') : t('consent.title')}
      </Text>
      <Text variant="bodyLarge">{t('consent.intro')}</Text>
      {legal.draft ? (
        <Text variant="bodySmall" style={styles.draft}>
          {t('consent.draft')}
        </Text>
      ) : null}

      <Agree
        label={t('consent.agreeTerms')}
        readLabel={t('consent.readTerms')}
        checked={terms}
        onToggle={() => setTerms((v) => !v)}
        onRead={() => router.push('/legal/terms')}
      />
      <Agree
        label={t('consent.readPrivacy')}
        readLabel={t('consent.readPrivacyLabel')}
        checked={privacy}
        onToggle={() => setPrivacy((v) => !v)}
        onRead={() => router.push('/legal/privacy')}
      />

      <HelperText type="error" visible={!!error}>
        {error}
      </HelperText>
      <BigButton disabled={!terms || !privacy || saving} loading={saving} onPress={accept}>
        {t('consent.continue')}
      </BigButton>
      <Button mode="text" onPress={signOut}>
        {t('common.signOut')}
      </Button>
    </Screen>
  );
}

function Agree({
  label,
  readLabel,
  checked,
  onToggle,
  onRead,
}: {
  label: string;
  readLabel: string;
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
      <Button compact onPress={onRead} accessibilityLabel={readLabel}>
        {t('consent.read')}
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
