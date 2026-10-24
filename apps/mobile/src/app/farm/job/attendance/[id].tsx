import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Avatar, Button, Icon, Text } from 'react-native-paper';
import { LoadError } from '@/components/Loading';
import { ListSkeleton } from '@/components/Skeleton';
import { Toast } from '@/components/Toast';
import { initials } from '@/features/farm/ApplicantCard';
import { useJob } from '@/features/farm/jobsApi';
import { useShortlist, type Applicant } from '@/features/farm/shortlistApi';
import { dateRangeLabel } from '@/features/jobs/format';
import { useMarkAttendance, type AttendanceStatus } from '@/features/ratings/api';
import { friendlyError } from '@/lib/errors';
import { MIN_TAP } from '@/theme';
import { t } from '@/i18n';

const STATUSES: AttendanceStatus[] = ['showed', 'no_show', 'left_early'];
const label = (s: AttendanceStatus) => t(`attendance.status.${s}`);
const ICON: Record<AttendanceStatus, string> = {
  showed: 'check-circle-outline',
  no_show: 'close-circle-outline',
  left_early: 'clock-alert-outline',
};

/** Day-one check-in: who turned up? Drives job completion, ratings and no-show counts. */
export default function Attendance() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const job = useJob(id);
  const shortlist = useShortlist(id);
  const mark = useMarkAttendance(id);
  const [message, setMessage] = useState<string | null>(null);

  if (job.isPending || shortlist.isPending) return <ListSkeleton label={t('attendance.loading')} />;
  if (job.isError || !job.data) return <LoadError onRetry={() => job.refetch()} />;
  if (shortlist.isError) return <LoadError onRetry={() => shortlist.refetch()} />;

  const crew = shortlist.data.applicants.filter((a) => a.status === 'accepted' || a.status === 'completed');
  const unmarked = crew.filter((a) => a.status === 'accepted' && !a.attendance);

  const set = (ids: string[], status: AttendanceStatus, done: string) =>
    mark.mutate(
      { ids, status },
      { onSuccess: () => setMessage(done), onError: (e) => setMessage(friendlyError(e)) },
    );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: t('attendance.title') }} />
      <FlatList
        data={crew}
        keyExtractor={(a) => a.application_id}
        contentContainerStyle={styles.list}
        refreshing={shortlist.isRefetching}
        onRefresh={() => shortlist.refetch()}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="titleLarge" style={styles.bold}>
              {job.data.title}
            </Text>
            <Text variant="bodyLarge">{dateRangeLabel(job.data.start_date, job.data.end_date)}</Text>
            <Text variant="bodyMedium" style={styles.muted}>
              {t('attendance.explain')}
            </Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.muted}>{t('attendance.empty')}</Text>}
        renderItem={({ item }) => <CrewRow a={item} busy={mark.isPending} onMark={set} />}
      />
      {unmarked.length ? (
        <View style={styles.bar}>
          <Button
            mode="contained"
            icon="check-all"
            contentStyle={styles.tall}
            loading={mark.isPending}
            onPress={() =>
              set(
                unmarked.map((a) => a.application_id),
                'showed',
                t('attendance.markedAll', { count: unmarked.length }),
              )
            }
          >
            {t('attendance.everyoneElse', { count: unmarked.length })}
          </Button>
        </View>
      ) : null}
      <Toast message={message} onDismiss={() => setMessage(null)} />
    </View>
  );
}

function CrewRow({
  a,
  busy,
  onMark,
}: {
  a: Applicant;
  busy: boolean;
  onMark: (ids: string[], status: AttendanceStatus, done: string) => void;
}) {
  const locked = a.status === 'completed' || a.attendance_disputed;
  const first = a.full_name.split(' ')[0];
  return (
    <View style={styles.row}>
      <View style={styles.who}>
        <Avatar.Text size={44} label={initials(a.full_name)} />
        <View style={styles.flex}>
          <Text variant="titleMedium" style={styles.bold}>
            {a.full_name}
          </Text>
          <Text variant="bodyMedium" style={styles.muted}>
            {a.status === 'completed'
              ? t('attendance.completed')
              : a.attendance_disputed
                ? t('attendance.disputed')
                : a.attendance
                  ? label(a.attendance)
                  : t('attendance.notChecked')}
          </Text>
        </View>
      </View>
      {locked ? null : (
        <View style={styles.choices}>
          {STATUSES.map((k) => {
            const on = a.attendance === k;
            return (
              <Pressable
                key={k}
                disabled={busy || on}
                onPress={() =>
                  onMark([a.application_id], k, t('attendance.marked', { name: first, status: label(k) }))
                }
                style={[styles.choice, on && styles.choiceOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled: busy }}
                accessibilityLabel={t('attendance.marked', { name: a.full_name, status: label(k) })}
              >
                <Icon source={ICON[k]} size={24} color={on ? '#FFFFFF' : '#17482F'} />
                <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{label(k)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  list: { padding: 16, gap: 12, paddingBottom: 24 },
  header: { gap: 6, marginBottom: 4 },
  bold: { fontWeight: '700' },
  muted: { opacity: 0.75 },
  row: { borderWidth: 1, borderColor: '#BDBDBD', borderRadius: 14, padding: 12, gap: 10 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  choices: { flexDirection: 'row', gap: 8 },
  choice: {
    flex: 1,
    minHeight: MIN_TAP,
    borderWidth: 1,
    borderColor: '#17482F',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 2,
  },
  choiceOn: { backgroundColor: '#17482F' },
  choiceText: { fontWeight: '600', textAlign: 'center', color: '#17482F' },
  choiceTextOn: { color: '#FFFFFF' },
  bar: { padding: 12, borderTopWidth: 1, borderColor: '#DDDDDD', backgroundColor: '#FFFFFF' },
  tall: { minHeight: MIN_TAP },
});
