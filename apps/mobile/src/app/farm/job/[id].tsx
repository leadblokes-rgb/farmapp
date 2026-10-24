import { todayIso } from '@croppr/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { SingleChoiceChips } from '@/components/form/SingleChoiceChips';
import { Meter } from '@/components/Meter';
import { LoadError } from '@/components/Loading';
import { WarningBanner } from '@/components/WarningBanner';
import { ApplicantCard } from '@/features/farm/ApplicantCard';
import { BroadcastDialog } from '@/features/farm/BroadcastDialog';
import { useJob, useSetJobStatus, type JobStatus } from '@/features/farm/jobsApi';
import { useDecide, useShortlist, type Applicant, type Decision } from '@/features/farm/shortlistApi';
import { dateRangeLabel } from '@/features/jobs/format';
import { OutcomePrompts } from '@/features/ratings/OutcomePrompts';
import { PendingReviews } from '@/features/ratings/PendingReviews';
import { MIN_TAP } from '@/theme';
import { friendlyError } from '@/lib/errors';
import { ListSkeleton } from '@/components/Skeleton';
import { Toast } from '@/components/Toast';
import { t } from '@/i18n';
import { roleLabel } from '@/i18n/shared';

type Tab = 'applied' | 'accepted' | 'declined';

export default function JobShortlist() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const job = useJob(id);
  const shortlist = useShortlist(id);
  const decide = useDecide(id);
  const setStatus = useSetJobStatus();
  const [tab, setTab] = useState<Tab>('applied');
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<Decision | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);

  const applicants = useMemo(() => shortlist.data?.applicants ?? [], [shortlist.data]);
  // Workers whose job has ended or completed stay in the Accepted tab.
  const byTab = (which: Tab) =>
    applicants.filter(
      (a) =>
        a.status === which || (which === 'accepted' && (a.status === 'completed' || a.status === 'ended')),
    );
  const visible = byTab(tab);
  const accepted = byTab('accepted').length;

  // "with Camille, Inès (both applied)" for travel groups.
  const groupNote = (a: Applicant) => {
    if (!a.group_id) return undefined;
    const others = applicants.filter(
      (o) => o.group_id === a.group_id && o.application_id !== a.application_id,
    );
    if (!others.length) return t('shortlist.groupOf', { size: a.group_size });
    return t('shortlist.groupWith', {
      size: a.group_size,
      names: others.map((o) => o.full_name.split(' ')[0]).join(', '),
    });
  };

  if (job.isPending || shortlist.isPending) return <ListSkeleton label={t('shortlist.loading')} />;
  if (job.isError || !job.data) return <LoadError onRetry={() => job.refetch()} />;
  if (shortlist.isError) return <LoadError onRetry={() => shortlist.refetch()} />;

  const j = job.data;
  const toggle = (appId: string) =>
    setSelected((s) => (s.includes(appId) ? s.filter((x) => x !== appId) : [...s, appId]));
  const selectGroup = (a: Applicant) => {
    const ids = visible.filter((o) => o.group_id === a.group_id).map((o) => o.application_id);
    setSelected((s) => [...new Set([...s, ...ids])]);
  };
  const allSelected = visible.length > 0 && visible.every((a) => selected.includes(a.application_id));

  function runDecision(decision: Decision) {
    const ids = selected;
    decide.mutate(
      { ids, decision },
      {
        onSuccess: (n) => {
          setSelected([]);
          setConfirm(null);
          setMessage(t(`shortlist.decided.${decision}`, { count: n }));
        },
        onError: (e) => {
          setConfirm(null);
          setMessage(friendlyError(e));
        },
      },
    );
  }

  const changeStatus = (status: JobStatus, msg: string) =>
    setStatus.mutate({ id: j.id, status }, { onSuccess: () => setMessage(msg) });

  const header = (
    <View style={styles.header}>
      <View style={styles.summary}>
        <Text variant="titleLarge" style={styles.bold}>
          {j.title}
        </Text>
        <Text variant="bodyLarge">
          {roleLabel(j.role_type)} · {dateRangeLabel(j.start_date, j.end_date)}
        </Text>
        <Text
          variant="titleMedium"
          style={styles.counter}
          accessibilityLabel={t('shortlist.filled', { accepted, needed: j.workers_needed })}
        >
          {t('shortlist.filled', { accepted, needed: j.workers_needed })}
        </Text>
        <Meter value={accepted / j.workers_needed} label={t('shortlist.spotsFilled')} />
        {j.status === 'open' && accepted >= j.workers_needed ? (
          <Button
            mode="contained"
            icon="check-all"
            contentStyle={styles.tall}
            onPress={() => changeStatus('filled', t('shortlist.markedFilled'))}
          >
            {t('shortlist.allFilled')}
          </Button>
        ) : null}
        <View style={styles.statusRow}>
          <Button compact icon="pencil" onPress={() => router.push(`/farm/job/edit/${j.id}`)}>
            {t('shortlist.edit')}
          </Button>
          <Button
            compact
            icon="content-copy"
            onPress={() => router.push({ pathname: '/farm/job/new', params: { from: j.id } })}
          >
            {t('shortlist.repost')}
          </Button>
          {j.status === 'open' ? (
            <>
              <Button
                compact
                icon="account-check"
                onPress={() => changeStatus('filled', t('shortlist.filledHidden'))}
              >
                {t('shortlist.markFilled')}
              </Button>
              <Button
                compact
                icon="close-circle-outline"
                onPress={() => changeStatus('closed', t('shortlist.closedHidden'))}
              >
                {t('shortlist.close')}
              </Button>
            </>
          ) : (
            <Button compact icon="restore" onPress={() => changeStatus('open', t('shortlist.reopened'))}>
              {t('shortlist.reopen', { status: t(`farmJobs.status.${j.status}`) })}
            </Button>
          )}
        </View>
      </View>
      {accepted > 0 && j.start_date <= todayIso() ? (
        <Button
          mode="contained"
          icon="clipboard-check-outline"
          contentStyle={styles.tall}
          onPress={() => router.push(`/farm/job/attendance/${j.id}`)}
        >
          {applicants.some((a) => a.status === 'accepted' && !a.attendance)
            ? t('shortlist.checkInPrompt')
            : t('shortlist.checkIn')}
        </Button>
      ) : null}
      {accepted + byTab('applied').length > 0 ? (
        <Button
          mode="outlined"
          icon="bullhorn-outline"
          contentStyle={styles.tall}
          onPress={() => setBroadcasting(true)}
        >
          {t('shortlist.messageCrew')}
        </Button>
      ) : null}
      <OutcomePrompts jobId={j.id} onMessage={setMessage} />
      <PendingReviews jobId={j.id} onMessage={setMessage} />
      {shortlist.data?.rankingFailed ? <WarningBanner>{t('shortlist.rankingFailed')}</WarningBanner> : null}
      <SingleChoiceChips<Tab>
        value={tab}
        onChange={(v: Tab) => {
          setTab(v);
          setSelected([]);
        }}
        options={[
          { key: 'applied', label: t('shortlist.tabs.applied', { count: byTab('applied').length }) },
          { key: 'accepted', label: t('shortlist.tabs.accepted', { count: accepted }) },
          { key: 'declined', label: t('shortlist.tabs.declined', { count: byTab('declined').length }) },
        ]}
      />
      {visible.length ? (
        <View style={styles.selectRow}>
          <Text variant="bodyMedium" style={styles.flex}>
            {t('shortlist.rankedBy')}
          </Text>
          <Button
            compact
            icon={allSelected ? 'checkbox-blank-outline' : 'checkbox-multiple-marked'}
            onPress={() => setSelected(allSelected ? [] : visible.map((a) => a.application_id))}
          >
            {allSelected ? t('shortlist.clear') : t('shortlist.selectAll')}
          </Button>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: t('shortlist.title') }} />
      <FlatList
        data={visible}
        keyExtractor={(a) => a.application_id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        refreshing={shortlist.isRefetching}
        onRefresh={() => shortlist.refetch()}
        ListEmptyComponent={
          <Text variant="bodyLarge" style={styles.empty}>
            {t(`shortlist.empty.${tab}`)}
          </Text>
        }
        renderItem={({ item }) => (
          <View>
            <ApplicantCard
              a={item}
              selectable={item.status === 'applied' || item.status === 'accepted'}
              selected={selected.includes(item.application_id)}
              onToggle={() => toggle(item.application_id)}
              onOpen={() =>
                router.push({
                  pathname: '/farm/applicant/[id]',
                  params: { id: item.application_id, jobId: j.id },
                })
              }
              groupNote={groupNote(item)}
            />
            {item.group_id &&
            tab !== 'declined' &&
            visible.filter((o) => o.group_id === item.group_id).length > 1 &&
            visible.find((o) => o.group_id === item.group_id) === item ? (
              <Button
                compact
                icon="account-group"
                style={styles.groupButton}
                onPress={() => selectGroup(item)}
              >
                {t('shortlist.selectGroup')}
              </Button>
            ) : null}
          </View>
        )}
      />

      {selected.length ? (
        <View style={styles.bulkBar}>
          {tab === 'applied' ? (
            <Button
              mode="contained"
              icon="check"
              style={styles.flex}
              contentStyle={styles.tall}
              onPress={() => setConfirm('accepted')}
            >
              {t('shortlist.accept', { count: selected.length })}
            </Button>
          ) : null}
          <Button
            mode="outlined"
            icon="close"
            textColor="#B00020"
            style={styles.flex}
            contentStyle={styles.tall}
            onPress={() => setConfirm('declined')}
          >
            {t('shortlist.decline', { count: selected.length })}
          </Button>
        </View>
      ) : null}

      <BroadcastDialog
        jobId={j.id}
        visible={broadcasting}
        counts={{ accepted, applied: byTab('applied').length }}
        onDismiss={() => setBroadcasting(false)}
        onSent={(m) => {
          setBroadcasting(false);
          setMessage(m);
        }}
      />
      <Portal>
        <Dialog visible={confirm !== null} onDismiss={() => setConfirm(null)}>
          <Dialog.Title>
            {confirm ? t(`shortlist.confirm.${confirm}`, { count: selected.length }) : null}
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyLarge">
              {confirm === 'accepted'
                ? t('shortlist.acceptBody', { filled: accepted + selected.length, needed: j.workers_needed })
                : t('shortlist.declineBody')}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirm(null)}>{t('form.cancel')}</Button>
            <Button loading={decide.isPending} onPress={() => confirm && runDecision(confirm)}>
              {confirm === 'accepted' ? t('shortlist.acceptButton') : t('shortlist.declineButton')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Toast message={message} onDismiss={() => setMessage(null)} duration={3000} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  list: { padding: 16, gap: 10, paddingBottom: 24 },
  header: { gap: 12, marginBottom: 4 },
  summary: { gap: 6, borderWidth: 1, borderColor: '#BDBDBD', borderRadius: 14, padding: 16 },
  bold: { fontWeight: '700' },
  counter: { fontWeight: '800', color: '#17482F' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  selectRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  empty: { textAlign: 'center', paddingVertical: 32, opacity: 0.7 },
  groupButton: { alignSelf: 'flex-start', marginTop: 2 },
  bulkBar: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderTopWidth: 1,
    borderColor: '#DDDDDD',
    backgroundColor: '#FFFFFF',
  },
  tall: { minHeight: MIN_TAP },
});
