import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput } from 'react-native-paper';
import { SingleChoiceChips } from '@/components/form/SingleChoiceChips';
import { friendlyError } from '@/lib/errors';
import { useBroadcast } from './shortlistApi';
import { t } from '@/i18n';

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
        <Dialog.Title>{t('broadcast.title')}</Dialog.Title>
        <Dialog.Content style={styles.body}>
          <SingleChoiceChips<Audience>
            value={audience}
            onChange={setAudience}
            options={[
              { key: 'accepted', label: t('broadcast.accepted', { count: counts.accepted }) },
              { key: 'applied', label: t('broadcast.applied', { count: counts.applied }) },
            ]}
          />
          <TextInput
            mode="outlined"
            label={t('broadcast.message')}
            accessibilityLabel={t('broadcast.label')}
            placeholder={t('broadcast.placeholder')}
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={2000}
          />
          <Text variant="bodyMedium" style={styles.muted}>
            {t('broadcast.private')}
          </Text>
          {broadcast.isError ? <Text style={styles.error}>{friendlyError(broadcast.error)}</Text> : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{t('form.cancel')}</Button>
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
                    onSent(t('broadcast.sent', { count: sent }));
                  },
                },
              )
            }
          >
            {t('broadcast.sendTo', { count: n })}
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
