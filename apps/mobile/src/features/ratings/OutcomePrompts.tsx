import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';
import { friendlyError } from '@/lib/errors';
import { MIN_TAP } from '@/theme';
import { useAnswerOutcome, usePendingOutcomes, type PendingOutcome, type WorkAnswer } from './api';

const CHOICES: Record<'worker' | 'farm', { answer: WorkAnswer; label: string; icon: string }[]> = {
  worker: [
    { answer: 'worked', label: 'Yes, I worked it', icon: 'check-circle-outline' },
    { answer: 'left_early', label: 'I left early', icon: 'clock-alert-outline' },
    { answer: 'did_not_work', label: 'I didn’t end up working', icon: 'close-circle-outline' },
  ],
  farm: [
    { answer: 'worked', label: 'Yes, they worked', icon: 'check-circle-outline' },
    { answer: 'left_early', label: 'They left early', icon: 'clock-alert-outline' },
    { answer: 'did_not_work', label: 'They didn’t turn up', icon: 'close-circle-outline' },
  ],
};

const RESULT: Record<string, (o: PendingOutcome) => string> = {
  waiting: (o) =>
    `Thanks. We’ll confirm it once ${o.kind === 'worker' ? 'the farm answers' : `${o.subject_name.split(' ')[0]} answers`}.`,
  completed: () => 'Confirmed by both of you: it’s now a verified work record.',
  not_worked: () => 'Thanks, noted.',
  disputed: () =>
    'Your answers were different. The Croppr team will look into it; nothing counts until then.',
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
          Did this work out?
        </Text>
      </View>
      {items.map((o) => (
        <View key={o.application_id} style={styles.item}>
          <Text variant="bodyLarge" style={styles.bold}>
            {o.kind === 'worker'
              ? `${o.job_title} at ${o.subject_name}`
              : `${o.subject_name} · ${o.job_title}`}
          </Text>
          {CHOICES[o.kind as 'worker' | 'farm'].map((c) => (
            <Button
              key={c.answer}
              mode={o.suggested === c.answer ? 'contained' : 'outlined'}
              icon={c.icon}
              contentStyle={styles.tall}
              disabled={answer.isPending}
              accessibilityLabel={`${o.kind === 'farm' ? `${o.subject_name}: ` : ''}${c.label}`}
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
              Highlighted from your day-one check-in.
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
