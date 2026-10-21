import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Dialog, HelperText, Portal, Text, TextInput } from 'react-native-paper';
import { SingleChoiceChips } from '@/components/form/SingleChoiceChips';
import { useSubmitReport, type ReportReason } from './api';

const REASONS: { key: ReportReason; label: string }[] = [
  { key: 'unsafe', label: 'Unsafe work or housing' },
  { key: 'underpaid', label: 'Underpaid / not paid' },
  { key: 'harassment', label: 'Harassment' },
  { key: 'scam', label: 'Scam or asks for money' },
  { key: 'no_show', label: 'Didn’t show up' },
  { key: 'fake_profile', label: 'Fake profile or farm' },
  { key: 'other', label: 'Something else' },
];

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onDone: () => void;
  conversationId?: string;
  jobId?: string;
  subject: string;
}

/** Report a person (from a chat) or a job. Goes to the Croppr team; the other person isn't told. */
export function ReportDialog({ visible, onDismiss, onDone, conversationId, jobId, subject }: Props) {
  const [reason, setReason] = useState<ReportReason | undefined>();
  const [details, setDetails] = useState('');
  const submit = useSubmitReport();

  const send = () =>
    reason &&
    submit.mutate(
      { reason, details, conversationId, jobId },
      {
        onSuccess: () => {
          setReason(undefined);
          setDetails('');
          onDone();
        },
      },
    );

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>Report {subject}</Dialog.Title>
        <Dialog.ScrollArea>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text variant="bodyMedium">
              Reports go to the Croppr team, not to the other person. If you&apos;re in danger, call 000.
            </Text>
            <SingleChoiceChips options={REASONS} value={reason} onChange={setReason} />
            <TextInput
              mode="outlined"
              label="What happened? (optional)"
              accessibilityLabel="What happened?"
              value={details}
              onChangeText={setDetails}
              multiline
              numberOfLines={3}
              maxLength={2000}
            />
            <HelperText type="error" visible={submit.isError}>
              {submit.error?.message}
            </HelperText>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button onPress={send} disabled={!reason} loading={submit.isPending}>
            Send report
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: { maxHeight: '90%' },
  body: { gap: 12, paddingVertical: 12 },
});
