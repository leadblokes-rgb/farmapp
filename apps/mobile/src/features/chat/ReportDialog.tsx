import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Dialog, HelperText, Portal, Text, TextInput } from 'react-native-paper';
import { SingleChoiceChips } from '@/components/form/SingleChoiceChips';
import { useSubmitReport, type ReportReason } from './api';
import { t } from '@/i18n';

// Reasons a person can pick (the others are raised by the system, e.g. no-show disputes).
const REASONS = ['unsafe', 'underpaid', 'harassment', 'scam', 'no_show', 'fake_profile', 'other'] as const;

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
        <Dialog.Title>{t('report.title', { subject })}</Dialog.Title>
        <Dialog.ScrollArea>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text variant="bodyMedium">{t('report.intro')}</Text>
            <SingleChoiceChips
              options={REASONS.map((key) => ({ key, label: t(`report.reasons.${key}`) }))}
              value={reason}
              onChange={setReason}
            />
            <TextInput
              mode="outlined"
              label={t('report.details')}
              accessibilityLabel={t('report.detailsLabel')}
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
          <Button onPress={onDismiss}>{t('form.cancel')}</Button>
          <Button onPress={send} disabled={!reason} loading={submit.isPending}>
            {t('report.send')}
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
