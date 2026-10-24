import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';
import { friendlyError } from '@/lib/errors';
import { MIN_TAP } from '@/theme';
import { useAnswerOutcome, usePendingOutcomes, type PendingOutcome, type WorkAnswer } from './api';
import { t } from '@/i18n';

const CHOICES: { answer: WorkAnswer; icon: string }[] = [
  { answer: 'worked', icon: 'check-circle-outline' },
  { answer: 'left_early', icon: 'clock-alert-outline' },
  { answer: 'did_not_work', icon: 'close-circle-outline' },
];

const RESULT: Record<string, (o: PendingOutcome) => string> = {
  waiting: (o) =>
    o.kind === 'worker'
      ? t('outcome.waitingFarm')
      : t('outcome.waitingWorker', { name: o.subject_name.split(' ')[0] }),
  completed: () => t('outcome.completed'),
  not_worked: () => t('outcome.notWorked'),
  disputed: () => t('outcome.disputed'),
};

/** "Did this work out?" after a job ends, for workers (Matches, Days) and farms (Jobs, job page). */
export function OutcomePrompts({ jobId, onMessage }: { jobId?: string; onMessage: (m: string) => void }) {
  const pending = usePendingOutcomes();
  const answer = useAnswerOutcome();
  const items = (pending.data ?? []).filter((o) => !jobId || o.job_id === jobId);
  if (!items.length) return null;

  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <Icon source="handshake-outline" size={24} color="#17482F" />
        <Text variant="titleMedium" style={styles.title}>
          {t('outcome.title')}
        </Text>
      </View>
      {items.map((o) => (
        <View key={o.application_id} style={styles.item}>
          <Text variant="bodyLarge" style={styles.bold}>
            {o.kind === 'worker'
              ? t('outcome.workerItem', { job: o.job_title, farm: o.subject_name })
              : t('outcome.farmItem', { name: o.subject_name, job: o.job_title })}
          </Text>
          {CHOICES.map((c) => ({
            ...c,
            label: t(`outcome.choices.${o.kind as 'worker' | 'farm'}.${c.answer}`),
          })).map((c) => (
            <Button
              key={c.answer}
              mode={o.suggested === c.answer ? 'contained' : 'outlined'}
              icon={c.icon}
              contentStyle={styles.tall}
              disabled={answer.isPending}
              accessibilityLabel={
                o.kind === 'farm'
                  ? t('outcome.farmChoiceLabel', { name: o.subject_name, choice: c.label })
                  : c.label
              }
              onPress={() =>
                answer.mutate(
                  { applicationId: o.application_id, answer: c.answer },
                  { onSuccess: (r) => onMessage(RESULT[r]!(o)), onError: (e) => onMessage(friendlyError(e)) },
                )
              }
            >
              {c.label}
            </Button>
          ))}
          {o.suggested ? (
            <Text variant="bodySmall" style={styles.muted}>
              {t('outcome.suggested')}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#E8F5E9', borderRadius: 14, padding: 14, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontWeight: '700', color: '#17482F' },
  item: { gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#A5D6A7', paddingTop: 8 },
  bold: { fontWeight: '700' },
  muted: { opacity: 0.7 },
  tall: { minHeight: MIN_TAP, justifyContent: 'flex-start' },
});
