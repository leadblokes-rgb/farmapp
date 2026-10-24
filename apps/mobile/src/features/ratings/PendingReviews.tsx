import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';
import { MIN_TAP } from '@/theme';
import { usePendingReviews, type PendingReview } from './api';
import { RatingSheet } from './RatingSheet';
import { t } from '@/i18n';

interface Props {
  /** Only reviews for this job (farm job page). */
  jobId?: string;
  onMessage: (message: string) => void;
}

/** "Rate your time at X" / "Rate Sam" prompts, with the rating sheet. Renders nothing when done. */
export function PendingReviews({ jobId, onMessage }: Props) {
  const pending = usePendingReviews();
  const [open, setOpen] = useState<PendingReview | null>(null);
  const items = (pending.data ?? []).filter((r) => !jobId || r.job_id === jobId);
  if (!items.length) return null;

  const workers = items[0]!.kind === 'worker';
  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <Icon source="star-outline" size={24} color="#5C3B00" />
        <Text variant="titleMedium" style={styles.title}>
          {workers ? t('ratings.pending.crew', { count: items.length }) : t('ratings.pending.howDidItGo')}
        </Text>
      </View>
      {items.map((r) => (
        <Button
          key={r.application_id}
          mode="contained-tonal"
          icon="star"
          contentStyle={styles.tall}
          style={styles.button}
          onPress={() => setOpen(r)}
          accessibilityLabel={
            r.kind === 'farm'
              ? t('ratings.pending.rateFarm', { name: r.subject_name })
              : t('ratings.pending.rateWorkerFor', { name: r.subject_name, job: r.job_title })
          }
        >
          {r.kind === 'farm'
            ? t('ratings.pending.rateFarm', { name: r.subject_name })
            : t('ratings.pending.rateWorker', { name: r.subject_name })}
        </Button>
      ))}
      <RatingSheet
        review={open}
        onDismiss={() => setOpen(null)}
        onDone={(m) => {
          setOpen(null);
          onMessage(m);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#FFF4D6', borderRadius: 14, padding: 14, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontWeight: '700', color: '#3B2600', flexShrink: 1 },
  button: { alignSelf: 'stretch' },
  tall: { minHeight: MIN_TAP, justifyContent: 'flex-start' },
});
