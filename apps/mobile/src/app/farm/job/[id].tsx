import { jobRoleLabel } from '@croppr/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Snackbar, Text } from 'react-native-paper';
import { SingleChoiceChips } from '@/components/form/SingleChoiceChips';
import { Meter } from '@/components/Meter';
import { LoadError, Loading } from '@/components/Loading';
import { WarningBanner } from '@/components/WarningBanner';
import { ApplicantCard } from '@/features/farm/ApplicantCard';
import { useJob, useSetJobStatus, type JobStatus } from '@/features/farm/jobsApi';
import { useDecide, useShortlist, type Applicant, type Decision } from '@/features/farm/shortlistApi';
import { dateRangeLabel } from '@/features/jobs/format';
import { MIN_TAP } from '@/theme';

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

  const applicants = useMemo(() => shortlist.data?.applicants ?? [], [shortlist.data]);
  const byTab = (t: Tab) => applicants.filter((a) => a.status === t);
  const visible = byTab(tab);
  const accepted = byTab('accepted').length;

  // "with Camille, Inès (both applied)" for travel groups.
  const groupNote = (a: Applicant) => {
    if (!a.group_id) return undefined;
    const others = applicants.filter(
      (o) => o.group_id === a.group_id && o.application_id !== a.application_id,
    );
    if (!others.length) return `Travelling in a group of ${a.group_size}`;
    return `Group of ${a.group_size} · with ${others.map((o) => o.full_name.split(' ')[0]).join(', ')}`;
  };

  if (job.isPending || shortlist.isPending) return <Loading />;
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
          setMessage(
            `${decision === 'accepted' ? 'Accepted' : 'Declined'} ${n} applicant${n === 1 ? '' : 's'}`,
          );
        },
        onError: (e) => {
          setConfirm(null);
          setMessage(e.message);
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
          {jobRoleLabel(j.role_type)} · {dateRangeLabel(j.start_date, j.end_date)}
        </Text>
        <Text
          variant="titleMedium"
          style={styles.counter}
          accessibilityLabel={`${accepted} of ${j.workers_needed} filled`}
        >
          {accepted} of {j.workers_needed} filled
        </Text>
        <Meter value={accepted / j.workers_needed} label="Spots filled" />
        {j.status === 'open' && accepted >= j.workers_needed ? (
          <Button
            mode="contained"
            icon="check-all"
            contentStyle={styles.tall}
            onPress={() => changeStatus('filled', 'Job marked as filled')}
          >
            All spots filled: mark job as filled
          </Button>
        ) : null}
        <View style={styles.statusRow}>
          <Button compact icon="pencil" onPress={() => router.push(`/farm/job/edit/${j.id}`)}>
            Edit
          </Button>
          {j.status === 'open' ? (
            <>
              <Button
                compact
                icon="account-check"
                onPress={() => changeStatus('filled', 'Marked as filled. It no longer shows to workers.')}
              >
                Mark filled
              </Button>
              <Button
                compact
                icon="close-circle-outline"
                onPress={() => changeStatus('closed', 'Job closed. It no longer shows to workers.')}
              >
                Close
              </Button>
            </>
          ) : (
            <Button compact icon="restore" onPress={() => changeStatus('open', 'Job reopened.')}>
              Reopen ({j.status})
            </Button>
          )}
        </View>
      </View>
      {shortlist.data?.rankingFailed ? (
        <WarningBanner>Couldn’t refresh match scores. Showing the last ranking.</WarningBanner>
      ) : null}
      <SingleChoiceChips<Tab>
        value={tab}
        onChange={(v: Tab) => {
          setTab(v);
          setSelected([]);
        }}
        options={[
          { key: 'applied', label: `To review (${byTab('applied').length})` },
          { key: 'accepted', label: `Accepted (${accepted})` },
          { key: 'declined', label: `Declined (${byTab('declined').length})` },
        ]}
      />
      {visible.length ? (
        <View style={styles.selectRow}>
          <Text variant="bodyMedium" style={styles.flex}>
            Ranked by match score: availability, distance, car, experience and reliability.
          </Text>
          <Button
            compact
            icon={allSelected ? 'checkbox-blank-outline' : 'checkbox-multiple-marked'}
            onPress={() => setSelected(allSelected ? [] : visible.map((a) => a.application_id))}
          >
            {allSelected ? 'Clear' : 'Select all'}
          </Button>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Applicants' }} />
      <FlatList
        data={visible}
        keyExtractor={(a) => a.application_id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        refreshing={shortlist.isRefetching}
        onRefresh={() => shortlist.refetch()}
        ListEmptyComponent={
          <Text variant="bodyLarge" style={styles.empty}>
            {tab === 'applied'
              ? 'No one waiting for review.'
              : tab === 'accepted'
                ? 'No one accepted yet.'
                : 'No one declined.'}
          </Text>
        }
        renderItem={({ item }) => (
          <View>
            <ApplicantCard
              a={item}
              selectable={tab !== 'declined'}
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
                Select whole group
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
              Accept {selected.length}
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
            Decline {selected.length}
          </Button>
        </View>
      ) : null}

      <Portal>
        <Dialog visible={confirm !== null} onDismiss={() => setConfirm(null)}>
          <Dialog.Title>
            {confirm === 'accepted' ? 'Accept' : 'Decline'} {selected.length} applicant
            {selected.length === 1 ? '' : 's'}?
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyLarge">
              {confirm === 'accepted'
                ? `That makes ${accepted + selected.length} of ${j.workers_needed} filled. They'll see "Accepted" in Croppr and you can message them.`
                : 'They’ll see “Not this time” in Croppr.'}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirm(null)}>Cancel</Button>
            <Button loading={decide.isPending} onPress={() => confirm && runDecision(confirm)}>
              {confirm === 'accepted' ? 'Accept' : 'Decline'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar visible={message !== null} onDismiss={() => setMessage(null)} duration={3000}>
        {message}
      </Snackbar>
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
