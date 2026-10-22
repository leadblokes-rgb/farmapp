import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { HelperText, Text } from 'react-native-paper';
import type { SelfServeRole } from '@croppr/shared';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

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
      <Text variant="headlineMedium">How will you use Croppr?</Text>
      <Text variant="bodyLarge">You can&apos;t change this later, so pick the one that fits.</Text>
      <BigButton
        icon="account-search"
        onPress={() => choose('worker')}
        loading={saving === 'worker'}
        disabled={saving !== null}
      >
        I&apos;m looking for farm work
      </BigButton>
      <BigButton
        icon="barn"
        mode="outlined"
        onPress={() => choose('farm')}
        loading={saving === 'farm'}
        disabled={saving !== null}
      >
        I&apos;m a farm or employer
      </BigButton>
      <HelperText type="error" visible={error !== null}>
        {error}
      </HelperText>
      <BigButton mode="text" onPress={signOut} style={styles.signOut}>
        Sign out
      </BigButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  signOut: { marginTop: 'auto' },
});
