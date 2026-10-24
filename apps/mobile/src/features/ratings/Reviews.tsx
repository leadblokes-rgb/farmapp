import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput } from 'react-native-paper';
import { RatingSummary, StarRow } from '@/components/Stars';
import { friendlyError } from '@/lib/errors';
import { useFarmReviews, useReportReview, useWorkerReviews } from './api';
import { t } from '@/i18n';

interface ReviewItem {
  application_id: string;
  stars: number;
  lines: string[];
  comment: string;
  byline: string;
}

/** Public reviews of a farm (shown to workers on job details). */
export function FarmReviews({ farmId }: { farmId: string }) {
  const reviews = useFarmReviews(farmId);
  const items: ReviewItem[] = (reviews.data ?? []).map((r) => ({
    application_id: r.application_id,
    stars: r.overall,
    lines: [
      r.would_work_again ? t('reviews.again') : t('reviews.notAgain'),
      ...(r.accommodation ? [t('reviews.accommodation', { stars: r.accommodation })] : []),
    ],
    comment: r.comment,
    byline: t('reviews.byline', { name: r.reviewer_name, job: r.job_title }),
  }));
  const avg = items.length ? items.reduce((s, r) => s + r.stars, 0) / items.length : null;
  return (
    <ReviewList
      title={t('reviews.workersSay')}
      kind="farm"
      loading={reviews.isPending}
      items={items}
      summary={<RatingSummary avg={avg} count={items.length} />}
    />
  );
}

/** Reviews of a worker from other farms (shown to farms the worker applied to). */
export function WorkerReviews({ workerId }: { workerId: string }) {
  const reviews = useWorkerReviews(workerId);
  const items: ReviewItem[] = (reviews.data ?? []).map((r) => ({
    application_id: r.application_id,
    stars: r.reliability,
    lines: [t('reviews.workerLine', { reliability: r.reliability, quality: r.quality })],
    comment: r.comment,
    byline: t('reviews.byline', { name: r.farm_name, job: r.job_title }),
  }));
  return <ReviewList title={t('reviews.farmsSay')} kind="worker" loading={reviews.isPending} items={items} />;
}

function ReviewList({
  title,
  kind,
  loading,
  items,
  summary,
}: {
  title: string;
  kind: 'farm' | 'worker';
  loading: boolean;
  items: ReviewItem[];
  summary?: ReactNode;
}) {
  const [reporting, setReporting] = useState<string | null>(null);
  const [reported, setReported] = useState<string[]>([]);
  return (
    <View style={styles.wrap}>
      <Text variant="titleMedium" style={styles.bold}>
        {title}
      </Text>
      {summary}
      {loading ? null : items.length === 0 ? (
        <Text variant="bodyMedium" style={styles.muted}>
          {t('reviews.none')}
        </Text>
      ) : (
        items.map((r) => (
          <View key={r.application_id} style={styles.review}>
            <StarRow value={r.stars} />
            {r.lines.map((l) => (
              <Text key={l} variant="bodyMedium">
                {l}
              </Text>
            ))}
            {r.comment ? <Text variant="bodyLarge">{t('reviews.quote', { text: r.comment })}</Text> : null}
            <View style={styles.footer}>
              <Text variant="bodySmall" style={[styles.muted, styles.flex]}>
                {r.byline}
              </Text>
              {reported.includes(r.application_id) ? (
                <Text variant="bodySmall">{t('reviews.reported')}</Text>
              ) : (
                <Button
                  compact
                  icon="flag-outline"
                  textColor="#B00020"
                  onPress={() => setReporting(r.application_id)}
                  accessibilityLabel={t('reviews.reportLabel')}
                >
                  {t('reviews.report')}
                </Button>
              )}
            </View>
          </View>
        ))
      )}
      <ReportReviewDialog
        kind={kind}
        applicationId={reporting}
        onDismiss={() => setReporting(null)}
        onDone={() => {
          if (reporting) setReported((ids) => [...ids, reporting]);
          setReporting(null);
        }}
      />
    </View>
  );
}

function ReportReviewDialog({
  kind,
  applicationId,
  onDismiss,
  onDone,
}: {
  kind: 'farm' | 'worker';
  applicationId: string | null;
  onDismiss: () => void;
  onDone: () => void;
}) {
  const report = useReportReview();
  const [details, setDetails] = useState('');
  return (
    <Portal>
      <Dialog visible={applicationId !== null} onDismiss={onDismiss}>
        <Dialog.Title>{t('reviews.reportTitle')}</Dialog.Title>
        <Dialog.Content style={styles.dialog}>
          <Text variant="bodyLarge">{t('reviews.reportBody')}</Text>
          <TextInput
            mode="outlined"
            label={t('reviews.whatsWrong')}
            accessibilityLabel={t('reviews.whatsWrong')}
            value={details}
            onChangeText={setDetails}
            multiline
            maxLength={2000}
          />
          {report.isError ? <Text style={styles.error}>{friendlyError(report.error)}</Text> : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{t('form.cancel')}</Button>
          <Button
            loading={report.isPending}
            disabled={report.isPending}
            onPress={() =>
              applicationId &&
              report.mutate(
                { kind, applicationId, details },
                {
                  onSuccess: () => {
                    setDetails('');
                    onDone();
                  },
                },
              )
            }
          >
            {t('reviews.send')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  bold: { fontWeight: '700' },
  muted: { opacity: 0.7 },
  review: { gap: 4, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#CCCCCC', paddingTop: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  dialog: { gap: 12 },
  error: { color: '#B00020' },
});
