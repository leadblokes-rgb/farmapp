import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { BigButton } from '@/components/BigButton';
import { removeUserFiles } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

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
      const { error: err } = await supabase.rpc('delete_my_account');
      if (err) throw err;
      await signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete your account.');
      setDeleting(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <BigButton mode="outlined" icon="logout" onPress={signOut}>
        Sign out
      </BigButton>
      <Button mode="text" textColor="#B00020" onPress={() => setConfirming(true)} contentStyle={styles.tall}>
        Delete my account
      </Button>
      <Portal>
        <Dialog visible={confirming} onDismiss={() => !deleting && setConfirming(false)}>
          <Dialog.Title>Delete your account?</Dialog.Title>
          <Dialog.Content style={styles.dialog}>
            <Text variant="bodyLarge">
              This permanently deletes your profile, visa details, photos and messages. It can&apos;t be
              undone.
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirming(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button textColor="#B00020" onPress={deleteAccount} loading={deleting} disabled={deleting}>
              Delete
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
