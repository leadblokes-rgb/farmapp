import { useState, type ReactElement } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { dateRangeLabel, payLabel } from '@/features/jobs/format';
import { friendlyError } from '@/lib/errors';
import { MIN_TAP } from '@/theme';
import { useSaveJob, useSavedJobs, useSwipe, type RankedFeedJob } from './feedApi';
import { JobDetailSheet } from './JobDetailSheet';
import { ReportDialog } from '@/features/chat/ReportDialog';
import { t } from '@/i18n';

/** Jobs saved for later (swipe up or "Save for later"), with Apply and Remove. */
export function SavedJobs({
  userId,
  header,
  onMessage,
}: {
  userId: string;
  header: ReactElement;
  onMessage: (m: string) => void;
}) {
  const saved = useSavedJobs(userId);
  const swipe = useSwipe();
  const save = useSaveJob(userId);
  const [detail, setDetail] = useState<RankedFeedJob | null>(null);
  const [reporting, setReporting] = useState<RankedFeedJob | null>(null);

  const apply = (r: RankedFeedJob) =>
    swipe.mutate(
      { jobId: r.job.id, direction: 'like' },
      {
        onSuccess: () => onMessage(t('saved.applied', { title: r.job.title })),
        onError: (e) => onMessage(friendlyError(e)),
      },
    );
  const remove = (r: RankedFeedJob) =>
    save.mutate(
      { jobId: r.job.id, saved: false },
      { onSuccess: () => onMessage(t('saved.removed')), onError: (e) => onMessage(friendlyError(e)) },
    );

  return (
    <>
      <FlatList
        data={saved.data ?? []}
        keyExtractor={(r) => r.job.id}
        contentContainerStyle={styles.list}
        refreshing={saved.isRefetching}
        onRefresh={() => saved.refetch()}
        ListHeaderComponent={header}
        ListEmptyComponent={
          saved.isPending ? null : (
            <View style={styles.empty}>
              <Text variant="headlineSmall">{t('saved.emptyTitle')}</Text>
              <Text variant="bodyLarge" style={styles.center}>
                {t('saved.emptyBody')}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const pay = payLabel(item.job);
          return (
            <Card mode="outlined" onPress={() => setDetail(item)}>
              <Card.Content style={styles.card}>
                <Text variant="titleLarge" style={styles.title}>
                  {item.job.title}
                </Text>
                <Text variant="bodyLarge">
                  {item.job.farm_name} · {item.job.locality ?? item.job.postcode}
                </Text>
                <Text variant="bodyLarge">
                  {pay.main} · {dateRangeLabel(item.job.start_date, item.job.end_date)}
                </Text>
                {item.specified.eligible ? <Text variant="bodyMedium">✓ {item.specified.label}</Text> : null}
                <View style={styles.actions}>
                  <Button
                    mode="outlined"
                    icon="bookmark-remove-outline"
                    style={styles.flex}
                    contentStyle={styles.tall}
                    onPress={() => remove(item)}
                  >
                    {t('saved.remove')}
                  </Button>
                  <Button
                    mode="contained"
                    icon="check"
                    style={styles.flex}
                    contentStyle={styles.tall}
                    onPress={() => apply(item)}
                    accessibilityLabel={t('saved.applyFor', { title: item.job.title })}
                  >
                    {t('saved.apply')}
                  </Button>
                </View>
              </Card.Content>
            </Card>
          );
        }}
      />
      <JobDetailSheet
        item={detail}
        skipLabel={t('saved.remove')}
        onDismiss={() => setDetail(null)}
        onReport={(r) => {
          setDetail(null);
          setReporting(r);
        }}
        onDecide={(direction) => {
          const r = detail;
          setDetail(null);
          if (r) (direction === 'like' ? apply : remove)(r);
        }}
      />
      <ReportDialog
        visible={reporting !== null}
        subject={reporting ? t('saved.quoted', { title: reporting.job.title }) : t('saved.job')}
        jobId={reporting?.job.id}
        onDismiss={() => setReporting(null)}
        onDone={() => {
          setReporting(null);
          onMessage(t('chat.reported'));
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12, flexGrow: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 48 },
  center: { textAlign: 'center' },
  card: { gap: 4 },
  title: { fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  flex: { flex: 1 },
  tall: { minHeight: MIN_TAP },
});
