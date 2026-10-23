import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput } from 'react-native-paper';
import { friendlyError } from '@/lib/errors';
import { useDisputeNoShow } from './api';

interface Props {
  target: { id: string; farm: string } | null;
  onDismiss: () => void;
  onDone: () => void;
}

/** Worker disputes a no-show. It goes to the Croppr team and doesn't count against them meanwhile. */
export function DisputeDialog({ target, onDismiss, onDone }: Props) {
  const dispute = useDisputeNoShow();
  const [details, setDetails] = useState('');
  return (
    <Portal>
      <Dialog visible={target !== null} onDismiss={onDismiss}>
        <Dialog.Title>Dispute the no-show</Dialog.Title>
        <Dialog.Content style={styles.body}>
          <Text variant="bodyLarge">
            Tell the Croppr team what happened at {target?.farm}, for example who you worked with or any
            messages. Until they decide, this no-show doesn’t count against you.
          </Text>
          <TextInput
            mode="outlined"
            label="What happened?"
            accessibilityLabel="What happened?"
            value={details}
            onChangeText={setDetails}
            multiline
            maxLength={2000}
          />
          {dispute.isError ? <Text style={styles.error}>{friendlyError(dispute.error)}</Text> : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button
            loading={dispute.isPending}
            disabled={dispute.isPending || details.trim().length < 5}
            onPress={() =>
              target &&
              dispute.mutate(
                { applicationId: target.id, details },
                {
                  onSuccess: () => {
                    setDetails('');
                    onDone();
                  },
                },
              )
            }
          >
            Send dispute
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12 },
  error: { color: '#B00020' },
});
