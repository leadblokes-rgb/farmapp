import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { HelperText, Text } from 'react-native-paper';
import type { SelfServeRole } from '@croppr/shared';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { t } from '@/i18n';

export default function ChooseRole() {
  const { refreshProfile, signOut } = useAuth();
  const [saving, setSaving] = useState<SelfServeRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(role: SelfServeRole) {
    setSaving(role);
    setError(null);
    const { error: err } = await supabase.rpc('set_my_role', { new_role: role });
    if (err) {
      setError(friendlyError(err));
      setSaving(null);
      return;
    }
    await refreshProfile();
  }

  return (
    <Screen>
      <Text variant="headlineMedium">{t('chooseRole.title')}</Text>
      <Text variant="bodyLarge">{t('chooseRole.intro')}</Text>
      <BigButton
        icon="account-search"
        onPress={() => choose('worker')}
        loading={saving === 'worker'}
        disabled={saving !== null}
      >
        {t('chooseRole.worker')}
      </BigButton>
      <BigButton
        icon="barn"
        mode="outlined"
        onPress={() => choose('farm')}
        loading={saving === 'farm'}
        disabled={saving !== null}
      >
        {t('chooseRole.farm')}
      </BigButton>
      <HelperText type="error" visible={error !== null}>
        {error}
      </HelperText>
      <BigButton mode="text" onPress={signOut} style={styles.signOut}>
        {t('common.signOut')}
      </BigButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  signOut: { marginTop: 'auto' },
});
