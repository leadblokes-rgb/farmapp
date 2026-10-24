import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { BigButton } from '@/components/BigButton';
import { removeUserFiles } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { t } from '@/i18n';

/** Sign out + permanently delete account (privacy requirement). */
export function DangerZone() {
  const { session, signOut } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    if (!session) return;
    setDeleting(true);
    setError(null);
    try {
      await removeUserFiles('avatars', session.user.id);
      await removeUserFiles('farm-logos', session.user.id);
      await removeUserFiles('payslips', session.user.id);
      await removeUserFiles('resumes', session.user.id);
      const { error: err } = await supabase.rpc('delete_my_account');
      if (err) throw err;
      await signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('account.deleteFailed'));
      setDeleting(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <BigButton mode="outlined" icon="logout" onPress={signOut}>
        {t('common.signOut')}
      </BigButton>
      <Button mode="text" textColor="#B00020" onPress={() => setConfirming(true)} contentStyle={styles.tall}>
        {t('account.delete')}
      </Button>
      <Portal>
        <Dialog visible={confirming} onDismiss={() => !deleting && setConfirming(false)}>
          <Dialog.Title>{t('account.confirmTitle')}</Dialog.Title>
          <Dialog.Content style={styles.dialog}>
            <Text variant="bodyLarge">{t('account.confirmBody')}</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirming(false)} disabled={deleting}>
              {t('form.cancel')}
            </Button>
            <Button textColor="#B00020" onPress={deleteAccount} loading={deleting} disabled={deleting}>
              {t('account.confirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: 24 },
  tall: { minHeight: 56 },
  dialog: { gap: 8 },
  error: { color: '#B00020' },
});
