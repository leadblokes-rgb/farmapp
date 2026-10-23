import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput } from 'react-native-paper';
import { SingleChoiceChips } from '@/components/form/SingleChoiceChips';
import { friendlyError } from '@/lib/errors';
import { useBroadcast } from './shortlistApi';

type Audience = 'accepted' | 'applied';

interface Props {
  jobId: string;
  visible: boolean;
  counts: Record<Audience, number>;
  onDismiss: () => void;
  onSent: (message: string) => void;
}

/** Message the whole crew at once. Each worker gets it in their own chat, so replies stay private. */
export function BroadcastDialog({ jobId, visible, counts, onDismiss, onSent }: Props) {
  const broadcast = useBroadcast(jobId);
  const [audience, setAudience] = useState<Audience>(counts.accepted ? 'accepted' : 'applied');
  const [body, setBody] = useState('');
  const n = counts[audience];

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>Message your crew</Dialog.Title>
        <Dialog.Content style={styles.body}>
          <SingleChoiceChips<Audience>
            value={audience}
            onChange={setAudience}
            options={[
              { key: 'accepted', label: `Accepted (${counts.accepted})` },
              { key: 'applied', label: `Still to review (${counts.applied})` },
            ]}
          />
          <TextInput
            mode="outlined"
            label="Message"
            accessibilityLabel="Crew message"
            placeholder="e.g. Start 6am Monday at the main shed. Bring a hat and water."
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={2000}
          />
          <Text variant="bodyMedium" style={styles.muted}>
            Each worker gets this in their own chat with you, so replies stay private.
          </Text>
          {broadcast.isError ? <Text style={styles.error}>{friendlyError(broadcast.error)}</Text> : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button
            mode="contained"
            disabled={!body.trim() || n === 0 || broadcast.isPending}
            loading={broadcast.isPending}
            onPress={() =>
              broadcast.mutate(
                { body, audience },
                {
                  onSuccess: (sent) => {
                    setBody('');
                    onSent(`Sent to ${sent} worker${sent === 1 ? '' : 's'}`);
                  },
                },
              )
            }
          >
            Send to {n}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12 },
  muted: { opacity: 0.75 },
  error: { color: '#B00020' },
});
